<?php

use App\Models\Message;
use App\Models\User;

it('stores a reply target for a direct message', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $originalMessage = Message::create([
        'from_id' => $recipient->id,
        'to_id' => $sender->id,
        'body' => 'Can you review this?',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $response = $this->actingAs($sender)->post(route('messenger.send-message'), [
        'id' => $recipient->id,
        'temporaryMsgId' => 'temp_reply_1',
        'message' => 'Already on it',
        'reply_to_id' => $originalMessage->id,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['message', 'tempID']);

    $replyMessage = Message::latest('id')->firstOrFail();

    expect($replyMessage->reply_to_id)->toBe($originalMessage->id);
    expect($response->json('message'))->toContain('message-reply-snippet');
    expect($response->json('message'))->toContain('Can you review this?');
});

it('rejects reply targets from another conversation', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $outsider = User::factory()->create();

    $foreignMessage = Message::create([
        'from_id' => $outsider->id,
        'to_id' => $recipient->id,
        'body' => 'This is not your thread',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $this->actingAs($sender)->postJson(route('messenger.send-message'), [
        'id' => $recipient->id,
        'temporaryMsgId' => 'temp_reply_2',
        'message' => 'Trying to reply',
        'reply_to_id' => $foreignMessage->id,
    ])->assertUnprocessable()->assertJsonValidationErrors(['reply_to_id']);
});

it('toggles direct message reactions for participants', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $message = Message::create([
        'from_id' => $sender->id,
        'to_id' => $recipient->id,
        'body' => 'Looks good',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $this->actingAs($recipient)->postJson(route('messenger.messages.react', $message), [
        'emoji' => '🔥',
    ])->assertOk()->assertJsonPath('reactions.0.emoji', '🔥');

    expect($message->fresh()->reactionMap())->toMatchArray([
        '🔥' => [$recipient->id],
    ]);

    $this->actingAs($recipient)->postJson(route('messenger.messages.react', $message), [
        'emoji' => '🔥',
    ])->assertOk();

    expect($message->fresh()->reactionMap())->toBe([]);
});

it('prevents reactions on call history messages', function () {
    $caller = User::factory()->create();
    $callee = User::factory()->create();

    $callMessage = Message::create([
        'from_id' => $caller->id,
        'to_id' => $callee->id,
        'body' => 'Audio call ended',
        'message_type' => 'call',
        'meta' => [
            'status' => 'ended',
            'call_type' => 'audio',
        ],
        'seen' => false,
    ]);

    $this->actingAs($callee)->postJson(route('messenger.messages.react', $callMessage), [
        'emoji' => '👍',
    ])->assertUnprocessable()->assertJsonValidationErrors(['emoji']);
});
