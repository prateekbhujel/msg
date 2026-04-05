<?php

use App\Events\CallGroupInvite;
use App\Events\CallInvitation;
use App\Events\CallSignal;
use App\Events\CallUpgradeVideo;
use App\Models\CallSession;
use App\Models\ChatGroup;
use App\Models\User;
use Illuminate\Support\Facades\Event;

function makeCallSession(User $caller, User $callee, array $attributes = []): CallSession
{
    return CallSession::create(array_merge([
        'uuid' => (string) str()->uuid(),
        'caller_id' => $caller->id,
        'callee_id' => $callee->id,
        'call_type' => 'video',
        'status' => 'ringing',
    ], $attributes))->load(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']);
}

it('creates a call session and dispatches an invitation', function () {
    Event::fake([CallInvitation::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();

    $response = $this->actingAs($caller)->postJson(route('messenger.calls.store'), [
        'callee_id' => $callee->id,
        'call_type' => 'video',
    ]);

    $response->assertCreated()
        ->assertJsonPath('session.call_type', 'video')
        ->assertJsonPath('session.caller.id', $caller->id)
        ->assertJsonPath('session.callee.id', $callee->id)
        ->assertJsonPath('history_message.message_type', 'call')
        ->assertJsonPath('history_message.meta.status', 'ringing')
        ->assertJsonStructure(['history_message_html']);

    $this->assertDatabaseHas('call_sessions', [
        'caller_id' => $caller->id,
        'callee_id' => $callee->id,
        'call_type' => 'video',
        'status' => 'ringing',
    ]);

    Event::assertDispatched(CallInvitation::class, function (CallInvitation $event) use ($caller, $callee) {
        return $event->session->caller_id === $caller->id
            && $event->session->callee_id === $callee->id
            && $event->session->status === 'ringing';
    });
});

it('allows the callee to accept a call and broadcasts the acceptance', function () {
    Event::fake([CallSignal::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee);

    $response = $this->actingAs($callee)->postJson(route('messenger.calls.accept', ['session' => $session->uuid]));

    $response->assertOk()
        ->assertJsonPath('session.status', 'active')
        ->assertJsonPath('session.caller.id', $caller->id)
        ->assertJsonPath('session.callee.id', $callee->id)
        ->assertJsonPath('history_message.message_type', 'call')
        ->assertJsonPath('history_message.meta.status', 'active');

    $session->refresh();

    expect($session->status)->toBe('active');
    expect($session->accepted_at)->not->toBeNull();

    Event::assertDispatched(CallSignal::class, function (CallSignal $event) use ($caller, $session) {
        return $event->type === 'accepted'
            && $event->session->uuid === $session->uuid
            && $event->fromId === $session->callee_id;
    });
});

it('relays call signaling payloads to the other participant', function () {
    Event::fake([CallSignal::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee, ['status' => 'active', 'accepted_at' => now()]);

    $response = $this->actingAs($caller)->postJson(route('messenger.calls.signal', ['session' => $session->uuid]), [
        'signal_type' => 'offer',
        'signal_data' => json_encode([
            'type' => 'offer',
            'sdp' => 'fake-offer',
        ]),
    ]);

    $response->assertOk()->assertJson(['ok' => true]);

    Event::assertDispatched(CallSignal::class, function (CallSignal $event) use ($callee, $session) {
        return $event->type === 'signal'
            && $event->session->uuid === $session->uuid
            && $event->fromId === $session->caller_id
            && $event->payload['signal_type'] === 'offer';
    });
});

it('hangs up an active call and marks it ended', function () {
    Event::fake([CallSignal::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee, ['status' => 'active', 'accepted_at' => now()]);

    $response = $this->actingAs($caller)->deleteJson(route('messenger.calls.hangup', ['session' => $session->uuid]));

    $response->assertOk()->assertJson(['ok' => true]);
    $response->assertJsonPath('history_message.message_type', 'call');
    $response->assertJsonPath('history_message.meta.status', 'ended');

    $session->refresh();

    expect($session->status)->toBe('ended');
    expect($session->ended_at)->not->toBeNull();

    Event::assertDispatched(CallSignal::class, function (CallSignal $event) use ($callee, $session) {
        return $event->type === 'hangup'
            && $event->session->uuid === $session->uuid
            && $event->fromId === $session->caller_id;
    });
});

it('marks unanswered ringing calls as missed without adding fake duration', function () {
    Event::fake([CallSignal::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee, [
        'created_at' => now()->subSeconds(4),
        'updated_at' => now()->subSeconds(4),
    ]);

    $response = $this->actingAs($caller)->deleteJson(route('messenger.calls.hangup', ['session' => $session->uuid]));

    $response->assertOk()
        ->assertJsonPath('history_message.meta.status', 'missed')
        ->assertJsonPath('history_message.meta.duration_seconds', 0);

    $session->refresh();

    expect($session->status)->toBe('missed');
    expect($session->ended_at)->not->toBeNull();

    Event::assertDispatched(CallSignal::class, function (CallSignal $event) use ($session) {
        return $event->type === 'hangup'
            && $event->session->uuid === $session->uuid
            && $event->payload['history_message']['meta']['status'] === 'missed'
            && (int) $event->payload['history_message']['meta']['duration_seconds'] === 0;
    });
});

it('does not allow accepting a ringing call after the timeout window', function () {
    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee);
    $session->forceFill([
        'created_at' => now()->subSeconds(40),
        'updated_at' => now()->subSeconds(40),
    ])->save();

    $this->actingAs($callee)
        ->postJson(route('messenger.calls.accept', ['session' => $session->uuid]))
        ->assertStatus(409);

    expect($session->fresh()->status)->toBe('missed');
});

it('shows the dedicated call room with a valid signed token', function () {
    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee, [
        'meta' => [
            'participant_ids' => [$caller->id, $callee->id],
            'joined_participant_ids' => [$caller->id],
        ],
    ]);

    $response = $this->actingAs($caller)->get(route('calls.room', [
        'session' => $session->uuid,
        'token' => $session->roomTokenFor($caller->id),
    ]));

    $response->assertOk()->assertSee($session->uuid);
});

it('rejects the dedicated call room when the token is invalid', function () {
    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee, [
        'meta' => [
            'participant_ids' => [$caller->id, $callee->id],
        ],
    ]);

    $this->actingAs($caller)->get(route('calls.room', [
        'session' => $session->uuid,
        'token' => 'not-valid',
    ]))->assertForbidden();
});

it('can invite more people into an active call', function () {
    Event::fake([CallGroupInvite::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $guest = User::factory()->create();
    $session = makeCallSession($caller, $callee, [
        'status' => 'active',
        'accepted_at' => now(),
        'meta' => [
            'participant_ids' => [$caller->id, $callee->id],
            'joined_participant_ids' => [$caller->id, $callee->id],
        ],
    ]);

    $response = $this->actingAs($caller)->postJson(route('calls.group-invite', [
        'session' => $session->uuid,
    ]), [
        'user_id' => $guest->id,
    ]);

    $response->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('invited_user_ids.0', $guest->id);

    expect($session->fresh()->participantIds())->toContain($guest->id);

    Event::assertDispatched(CallGroupInvite::class, function (CallGroupInvite $event) use ($session, $guest) {
        return $event->session->uuid === $session->uuid
            && $event->invitedUserId === $guest->id;
    });
});

it('upgrades an active audio call to video', function () {
    Event::fake([CallUpgradeVideo::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $session = makeCallSession($caller, $callee, [
        'call_type' => 'audio',
        'status' => 'active',
        'accepted_at' => now(),
        'meta' => [
            'participant_ids' => [$caller->id, $callee->id],
            'joined_participant_ids' => [$caller->id, $callee->id],
        ],
    ]);

    $response = $this->actingAs($caller)->postJson(route('calls.upgrade', [
        'session' => $session->uuid,
    ]));

    $response->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('session.call_type', 'video');

    expect($session->fresh()->call_type)->toBe('video');

    Event::assertDispatched(CallUpgradeVideo::class, function (CallUpgradeVideo $event) use ($session, $caller) {
        return $event->session->uuid === $session->uuid
            && $event->fromUserId === $caller->id;
    });
});

it('rejects starting a direct call when the recipient is already on another active call', function () {
    Event::fake([CallInvitation::class]);

    $caller = User::factory()->create();
    $busyUser = User::factory()->create();
    $otherParticipant = User::factory()->create();

    makeCallSession($busyUser, $otherParticipant, [
        'status' => 'active',
        'accepted_at' => now(),
        'meta' => [
            'conversation_key' => 'user:' . $otherParticipant->id,
            'participant_ids' => [$busyUser->id, $otherParticipant->id],
            'joined_participant_ids' => [$busyUser->id, $otherParticipant->id],
        ],
    ]);

    $this->actingAs($caller)->postJson(route('messenger.calls.store'), [
        'callee_id' => $busyUser->id,
        'call_type' => 'video',
        'conversation_key' => 'user:' . $busyUser->id,
    ])->assertStatus(409)
        ->assertJsonPath('message', $busyUser->name . ' is on another call right now.');

    Event::assertNotDispatched(CallInvitation::class);
});

it('rejects starting another call when the caller is already busy elsewhere', function () {
    Event::fake([CallInvitation::class]);

    $caller = User::factory()->create();
    $activePeer = User::factory()->create();
    $newRecipient = User::factory()->create();

    makeCallSession($caller, $activePeer, [
        'status' => 'active',
        'accepted_at' => now(),
        'meta' => [
            'conversation_key' => 'user:' . $activePeer->id,
            'participant_ids' => [$caller->id, $activePeer->id],
            'joined_participant_ids' => [$caller->id, $activePeer->id],
        ],
    ]);

    $this->actingAs($caller)->postJson(route('messenger.calls.store'), [
        'callee_id' => $newRecipient->id,
        'call_type' => 'audio',
        'conversation_key' => 'user:' . $newRecipient->id,
    ])->assertStatus(409)
        ->assertJsonPath('message', 'Finish your current call before starting another one.');

    Event::assertNotDispatched(CallInvitation::class);
});

it('does not reuse a same-pair group session when attempting a fresh direct call', function () {
    Event::fake([CallInvitation::class]);

    $caller = User::factory()->create();
    $callee = User::factory()->create();
    $guest = User::factory()->create();

    $group = ChatGroup::create([
        'owner_id' => $caller->id,
        'name' => 'Launch Crew',
        'avatar' => 'default/avatar.png',
    ]);

    $group->members()->attach([
        $caller->id => ['created_at' => now(), 'updated_at' => now()],
        $callee->id => ['created_at' => now(), 'updated_at' => now()],
        $guest->id => ['created_at' => now(), 'updated_at' => now()],
    ]);

    $groupSession = makeCallSession($caller, $callee, [
        'status' => 'active',
        'accepted_at' => now(),
        'meta' => [
            'is_group' => true,
            'group_id' => $group->id,
            'group_name' => $group->name,
            'group_avatar' => $group->avatarPath(),
            'group_member_count' => 3,
            'conversation_key' => $group->conversationKey(),
            'participant_ids' => [$caller->id, $callee->id, $guest->id],
            'joined_participant_ids' => [$caller->id, $callee->id, $guest->id],
        ],
    ]);

    $this->actingAs($caller)->postJson(route('messenger.calls.store'), [
        'callee_id' => $callee->id,
        'call_type' => 'video',
        'conversation_key' => 'user:' . $callee->id,
    ])->assertStatus(409)
        ->assertJsonPath('message', 'Finish your current call before starting another one.');

    Event::assertNotDispatched(CallInvitation::class);
});
