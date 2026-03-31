<?php

namespace App\Events;

use App\Models\CallSession;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallSignal implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public CallSession $session,
        public string $type,
        public array $payload = [],
        public ?int $fromId = null
    ) {
        $this->session->loadMissing('caller', 'callee');
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('call.session.' . $this->session->uuid),
        ];
    }

    public function broadcastAs(): string
    {
        return 'CallSignal';
    }

    public function broadcastWith(): array
    {
        return [
            'type' => $this->type,
            'session' => [
                'uuid' => $this->session->uuid,
                'call_type' => $this->session->call_type,
                'status' => $this->session->status,
                'caller' => [
                    'id' => $this->session->caller?->id,
                    'name' => $this->session->caller?->name,
                    'avatar' => $this->session->caller?->avatar,
                    'user_name' => $this->session->caller?->user_name,
                ],
                'callee' => [
                    'id' => $this->session->callee?->id,
                    'name' => $this->session->callee?->name,
                    'avatar' => $this->session->callee?->avatar,
                    'user_name' => $this->session->callee?->user_name,
                ],
            ],
            'payload' => $this->payload,
            'from_id' => $this->fromId ?? auth()->id(),
            'to_id' => $this->session->caller_id === ($this->fromId ?? auth()->id())
                ? $this->session->callee_id
                : $this->session->caller_id,
        ];
    }
}
