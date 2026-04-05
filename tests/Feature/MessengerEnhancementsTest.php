<?php

use App\Events\ConversationThemeUpdated;
use App\Events\MessageSeenUpdated;
use App\Events\TypingIndicatorUpdated;
use App\Models\ConversationSetting;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Event;

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

it('stores conversation theme changes and broadcasts them to the other participant', function () {
    Event::fake([ConversationThemeUpdated::class]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $response = $this->actingAs($sender)->postJson(route('messenger.conversation-theme'), [
        'conversation_key' => 'user:' . $recipient->id,
        'primary_color' => '#16A34A',
        'light_color' => '#F0FDF4',
    ]);

    $response->assertOk()
        ->assertJsonPath('theme.primary', '#16A34A')
        ->assertJsonPath('theme.light', '#F0FDF4');

    $setting = ConversationSetting::query()
        ->where('direct_user_a_id', min($sender->id, $recipient->id))
        ->where('direct_user_b_id', max($sender->id, $recipient->id))
        ->firstOrFail();

    expect($setting->theme_primary)->toBe('#16A34A');
    expect($setting->theme_light)->toBe('#F0FDF4');

    Event::assertDispatched(ConversationThemeUpdated::class, function (ConversationThemeUpdated $event) use ($sender, $recipient) {
        return $event->recipientIds === [$recipient->id]
            && $event->conversationKey === 'user:' . $sender->id
            && $event->primaryColor === '#16A34A'
            && $event->lightColor === '#F0FDF4'
            && $event->updatedById === $sender->id;
    });
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

it('returns visible markup for a plain text message send', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $response = $this->actingAs($sender)->post(route('messenger.send-message'), [
        'conversation_key' => 'user:' . $recipient->id,
        'temporaryMsgId' => 'temp_text_1',
        'message' => 'This should stay visible',
    ]);

    $response->assertOk()
        ->assertJsonPath('tempID', 'temp_text_1')
        ->assertJsonPath('message_id', Message::query()->latest('id')->value('id'));

    expect($response->json('message'))->toContain('This should stay visible');
});

it('broadcasts typing indicators using the recipient conversation key for direct chats', function () {
    Event::fake([TypingIndicatorUpdated::class]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $this->actingAs($sender)->postJson(route('messenger.typing'), [
        'conversation_key' => 'user:' . $recipient->id,
        'typing' => true,
    ])->assertOk();

    Event::assertDispatched(TypingIndicatorUpdated::class, function (TypingIndicatorUpdated $event) use ($sender, $recipient) {
        return $event->recipientIds === [$recipient->id]
            && $event->conversationKey === 'user:' . $sender->id
            && $event->fromId === $sender->id
            && $event->typing === true;
    });
});

it('broadcasts seen updates back to the direct message sender', function () {
    Event::fake([MessageSeenUpdated::class]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $firstMessage = Message::create([
        'from_id' => $sender->id,
        'to_id' => $recipient->id,
        'body' => 'First unread',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $lastMessage = Message::create([
        'from_id' => $sender->id,
        'to_id' => $recipient->id,
        'body' => 'Second unread',
        'message_type' => 'text',
        'seen' => false,
    ]);

    $this->actingAs($recipient)->postJson(route('messenger.make-seen'), [
        'conversation_key' => 'user:' . $sender->id,
    ])->assertOk();

    expect($firstMessage->fresh()->seen)->toBeTrue();
    expect($lastMessage->fresh()->seen)->toBeTrue();

    Event::assertDispatched(MessageSeenUpdated::class, function (MessageSeenUpdated $event) use ($sender, $recipient, $lastMessage) {
        return $event->recipientId === $sender->id
            && $event->conversationKey === 'user:' . $recipient->id
            && $event->viewerId === $recipient->id
            && $event->lastSeenMessageId === $lastMessage->id;
    });
});
