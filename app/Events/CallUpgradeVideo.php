<?php

namespace App\Events;

use App\Models\CallSession;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallUpgradeVideo implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public CallSession $session,
        public int $fromUserId
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
        return 'CallUpgradeVideo';
    }

    public function broadcastWith(): array
    {
        return [
            'callId' => $this->session->uuid,
            'fromUserId' => $this->fromUserId,
            'session' => [
                'uuid' => $this->session->uuid,
                'call_type' => $this->session->call_type,
                'status' => $this->session->status,
                'participant_ids' => $this->session->participantIds(),
                'joined_participant_ids' => $this->session->joinedParticipantIds(),
            ],
        ];
    }
}
