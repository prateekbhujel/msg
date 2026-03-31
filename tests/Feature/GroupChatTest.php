<?php

use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\Message;
use App\Models\User;

it('creates a group and adds the selected members', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();

    $response = $this->actingAs($owner)->post(route('messenger.groups.store'), [
        'name' => 'Weekend Crew',
        'members' => [$memberA->id, $memberB->id],
    ]);

    $response->assertCreated()
        ->assertJsonPath('group.name', 'Weekend Crew');

    $group = ChatGroup::query()->latest('id')->firstOrFail();

    expect($group->owner_id)->toBe($owner->id);
    expect($group->members()->pluck('users.id')->all())
        ->toMatchArray([$owner->id, $memberA->id, $memberB->id]);
});

it('stores and fetches group messages through the messenger endpoints', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();

    $group = ChatGroup::create([
        'owner_id' => $owner->id,
        'name' => 'Design Pod',
        'avatar' => 'default/avatar.png',
    ]);

    $group->members()->attach([
        $owner->id => ['created_at' => now(), 'updated_at' => now()],
        $member->id => ['created_at' => now(), 'updated_at' => now()],
    ]);

    $response = $this->actingAs($owner)->post(route('messenger.send-message'), [
        'conversation_key' => 'group:' . $group->id,
        'temporaryMsgId' => 'temp_group_1',
        'message' => 'Morning team',
    ]);

    $response->assertOk()
        ->assertJsonPath('conversation_key', 'group:' . $group->id);

    $message = Message::query()->latest('id')->firstOrFail();

    expect($message->group_id)->toBe($group->id);
    expect($message->to_id)->toBeNull();
    expect($message->body)->toBe('Morning team');

    $this->actingAs($member)
        ->get(route('messenger.fetch-messages', ['conversation_key' => 'group:' . $group->id]))
        ->assertOk()
        ->assertJson(fn ($json) => $json
            ->where('last_page', 1)
            ->etc()
        );
});

it('marks a group conversation as seen for the current member', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();

    $group = ChatGroup::create([
        'owner_id' => $owner->id,
        'name' => 'Launch Room',
        'avatar' => 'default/avatar.png',
    ]);

    $group->members()->attach([
        $owner->id => ['created_at' => now(), 'updated_at' => now()],
        $member->id => ['created_at' => now(), 'updated_at' => now()],
    ]);

    $message = Message::create([
        'from_id' => $owner->id,
        'to_id' => null,
        'group_id' => $group->id,
        'body' => 'Check the checklist',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $this->actingAs($member)->post(route('messenger.make-seen'), [
        'conversation_key' => 'group:' . $group->id,
    ])->assertOk();

    $membership = ChatGroupMember::query()
        ->where('chat_group_id', $group->id)
        ->where('user_id', $member->id)
        ->firstOrFail();

    expect($membership->last_read_message_id)->toBe($message->id);
});
