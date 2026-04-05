<?php

namespace App\Events;

use App\Models\CallSession;
use App\Models\Message as MessageModel;
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
        $this->session->loadMissing('caller', 'callee', 'historyMessage');
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
        $callerId = (int) $this->session->caller_id;
        $calleeId = (int) $this->session->callee_id;
        $fromId = (int) ($this->fromId ?? auth()->id());
        $isRealtimeSignal = $this->type === 'signal';

        return [
            'type' => $this->type,
            'session' => $isRealtimeSignal
                ? $this->compactSessionPayload()
                : $this->fullSessionPayload(),
            'payload' => $this->payload,
            'history_message' => $isRealtimeSignal ? null : $this->historyMessagePayload(),
            'history_message_html' => $isRealtimeSignal ? null : $this->historyMessageHtml(),
            'from_id' => $fromId,
            'to_id' => $callerId === $fromId ? $calleeId : $callerId,
        ];
    }

    protected function compactSessionPayload(): array
    {
        return [
            'uuid' => $this->session->uuid,
            'call_type' => $this->session->call_type,
            'status' => $this->session->status,
            'conversation_key' => data_get($this->session->meta, 'conversation_key'),
            'participant_ids' => $this->session->participantIds(),
            'joined_participant_ids' => $this->session->joinedParticipantIds(),
            'group_call_id' => $this->session->uuid,
            'is_group' => (bool) data_get($this->session->meta, 'is_group', false),
            'group' => data_get($this->session->meta, 'is_group')
                ? [
                    'id' => (int) data_get($this->session->meta, 'group_id', 0),
                    'name' => data_get($this->session->meta, 'group_name'),
                ]
                : null,
        ];
    }

    protected function fullSessionPayload(): array
    {
        return [
            'uuid' => $this->session->uuid,
            'call_type' => $this->session->call_type,
            'status' => $this->session->status,
            'timeout_seconds' => (int) data_get($this->session->historyMessage?->meta, 'timeout_seconds', 30),
            'conversation_key' => data_get($this->session->meta, 'conversation_key'),
            'participant_ids' => $this->session->participantIds(),
            'joined_participant_ids' => $this->session->joinedParticipantIds(),
            'group_call_id' => $this->session->uuid,
            'is_group' => (bool) data_get($this->session->meta, 'is_group', false),
            'group' => data_get($this->session->meta, 'is_group')
                ? [
                    'id' => (int) data_get($this->session->meta, 'group_id', 0),
                    'name' => data_get($this->session->meta, 'group_name'),
                    'avatar' => data_get($this->session->meta, 'group_avatar', 'default/avatar.png'),
                    'member_count' => (int) data_get($this->session->meta, 'group_member_count', count($this->session->participantIds())),
                ]
                : null,
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
        ];
    }

    protected function historyMessagePayload(): ?array
    {
        $message = $this->session->historyMessage;

        if (! $message instanceof MessageModel) {
            return null;
        }

        return [
            'id' => $message->id,
            'body' => $message->body,
            'from_id' => (int) $message->from_id,
            'to_id' => (int) $message->to_id,
            'message_type' => $message->message_type ?? 'text',
            'attachment' => $message->primaryAttachment()['path'] ?? null,
            'attachments' => $message->attachmentItems(),
            'meta' => $message->meta ?? [],
            'seen' => (bool) $message->seen,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    protected function historyMessageHtml(): ?string
    {
        $message = $this->session->historyMessage;

        if (! $message instanceof MessageModel) {
            return null;
        }

        return view('messenger.components.message-card', [
            'message' => $message,
        ])->render();
    }
}
