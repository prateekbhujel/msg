<?php

namespace App\Events;

use App\Models\CallSession;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallGroupInvite implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public CallSession $session,
        public int $invitedUserId,
        public int $fromUserId
    ) {
        $this->session->loadMissing('caller', 'callee');
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('call.user.' . $this->invitedUserId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'CallGroupInvite';
    }

    public function broadcastWith(): array
    {
        return [
            'type' => 'group',
            'callId' => $this->session->uuid,
            'groupCallId' => $this->session->uuid,
            'invitedUserId' => $this->invitedUserId,
            'callerName' => $this->session->caller?->name ?: 'Caller',
            'from_id' => $this->fromUserId,
            'to_id' => $this->invitedUserId,
            'session' => [
                'uuid' => $this->session->uuid,
                'call_type' => $this->session->call_type,
                'status' => $this->session->status,
                'timeout_seconds' => (int) data_get($this->session->historyMessage?->meta, 'timeout_seconds', 30),
                'participant_ids' => $this->session->participantIds(),
                'joined_participant_ids' => $this->session->joinedParticipantIds(),
                'group_call_id' => $this->session->uuid,
                'room_token' => $this->session->roomTokenFor($this->invitedUserId),
                'room_url' => route('calls.room', [
                    'session' => $this->session->uuid,
                    'token' => $this->session->roomTokenFor($this->invitedUserId),
                ]),
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
                'participants' => $this->session->participantUsers()->map(fn ($user) => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar,
                    'user_name' => $user->user_name,
                    'joined' => in_array((int) $user->id, $this->session->joinedParticipantIds(), true),
                ])->values()->all(),
            ],
        ];
    }
}
