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
                'conversation_key' => data_get($this->session->meta, 'conversation_key'),
                'participant_ids' => $this->session->participantIds(),
                'joined_participant_ids' => $this->session->joinedParticipantIds(),
                'is_group' => (bool) data_get($this->session->meta, 'is_group', false),
                'group' => data_get($this->session->meta, 'is_group')
                    ? [
                        'id' => (int) data_get($this->session->meta, 'group_id', 0),
                        'name' => data_get($this->session->meta, 'group_name'),
                        'avatar' => data_get($this->session->meta, 'group_avatar', 'default/avatar.png'),
                        'member_count' => (int) data_get($this->session->meta, 'group_member_count', count($this->session->participantIds())),
                    ]
                    : null,
            ],
        ];
    }
}
