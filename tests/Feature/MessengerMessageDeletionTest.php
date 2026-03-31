<?php

use App\Models\Message;
use App\Models\User;

it('prevents deleting a call log message', function () {
    $caller = User::factory()->create();
    $callee = User::factory()->create();

    $callMessage = Message::create([
        'from_id' => $caller->id,
        'to_id' => $callee->id,
        'body' => 'Video call ended',
        'message_type' => 'call',
        'meta' => [
            'status' => 'ended',
            'call_type' => 'video',
            'duration_seconds' => 75,
        ],
        'seen' => false,
    ]);

    $this->actingAs($callee)->deleteJson(route('messenger.delete-message'), [
        'message_id' => $callMessage->id,
    ])->assertForbidden();

    $this->assertDatabaseHas('messages', [
        'id' => $callMessage->id,
    ]);
});

it('keeps normal message deletion restricted to the sender', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $message = Message::create([
        'from_id' => $sender->id,
        'to_id' => $recipient->id,
        'body' => 'Hello there',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $this->actingAs($recipient)->deleteJson(route('messenger.delete-message'), [
        'message_id' => $message->id,
    ])->assertForbidden();

    $this->assertDatabaseHas('messages', [
        'id' => $message->id,
    ]);
});
