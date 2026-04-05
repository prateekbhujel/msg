<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationThemeUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param array<int, int> $recipientIds
     */
    public function __construct(
        public array $recipientIds,
        public string $conversationKey,
        public string $primaryColor,
        public string $lightColor,
        public int $updatedById,
    ) {
    }

    public function broadcastOn(): array
    {
        return collect($this->recipientIds)
            ->filter(fn ($id) => (int) $id > 0)
            ->unique()
            ->map(fn ($id) => new PrivateChannel('message.' . $id))
            ->values()
            ->all();
    }

    public function broadcastAs(): string
    {
        return 'conversation.theme-updated';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_key' => $this->conversationKey,
            'theme' => [
                'primary' => $this->primaryColor,
                'light' => $this->lightColor,
            ],
            'updated_by_id' => $this->updatedById,
        ];
    }
}
