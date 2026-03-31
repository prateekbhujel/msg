<?php

namespace App\Http\Controllers;

use App\Events\CallInvitation;
use App\Events\CallSignal;
use App\Models\CallSession;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class CallController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $authId = $this->authUserId();

        $data = $request->validate([
            'callee_id' => ['required', 'integer', 'exists:users,id'],
            'call_type' => ['required', 'in:audio,video'],
        ]);

        abort_if((int) $data['callee_id'] === $authId, 422, 'You cannot call yourself.');

        $existingSession = CallSession::query()
            ->whereIn('status', ['ringing', 'active'])
            ->where(function ($query) use ($data) {
                $query->where(function ($query) use ($data) {
                    $query->where('caller_id', $this->authUserId())
                        ->where('callee_id', $data['callee_id']);
                })->orWhere(function ($query) use ($data) {
                    $query->where('caller_id', $data['callee_id'])
                        ->where('callee_id', $this->authUserId());
                });
            })
            ->latest('id')
            ->first();

        if ($existingSession && $this->shouldExpireRingingSession($existingSession)) {
            $existingSession = $this->expireRingingSession($existingSession);
        }

        if ($existingSession && ! in_array($existingSession->status, ['ringing', 'active'], true)) {
            $existingSession = null;
        }

        if ($existingSession) {
            $historyMessage = $this->ensureHistoryMessage($existingSession, 'ringing');

            return response()->json([
                'session' => $this->formatSession($existingSession->load(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
                'history_message' => $this->formatHistoryMessage($historyMessage),
                'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
            ]);
        }

        $session = CallSession::create([
            'uuid' => (string) Str::uuid(),
            'caller_id' => $authId,
            'callee_id' => $data['callee_id'],
            'call_type' => $data['call_type'],
            'status' => 'ringing',
        ])->load(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']);

        $historyMessage = $this->ensureHistoryMessage($session, 'ringing');

        CallInvitation::dispatch($session->load(['historyMessage']));

        return response()->json([
            'session' => $this->formatSession($session),
            'history_message' => $this->formatHistoryMessage($historyMessage),
            'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
        ], 201);
    }

    public function accept(CallSession $session): JsonResponse
    {
        $authId = $this->authUserId();

        $this->authorizeParticipant($session);
        abort_unless($authId === (int) $session->callee_id, 403);
        if ($session->status === 'active') {
            return response()->json([
                'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            ]);
        }

        if ($this->shouldExpireRingingSession($session)) {
            $session = $this->expireRingingSession($session);
        }

        if ($session->status === 'missed') {
            abort(409, 'Call was not answered.');
        }

        abort_unless($session->status === 'ringing', 409, 'Call is no longer ringing.');

        $session->update([
            'status' => 'active',
            'accepted_at' => now(),
        ]);

        $historyMessage = $this->ensureHistoryMessage($session, 'active');

        CallSignal::dispatch($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']), 'accepted', [
            'accepted_at' => now()->toIso8601String(),
            'history_message' => $this->formatHistoryMessage($historyMessage),
        ], $authId);

        return response()->json([
            'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            'history_message' => $this->formatHistoryMessage($historyMessage),
            'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
        ]);
    }

    public function decline(CallSession $session): JsonResponse
    {
        $authId = $this->authUserId();

        $this->authorizeParticipant($session);
        abort_unless($authId === (int) $session->callee_id, 403);
        if ($session->status === 'declined') {
            return response()->json([
                'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            ]);
        }

        if ($this->shouldExpireRingingSession($session)) {
            $session = $this->expireRingingSession($session);
        }

        if ($session->status === 'missed') {
            abort(409, 'Call was not answered.');
        }

        abort_unless($session->status === 'ringing', 409, 'Call is no longer ringing.');

        $session->update([
            'status' => 'declined',
            'ended_at' => now(),
        ]);

        $historyMessage = $this->ensureHistoryMessage($session, 'declined', [
            'duration_seconds' => 0,
        ]);

        CallSignal::dispatch($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']), 'declined', [
            'reason' => 'declined',
            'history_message' => $this->formatHistoryMessage($historyMessage),
        ], $authId);

        return response()->json([
            'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            'history_message' => $this->formatHistoryMessage($historyMessage),
            'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
        ]);
    }

    public function signal(Request $request, CallSession $session): JsonResponse
    {
        $authId = $this->authUserId();

        $this->authorizeParticipant($session);
        abort_unless($session->status === 'active', 409, 'Call is not active.');

        $data = $request->validate([
            'signal_type' => ['required', 'string', 'in:offer,answer,candidate'],
            'signal_data' => ['required', 'string'],
        ]);

        $payload = json_decode($data['signal_data'], true);

        CallSignal::dispatch(
            $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']),
            'signal',
            [
                'signal_type' => $data['signal_type'],
                'signal_data' => $payload,
            ],
            $authId
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    public function hangup(CallSession $session): JsonResponse
    {
        $authId = $this->authUserId();

        $this->authorizeParticipant($session);

        if (in_array($session->status, ['ended', 'missed'], true)) {
            $historyMessage = $this->ensureHistoryMessage($session, $session->status);

            return response()->json([
                'ok' => true,
                'history_message' => $this->formatHistoryMessage($historyMessage),
                'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
            ]);
        }

        $finalStatus = $session->accepted_at ? 'ended' : 'missed';
        $durationSeconds = $finalStatus === 'ended' ? $this->callDurationSeconds($session) : 0;

        $session->update([
            'status' => $finalStatus,
            'ended_at' => now(),
        ]);

        $historyMessage = $this->ensureHistoryMessage($session, $finalStatus, [
            'duration_seconds' => $durationSeconds,
            'ended_by_id' => $authId,
        ]);

        CallSignal::dispatch(
            $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']),
            'hangup',
            [
                'reason' => 'hangup',
                'history_message' => $this->formatHistoryMessage($historyMessage),
            ],
            $authId
        );

        return response()->json([
            'ok' => true,
            'history_message' => $this->formatHistoryMessage($historyMessage),
            'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
        ]);
    }

    protected function authorizeParticipant(CallSession $session): void
    {
        $authId = $this->authUserId();

        abort_unless(
            $authId === (int) $session->caller_id || $authId === (int) $session->callee_id,
            403
        );
    }

    protected function formatSession(CallSession $session): array
    {
        return [
            'uuid' => $session->uuid,
            'call_type' => $session->call_type,
            'status' => $session->status,
            'accepted_at' => $session->accepted_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
            'timeout_seconds' => $this->ringTimeoutSeconds(),
            'caller' => [
                'id' => $session->caller?->id ? (int) $session->caller->id : null,
                'name' => $session->caller?->name,
                'avatar' => $session->caller?->avatar,
                'user_name' => $session->caller?->user_name,
            ],
            'callee' => [
                'id' => $session->callee?->id ? (int) $session->callee->id : null,
                'name' => $session->callee?->name,
                'avatar' => $session->callee?->avatar,
                'user_name' => $session->callee?->user_name,
            ],
        ];
    }

    protected function authUserId(): int
    {
        return (int) Auth::id();
    }

    protected function ensureHistoryMessage(CallSession $session, string $status, array $extraMeta = []): Message
    {
        $session->loadMissing('historyMessage');

        $historyMessage = $session->historyMessage ?: new Message();
        $durationSeconds = (int) data_get($extraMeta, 'duration_seconds', 0);

        $historyMessage->from_id = $session->caller_id;
        $historyMessage->to_id = $session->callee_id;
        $historyMessage->message_type = 'call';
        $historyMessage->body = $this->callHistoryBody($session, $status, $durationSeconds);
        $historyMessage->attachment = null;
        $historyMessage->meta = array_merge([
            'session_uuid' => $session->uuid,
            'call_type' => $session->call_type,
            'status' => $status,
            'direction' => 'outgoing',
            'started_at' => $session->accepted_at?->toIso8601String(),
            'accepted_at' => $session->accepted_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
            'duration_seconds' => $durationSeconds,
            'timeout_seconds' => $this->ringTimeoutSeconds(),
        ], $extraMeta);
        $historyMessage->seen = false;
        $historyMessage->save();

        if ($session->history_message_id !== $historyMessage->id) {
            $session->forceFill([
                'history_message_id' => $historyMessage->id,
            ])->save();
        }

        return $historyMessage->fresh();
    }

    protected function callHistoryBody(CallSession $session, string $status, int $durationSeconds = 0): string
    {
        $callType = ucfirst($session->call_type);

        return match ($status) {
            'ringing' => "Calling {$callType}...",
            'active' => "{$callType} call started",
            'declined' => "{$callType} call declined",
            'missed' => "{$callType} call missed",
            default => $durationSeconds > 0
                ? "{$callType} call ended • " . $this->formatDuration($durationSeconds)
                : "{$callType} call ended",
        };
    }

    protected function callDurationSeconds(CallSession $session): int
    {
        $startedAt = $session->accepted_at;
        $endedAt = $session->ended_at ?? now();

        return $startedAt ? $startedAt->diffInSeconds($endedAt) : 0;
    }

    protected function ringTimeoutSeconds(): int
    {
        return 35;
    }

    protected function shouldExpireRingingSession(CallSession $session): bool
    {
        return $session->status === 'ringing'
            && $session->accepted_at === null
            && $session->created_at !== null
            && $session->created_at->diffInSeconds(now()) >= $this->ringTimeoutSeconds();
    }

    protected function expireRingingSession(CallSession $session): CallSession
    {
        $session->update([
            'status' => 'missed',
            'ended_at' => $session->ended_at ?? now(),
        ]);

        $this->ensureHistoryMessage($session, 'missed', [
            'duration_seconds' => 0,
        ]);

        return $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']);
    }

    protected function formatDuration(int $seconds): string
    {
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%02d:%02d:%02d', $hours, $minutes, $remainingSeconds);
        }

        return sprintf('%02d:%02d', $minutes, $remainingSeconds);
    }

    protected function formatHistoryMessage(Message $message): array
    {
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

    protected function renderHistoryMessageHtml(Message $message): string
    {
        return view('messenger.components.message-card', [
            'message' => $message,
        ])->render();
    }
}
