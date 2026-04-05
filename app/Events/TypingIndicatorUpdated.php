<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TypingIndicatorUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param array<int, int> $recipientIds
     */
    public function __construct(
        public array $recipientIds,
        public string $conversationKey,
        public int $fromId,
        public string $fromName,
        public bool $typing = true,
    ) {
    }

    /**
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return collect($this->recipientIds)
            ->filter(fn ($id) => (int) $id > 0)
            ->unique()
            ->map(fn ($id) => new PrivateChannel('message.' . $id))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_key' => $this->conversationKey,
            'from_id' => $this->fromId,
            'from_name' => $this->fromName,
            'typing' => $this->typing,
        ];
    }

    public function broadcastAs(): string
    {
        return 'typing.indicator';
    }
}
