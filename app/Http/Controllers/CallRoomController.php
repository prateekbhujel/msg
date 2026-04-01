<?php

namespace App\Http\Controllers;

use App\Models\CallSession;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CallRoomController extends Controller
{
    public function show(Request $request, CallSession $session)
    {
        $authId = (int) Auth::id();

        abort_unless($session->hasParticipant($authId), 403);
        abort_unless($session->hasValidRoomToken((string) $request->query('token', ''), $authId), 403);

        $session->loadMissing(['caller:id,name,avatar,user_name', 'callee:id,name,avatar,user_name', 'historyMessage']);

        $participants = $session->participantUsers();
        $joinedParticipantIds = $session->joinedParticipantIds();
        $participantPayload = $participants->map(function (User $user) use ($joinedParticipantIds) {
            return [
                'id' => (int) $user->id,
                'name' => $user->name,
                'avatar' => $user->avatar,
                'user_name' => $user->user_name,
                'joined' => in_array((int) $user->id, $joinedParticipantIds, true),
            ];
        })->values();

        $inviteCandidates = User::query()
            ->whereKeyNot($authId)
            ->whereNotIn('id', $session->participantIds())
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'avatar', 'user_name'])
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'avatar' => $user->avatar,
                'user_name' => $user->user_name,
            ])
            ->values();

        return view('call.room', [
            'session' => $session,
            'roomToken' => $session->roomTokenFor($authId),
            'sessionPayload' => [
                'uuid' => $session->uuid,
                'call_type' => $session->call_type,
                'status' => $session->status,
                'timeout_seconds' => (int) data_get($session->historyMessage?->meta, 'timeout_seconds', 30),
                'conversation_key' => data_get($session->meta, 'conversation_key'),
                'participant_ids' => $session->participantIds(),
                'joined_participant_ids' => $joinedParticipantIds,
                'group_call_id' => $session->uuid,
                'is_group' => (bool) data_get($session->meta, 'is_group', false),
                'group' => data_get($session->meta, 'is_group')
                    ? [
                        'id' => (int) data_get($session->meta, 'group_id', 0),
                        'name' => data_get($session->meta, 'group_name'),
                        'avatar' => data_get($session->meta, 'group_avatar', 'default/avatar.png'),
                        'member_count' => (int) data_get($session->meta, 'group_member_count', count($session->participantIds())),
                    ]
                    : null,
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
                'participants' => $participantPayload,
                'room_token' => $session->roomTokenFor($authId),
            ],
            'inviteCandidates' => $inviteCandidates,
        ]);
    }
}
