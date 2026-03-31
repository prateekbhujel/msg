<?php

namespace App\Events;

use App\Models\CallSession;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallInvitation implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public CallSession $session)
    {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('call.user.' . $this->session->callee_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'CallInvitation';
    }

    public function broadcastWith(): array
    {
        return [
            'session' => $this->payload(),
            'to_id' => $this->session->callee_id,
            'from_id' => $this->session->caller_id,
        ];
    }

    protected function payload(): array
    {
        return [
            'uuid' => $this->session->uuid,
            'call_type' => $this->session->call_type,
            'status' => $this->session->status,
            'caller' => [
                'id' => $this->session->caller?->id ? (int) $this->session->caller->id : null,
                'name' => $this->session->caller?->name,
                'avatar' => $this->session->caller?->avatar,
                'user_name' => $this->session->caller?->user_name,
            ],
            'callee' => [
                'id' => $this->session->callee?->id ? (int) $this->session->callee->id : null,
                'name' => $this->session->callee?->name,
                'avatar' => $this->session->callee?->avatar,
                'user_name' => $this->session->callee?->user_name,
            ],
        ];
    }
}
