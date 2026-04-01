<?php

use App\Models\ConversationSetting;
use App\Models\Message;
use App\Models\User;

it('returns smart reply suggestions using the AI endpoint', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $response = $this->actingAs($sender)->postJson(route('messenger.smart-reply'), [
        'text' => 'thank you for helping out',
    ]);

    $response->assertOk()
        ->assertJsonCount(3, 'suggestions');

    expect($response->json('suggestions'))->toContain('No problem!');
});

it('returns a tone classification for the composer vibe check', function () {
    $sender = User::factory()->create();

    $this->actingAs($sender)->postJson(route('messenger.message-tone'), [
        'text' => 'I love this, great job',
    ])->assertOk()->assertJsonPath('tone', 'positive');
});

it('searches within the current conversation using decrypted message text', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    Message::create([
        'from_id' => $recipient->id,
        'to_id' => $sender->id,
        'body' => 'Project phoenix ships tomorrow morning',
        'message_type' => 'text',
        'seen' => false,
    ]);

    Message::create([
        'from_id' => $sender->id,
        'to_id' => $recipient->id,
        'body' => 'Different thread preview',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $response = $this->actingAs($sender)->postJson(route('messenger.conversation-search'), [
        'conversation_key' => 'user:' . $recipient->id,
        'q' => 'phoenix',
    ]);

    $response->assertOk()
        ->assertJsonCount(1, 'results');

    expect($response->json('results.0.preview'))->toContain('<mark>phoenix</mark>');
});

it('stores disappearing message settings and applies expiry metadata to new messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $this->actingAs($sender)->postJson(route('messenger.conversation-disappearing'), [
        'conversation_key' => 'user:' . $recipient->id,
        'disappear_after' => '24h',
    ])->assertOk()->assertJsonPath('disappear_after', '24h');

    expect(ConversationSetting::query()->where('direct_user_a_id', min($sender->id, $recipient->id))
        ->where('direct_user_b_id', max($sender->id, $recipient->id))
        ->value('disappear_after'))->toBe('24h');

    $this->actingAs($sender)->post(route('messenger.send-message'), [
        'conversation_key' => 'user:' . $recipient->id,
        'temporaryMsgId' => 'temp_disappear_1',
        'message' => 'This expires soon',
    ])->assertOk();

    $message = Message::query()->latest('id')->firstOrFail();

    expect(data_get($message->meta, 'expires_at'))->not->toBeNull();
});

it('normalizes emoji shortcuts and stores a lightweight language hint on send', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $this->actingAs($sender)->post(route('messenger.send-message'), [
        'conversation_key' => 'user:' . $recipient->id,
        'temporaryMsgId' => 'temp_lang_1',
        'message' => 'hajur kasto cha :)',
    ])->assertOk();

    $message = Message::query()->latest('id')->firstOrFail();

    expect($message->body)->toContain('😊');
    expect(data_get($message->meta, 'language'))->toBe('ne');
});
