<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSeenUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $recipientId,
        public string $conversationKey,
        public int $viewerId,
        public int $lastSeenMessageId,
    ) {
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel('message.' . $this->recipientId)];
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_key' => $this->conversationKey,
            'viewer_id' => $this->viewerId,
            'last_seen_message_id' => $this->lastSeenMessageId,
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.seen';
    }
}
