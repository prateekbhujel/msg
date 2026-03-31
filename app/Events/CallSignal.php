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
        $callerId = (int) $this->session->caller_id;
        $calleeId = (int) $this->session->callee_id;
        $fromId = (int) ($this->fromId ?? auth()->id());

        return [
            'type' => $this->type,
            'session' => [
                'uuid' => $this->session->uuid,
                'call_type' => $this->session->call_type,
                'status' => $this->session->status,
                'timeout_seconds' => (int) data_get($this->session->historyMessage?->meta, 'timeout_seconds', 35),
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
            ],
            'payload' => $this->payload,
            'history_message' => $this->historyMessagePayload(),
            'history_message_html' => $this->historyMessageHtml(),
            'from_id' => $fromId,
            'to_id' => $callerId === $fromId ? $calleeId : $callerId,
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
