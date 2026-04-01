<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

class CallSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'caller_id',
        'callee_id',
        'call_type',
        'status',
        'accepted_at',
        'ended_at',
        'history_message_id',
        'meta',
    ];

    protected $casts = [
        'caller_id' => 'integer',
        'callee_id' => 'integer',
        'history_message_id' => 'integer',
        'meta' => 'array',
        'accepted_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    public function callee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'callee_id');
    }

    public function historyMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'history_message_id');
    }

    public function participantIds(): array
    {
        $storedParticipantIds = collect(Arr::wrap(data_get($this->meta, 'participant_ids', [])))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (! empty($storedParticipantIds)) {
            return $storedParticipantIds;
        }

        return collect([(int) $this->caller_id, (int) $this->callee_id])
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    public function joinedParticipantIds(): array
    {
        $storedParticipantIds = collect(Arr::wrap(data_get($this->meta, 'joined_participant_ids', [])))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (! empty($storedParticipantIds)) {
            return $storedParticipantIds;
        }

        return $this->status === 'active'
            ? $this->participantIds()
            : collect([(int) $this->caller_id])
                ->filter(fn ($id) => $id > 0)
                ->values()
                ->all();
    }

    public function hasParticipant(int $userId): bool
    {
        return in_array($userId, $this->participantIds(), true);
    }

    public function hasJoinedParticipant(int $userId): bool
    {
        return in_array($userId, $this->joinedParticipantIds(), true);
    }

    public function participantUsers(): Collection
    {
        $participantIds = $this->participantIds();

        if (empty($participantIds)) {
            return collect();
        }

        $usersById = User::query()
            ->whereIn('id', $participantIds)
            ->get(['id', 'name', 'avatar', 'user_name'])
            ->keyBy('id');

        return collect($participantIds)
            ->map(fn ($id) => $usersById->get($id))
            ->filter();
    }

    public function roomTokenFor(int $userId): string
    {
        return hash_hmac(
            'sha256',
            sprintf('call-room|%s|%d', $this->uuid, $userId),
            (string) config('app.key')
        );
    }

    public function hasValidRoomToken(?string $token, int $userId): bool
    {
        if (! $token) {
            return false;
        }

        return hash_equals($this->roomTokenFor($userId), $token);
    }
}
