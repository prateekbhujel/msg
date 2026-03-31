<?php

use App\Events\CallInvitation;
use App\Events\CallSignal;
use App\Models\CallSession;
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
        ->assertJsonPath('session.callee.id', $callee->id);

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
        ->assertJsonPath('session.callee.id', $callee->id);

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

    $session->refresh();

    expect($session->status)->toBe('ended');
    expect($session->ended_at)->not->toBeNull();

    Event::assertDispatched(CallSignal::class, function (CallSignal $event) use ($callee, $session) {
        return $event->type === 'hangup'
            && $event->session->uuid === $session->uuid
            && $event->fromId === $session->caller_id;
    });
});
