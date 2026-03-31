<?php

namespace App\Http\Controllers;

use App\Events\CallInvitation;
use App\Events\CallSignal;
use App\Models\CallSession;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class CallController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'callee_id' => ['required', 'integer', 'exists:users,id'],
            'call_type' => ['required', 'in:audio,video'],
        ]);

        abort_if((int) $data['callee_id'] === Auth::id(), 422, 'You cannot call yourself.');

        $existingSession = CallSession::query()
            ->whereIn('status', ['ringing', 'active'])
            ->where(function ($query) use ($data) {
                $query->where(function ($query) use ($data) {
                    $query->where('caller_id', Auth::id())
                        ->where('callee_id', $data['callee_id']);
                })->orWhere(function ($query) use ($data) {
                    $query->where('caller_id', $data['callee_id'])
                        ->where('callee_id', Auth::id());
                });
            })
            ->latest('id')
            ->first();

        if ($existingSession) {
            return response()->json([
                'session' => $this->formatSession($existingSession->load(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            ]);
        }

        $session = CallSession::create([
            'uuid' => (string) Str::uuid(),
            'caller_id' => Auth::id(),
            'callee_id' => $data['callee_id'],
            'call_type' => $data['call_type'],
            'status' => 'ringing',
        ])->load(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']);

        CallInvitation::dispatch($session);

        return response()->json([
            'session' => $this->formatSession($session),
        ], 201);
    }

    public function accept(CallSession $session): JsonResponse
    {
        $this->authorizeParticipant($session);
        abort_unless(Auth::id() === $session->callee_id, 403);
        if ($session->status === 'active') {
            return response()->json([
                'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            ]);
        }

        abort_unless($session->status === 'ringing', 409, 'Call is no longer ringing.');

        $session->update([
            'status' => 'active',
            'accepted_at' => now(),
        ]);

        CallSignal::dispatch($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']), 'accepted', [
            'accepted_at' => now()->toIso8601String(),
        ], Auth::id());

        return response()->json([
            'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
        ]);
    }

    public function decline(CallSession $session): JsonResponse
    {
        $this->authorizeParticipant($session);
        abort_unless(Auth::id() === $session->callee_id, 403);
        if ($session->status === 'declined') {
            return response()->json([
                'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
            ]);
        }

        abort_unless($session->status === 'ringing', 409, 'Call is no longer ringing.');

        $session->update([
            'status' => 'declined',
            'ended_at' => now(),
        ]);

        CallSignal::dispatch($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']), 'declined', [
            'reason' => 'declined',
        ], Auth::id());

        return response()->json([
            'session' => $this->formatSession($session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name'])),
        ]);
    }

    public function signal(Request $request, CallSession $session): JsonResponse
    {
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
            Auth::id()
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    public function hangup(CallSession $session): JsonResponse
    {
        $this->authorizeParticipant($session);

        if ($session->status === 'ended') {
            return response()->json([
                'ok' => true,
            ]);
        }

        $session->update([
            'status' => 'ended',
            'ended_at' => now(),
        ]);

        CallSignal::dispatch(
            $session->fresh(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name']),
            'hangup',
            [
                'reason' => 'hangup',
            ],
            Auth::id()
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    protected function authorizeParticipant(CallSession $session): void
    {
        abort_unless(
            Auth::id() === $session->caller_id || Auth::id() === $session->callee_id,
            403
        );
    }

    protected function formatSession(CallSession $session): array
    {
        return [
            'uuid' => $session->uuid,
            'call_type' => $session->call_type,
            'status' => $session->status,
            'caller' => [
                'id' => $session->caller?->id,
                'name' => $session->caller?->name,
                'avatar' => $session->caller?->avatar,
                'user_name' => $session->caller?->user_name,
            ],
            'callee' => [
                'id' => $session->callee?->id,
                'name' => $session->callee?->name,
                'avatar' => $session->callee?->avatar,
                'user_name' => $session->callee?->user_name,
            ],
        ];
    }
}
