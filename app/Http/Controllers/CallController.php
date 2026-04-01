<?php

namespace App\Http\Controllers;

use App\Events\CallGroupInvite;
use App\Events\CallInvitation;
use App\Events\CallSignal;
use App\Events\CallUpgradeVideo;
use App\Models\CallSession;
use App\Models\ChatGroup;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CallController extends Controller
{
    protected const MAX_GROUP_CALL_PARTICIPANTS = 8;

    public function store(Request $request): JsonResponse
    {
        $authId = $this->authUserId();

        $data = $request->validate([
            'callee_id' => ['required_without:group_id', 'nullable', 'integer', 'exists:users,id'],
            'group_id' => ['required_without:callee_id', 'nullable', 'integer', 'exists:chat_groups,id'],
            'call_type' => ['required', 'in:audio,video'],
            'conversation_key' => ['nullable', 'string'],
        ]);

        $group = $this->resolveCallGroup($data['group_id'] ?? null, $authId);
        $conversationKey = trim((string) $request->string('conversation_key'));
        $isGroupCall = $group instanceof ChatGroup;

        if ($isGroupCall) {
            $conversationKey = $group->conversationKey();
        }

        if (! $isGroupCall) {
            abort_if((int) $data['callee_id'] === $authId, 422, 'You cannot call yourself.');
        }

        $existingSession = $isGroupCall
            ? CallSession::query()
                ->whereIn('status', ['ringing', 'active'])
                ->where('meta->conversation_key', $conversationKey)
                ->latest('id')
                ->first()
            : CallSession::query()
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

        if ($isGroupCall) {
            $participantIds = $this->groupParticipantIds($group, $authId);
            $primaryInviteeId = collect($participantIds)
                ->first(fn ($id) => (int) $id !== $authId);

            abort_unless($primaryInviteeId, 422, 'Choose at least one other group member before starting a call.');

            $session = CallSession::create([
                'uuid' => (string) Str::uuid(),
                'caller_id' => $authId,
                'callee_id' => (int) $primaryInviteeId,
                'call_type' => $data['call_type'],
                'status' => 'ringing',
                'meta' => array_merge(
                    $this->buildSessionMeta($participantIds, [$authId], $conversationKey),
                    $this->groupCallMeta($group)
                ),
            ])->load(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']);

            $historyMessage = $this->ensureHistoryMessage($session, 'ringing');
            $freshSession = $session->load(['historyMessage']);

            collect($participantIds)
                ->reject(fn ($participantId) => (int) $participantId === $authId)
                ->each(fn ($participantId) => CallGroupInvite::dispatch($freshSession, (int) $participantId, $authId));

            return response()->json([
                'session' => $this->formatSession($freshSession),
                'history_message' => $this->formatHistoryMessage($historyMessage),
                'history_message_html' => $this->renderHistoryMessageHtml($historyMessage),
            ], 201);
        }

        $session = CallSession::create([
            'uuid' => (string) Str::uuid(),
            'caller_id' => $authId,
            'callee_id' => $data['callee_id'],
            'call_type' => $data['call_type'],
            'status' => 'ringing',
            'meta' => $this->buildSessionMeta(
                [$authId, (int) $data['callee_id']],
                [$authId],
                $conversationKey
            ),
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
        $isGroupCall = $this->isGroupSession($session);

        $this->authorizeParticipant($session);

        if ($session->status === 'active') {
            $participantJoined = $this->markParticipantJoined($session, $authId);

            if ($participantJoined) {
                CallSignal::dispatch(
                    $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']),
                    'group_participant_joined',
                    [
                        'joined_user_id' => $authId,
                        'joined_participant_ids' => $session->fresh()->joinedParticipantIds(),
                    ],
                    $authId
                );
            }

            return response()->json([
                'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            ]);
        }

        abort_unless(
            $isGroupCall
                ? $authId !== (int) $session->caller_id
                : $authId === (int) $session->callee_id,
            403
        );

        if ($this->shouldExpireRingingSession($session)) {
            $session = $this->expireRingingSession($session);
        }

        if ($session->status === 'missed') {
            abort(409, 'Call was not answered.');
        }

        abort_unless($session->status === 'ringing', 409, 'Call is no longer ringing.');

        $joinedParticipantIds = $isGroupCall
            ? collect([(int) $session->caller_id, $authId])
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all()
            : collect([(int) $session->caller_id, (int) $session->callee_id])
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all();

        $session->update([
            'status' => 'active',
            'accepted_at' => now(),
            'meta' => $this->mergeSessionMeta($session, [
                'joined_participant_ids' => $joinedParticipantIds,
            ]),
        ]);

        $historyMessage = $this->ensureHistoryMessage($session, 'active');

        CallSignal::dispatch($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']), 'accepted', [
            'accepted_at' => now()->toIso8601String(),
            'history_message' => $this->formatHistoryMessage($historyMessage),
            'joined_participant_ids' => $session->fresh()->joinedParticipantIds(),
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
        $isGroupCall = $this->isGroupSession($session);

        $this->authorizeParticipant($session);
        abort_unless(
            $isGroupCall
                ? $authId !== (int) $session->caller_id
                : $authId === (int) $session->callee_id,
            403
        );
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

        if ($isGroupCall) {
            $remainingParticipantIds = collect($session->participantIds())
                ->reject(fn ($id) => (int) $id === $authId)
                ->values()
                ->all();

            $remainingJoinedIds = collect($session->joinedParticipantIds())
                ->reject(fn ($id) => (int) $id === $authId)
                ->values()
                ->all();

            if (count($remainingParticipantIds) > 1) {
                $session->update([
                    'meta' => $this->mergeSessionMeta($session, [
                        'participant_ids' => $remainingParticipantIds,
                        'joined_participant_ids' => $remainingJoinedIds,
                    ]),
                ]);

                CallSignal::dispatch(
                    $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']),
                    'group_participant_left',
                    [
                        'left_user_id' => $authId,
                        'participant_ids' => $remainingParticipantIds,
                        'joined_participant_ids' => $remainingJoinedIds,
                        'reason' => 'declined',
                    ],
                    $authId
                );

                return response()->json([
                    'ok' => true,
                    'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
                ]);
            }
        }

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
            'signal_type' => ['required', 'string', 'in:offer,answer,candidate,screen_share_state'],
            'signal_data' => ['required', 'string'],
            'target_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $payload = json_decode($data['signal_data'], true);
        $targetUserId = (int) ($data['target_user_id'] ?? 0);

        if ($targetUserId > 0 && ! $session->hasParticipant($targetUserId)) {
            throw ValidationException::withMessages([
                'target_user_id' => 'The selected participant is not part of this call.',
            ]);
        }

        CallSignal::dispatch(
            $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']),
            'signal',
            [
                'signal_type' => $data['signal_type'],
                'signal_data' => $payload,
                'target_user_id' => $targetUserId > 0 ? $targetUserId : null,
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

        if ($session->status === 'active' && count($session->joinedParticipantIds()) > 2) {
            $remainingParticipantIds = collect($session->participantIds())
                ->reject(fn ($id) => (int) $id === $authId)
                ->values()
                ->all();
            $remainingJoinedIds = collect($session->joinedParticipantIds())
                ->reject(fn ($id) => (int) $id === $authId)
                ->values()
                ->all();

            if (count($remainingJoinedIds) >= 2) {
                $session->update([
                    'meta' => $this->mergeSessionMeta($session, [
                        'participant_ids' => $remainingParticipantIds,
                        'joined_participant_ids' => $remainingJoinedIds,
                    ]),
                ]);

                CallSignal::dispatch(
                    $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']),
                    'group_participant_left',
                    [
                        'left_user_id' => $authId,
                        'participant_ids' => $remainingParticipantIds,
                        'joined_participant_ids' => $remainingJoinedIds,
                    ],
                    $authId
                );

                return response()->json([
                    'ok' => true,
                    'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
                ]);
            }
        }

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
            $session->hasParticipant($authId),
            403
        );
    }

    public function groupInvite(Request $request, CallSession $session): JsonResponse
    {
        $authId = $this->authUserId();

        $this->authorizeParticipant($session);
        abort_unless($session->status === 'active', 409, 'Start the call before inviting more people.');

        $data = $request->validate([
            'user_ids' => ['required_without:user_id', 'array', 'min:1'],
            'user_ids.*' => ['required', 'integer', 'exists:users,id', 'distinct'],
            'user_id' => ['required_without:user_ids', 'integer', 'exists:users,id'],
        ]);

        $requestedUserIds = collect($data['user_ids'] ?? [$data['user_id'] ?? null])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0 && $id !== $authId)
            ->unique()
            ->values();

        $existingParticipantIds = $session->participantIds();
        $availableSlots = max(0, self::MAX_GROUP_CALL_PARTICIPANTS - count($existingParticipantIds));

        if ($availableSlots === 0) {
            throw ValidationException::withMessages([
                'user_ids' => 'This call already has the maximum number of participants.',
            ]);
        }

        $invitedUserIds = $requestedUserIds
            ->reject(fn ($id) => in_array($id, $existingParticipantIds, true))
            ->take($availableSlots)
            ->values();

        if ($invitedUserIds->isEmpty()) {
            throw ValidationException::withMessages([
                'user_ids' => 'Choose someone who is not already in the call.',
            ]);
        }

        $participantIds = collect($existingParticipantIds)
            ->concat($invitedUserIds)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $session->update([
            'meta' => $this->mergeSessionMeta($session, [
                'participant_ids' => $participantIds,
            ]),
        ]);

        $freshSession = $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']);

        foreach ($invitedUserIds as $invitedUserId) {
            CallGroupInvite::dispatch($freshSession, (int) $invitedUserId, $authId);
        }

        return response()->json([
            'ok' => true,
            'session' => $this->formatSession($freshSession),
            'invited_user_ids' => $invitedUserIds->all(),
        ]);
    }

    public function upgradeToVideo(CallSession $session): JsonResponse
    {
        $authId = $this->authUserId();

        $this->authorizeParticipant($session);
        abort_unless($session->status === 'active', 409, 'Call is not active.');

        if ($session->call_type !== 'video') {
            $session->update([
                'call_type' => 'video',
                'meta' => $this->mergeSessionMeta($session, [
                    'call_mode' => 'video',
                    'upgraded_to_video_at' => now()->toIso8601String(),
                ]),
            ]);
        }

        $freshSession = $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']);
        CallUpgradeVideo::dispatch($freshSession, $authId);

        return response()->json([
            'ok' => true,
            'session' => $this->formatSession($freshSession),
        ]);
    }

    protected function formatSession(CallSession $session): array
    {
        $participantUsers = $session->participantUsers();
        $joinedParticipantIds = $session->joinedParticipantIds();
        $authId = $this->authUserId();
        $groupPayload = $this->sessionGroupPayload($session);

        return [
            'uuid' => $session->uuid,
            'call_type' => $session->call_type,
            'status' => $session->status,
            'accepted_at' => $session->accepted_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
            'timeout_seconds' => $this->ringTimeoutSeconds(),
            'conversation_key' => data_get($session->meta, 'conversation_key'),
            'participant_ids' => $session->participantIds(),
            'joined_participant_ids' => $joinedParticipantIds,
            'group_call_id' => $session->uuid,
            'is_group' => $this->isGroupSession($session),
            'group' => $groupPayload,
            'room_token' => $session->roomTokenFor($authId),
            'room_url' => route('calls.room', [
                'session' => $session->uuid,
                'token' => $session->roomTokenFor($authId),
            ]),
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
            'participants' => $participantUsers->map(fn (User $user) => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'avatar' => $user->avatar,
                'user_name' => $user->user_name,
                'joined' => in_array((int) $user->id, $joinedParticipantIds, true),
            ])->values()->all(),
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
        $groupPayload = $this->sessionGroupPayload($session);

        $historyMessage->from_id = $session->caller_id;
        $historyMessage->to_id = $groupPayload ? null : $session->callee_id;
        $historyMessage->group_id = $groupPayload['id'] ?? null;
        $historyMessage->message_type = 'call';
        $historyMessage->body = $this->callHistoryBody($session, $status, $durationSeconds);
        $historyMessage->attachment = null;
        $historyMessage->meta = array_merge([
            'session_uuid' => $session->uuid,
            'call_type' => $session->call_type,
            'status' => $status,
            'direction' => 'outgoing',
            'conversation_key' => data_get($session->meta, 'conversation_key'),
            'is_group' => $groupPayload !== null,
            'group_id' => $groupPayload['id'] ?? null,
            'started_at' => $session->accepted_at?->toIso8601String(),
            'accepted_at' => $session->accepted_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
            'duration_seconds' => $durationSeconds,
            'timeout_seconds' => $this->ringTimeoutSeconds(),
            'participant_ids' => $session->participantIds(),
            'joined_participant_ids' => $session->joinedParticipantIds(),
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
        return 30;
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
            'group_id' => (int) ($message->group_id ?? 0),
            'conversation_key' => $message->conversationKey(),
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

    protected function buildSessionMeta(array $participantIds, array $joinedParticipantIds = [], ?string $conversationKey = null): array
    {
        $meta = [
            'participant_ids' => collect($participantIds)
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all(),
            'joined_participant_ids' => collect($joinedParticipantIds)
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all(),
        ];

        if ($conversationKey) {
            $meta['conversation_key'] = $conversationKey;
        }

        return $meta;
    }

    protected function mergeSessionMeta(CallSession $session, array $changes): array
    {
        $meta = $session->meta ?? [];

        foreach ($changes as $key => $value) {
            if ($value === null || $value === []) {
                unset($meta[$key]);
                continue;
            }

            $meta[$key] = $value;
        }

        return empty($meta) ? [] : $meta;
    }

    protected function resolveCallGroup(mixed $groupId, int $authId): ?ChatGroup
    {
        $safeGroupId = (int) $groupId;

        if ($safeGroupId < 1) {
            return null;
        }

        return ChatGroup::query()
            ->with('members:id')
            ->whereKey($safeGroupId)
            ->whereHas('members', fn ($query) => $query->where('users.id', $authId))
            ->firstOrFail();
    }

    protected function groupParticipantIds(ChatGroup $group, int $authId): array
    {
        return $group->members()
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->prepend($authId)
            ->unique()
            ->take(self::MAX_GROUP_CALL_PARTICIPANTS)
            ->values()
            ->all();
    }

    protected function groupCallMeta(ChatGroup $group): array
    {
        return [
            'is_group' => true,
            'group_id' => (int) $group->id,
            'group_name' => $group->name,
            'group_avatar' => $group->avatarPath(),
            'group_member_count' => $group->memberCount(),
        ];
    }

    protected function isGroupSession(CallSession $session): bool
    {
        return (bool) data_get($session->meta, 'is_group', false)
            || str_starts_with((string) data_get($session->meta, 'conversation_key', ''), 'group:');
    }

    protected function sessionGroupPayload(CallSession $session): ?array
    {
        if (! $this->isGroupSession($session)) {
            return null;
        }

        $groupId = (int) data_get($session->meta, 'group_id', 0);

        return [
            'id' => $groupId > 0 ? $groupId : null,
            'name' => data_get($session->meta, 'group_name', 'Group call'),
            'avatar' => data_get($session->meta, 'group_avatar', 'default/avatar.png'),
            'member_count' => (int) data_get($session->meta, 'group_member_count', count($session->participantIds())),
        ];
    }

    protected function markParticipantJoined(CallSession $session, int $userId): bool
    {
        $joinedParticipantIds = collect($session->joinedParticipantIds())
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique();

        if ($joinedParticipantIds->contains($userId)) {
            return false;
        }

        $joinedParticipantIds = $joinedParticipantIds
            ->push($userId)
            ->unique()
            ->values()
            ->all();

        $session->update([
            'meta' => $this->mergeSessionMeta($session, [
                'joined_participant_ids' => $joinedParticipantIds,
            ]),
        ]);

        return true;
    }
}
