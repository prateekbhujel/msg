<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'from_id',
        'to_id',
        'group_id',
        'body',
        'attachment',
        'message_type',
        'meta',
        'reply_to_id',
        'seen',
    ];

    protected $casts = [
        'attachment' => 'array',
        'meta' => 'array',
        'seen' => 'boolean',
    ];

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ChatGroup::class, 'group_id');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_id');
    }
    /**
     * Encrypt the message body before saving to the database.
     *
     * @param string $value The message body to be encrypted.
     * @return void
    */
    public function setBodyAttribute($value)
    {
        $this->attributes['body'] = $value ? Crypt::encrypt($value) : null;

    }//End Method

    /**
     * Decrypt the message body after retrieving from the database.
     *
     * @param string $value The encrypted message body to be decrypted.
     * @return string|null The decrypted message body, or null if the value is null.
    */
    public function getBodyAttribute($value)
    {
        return $value ? Crypt::decrypt($value) : null;

    } //End Method

    public function attachmentItems(): array
    {
        $attachments = $this->attachment;

        if (empty($attachments)) {
            return [];
        }

        if (is_string($attachments)) {
            $decoded = json_decode($attachments, true);

            if (json_last_error() === JSON_ERROR_NONE) {
                $attachments = $decoded;
            }
        }

        if (is_string($attachments)) {
            $attachments = [
                ['path' => $attachments],
            ];
        }

        return collect(Arr::wrap($attachments))
            ->map(fn ($attachment) => $this->normalizeAttachment($attachment))
            ->filter()
            ->values()
            ->all();
    }

    public function hasAttachments(): bool
    {
        return count($this->attachmentItems()) > 0;
    }

    public function primaryAttachment(): ?array
    {
        return $this->attachmentItems()[0] ?? null;
    }

    public function isCallMessage(): bool
    {
        return ($this->message_type ?? 'text') === 'call';
    }

    public function isGroupMessage(): bool
    {
        return (int) ($this->group_id ?? 0) > 0;
    }

    public function conversationKey(): string
    {
        return $this->isGroupMessage()
            ? 'group:' . (int) $this->group_id
            : 'user:' . (int) $this->conversationPartnerId();
    }

    public function conversationPartnerId(): int
    {
        return (int) ($this->to_id ?: $this->from_id);
    }

    public function isParticipant(int $userId): bool
    {
        if ($this->isGroupMessage()) {
            if ($this->relationLoaded('group') && $this->group) {
                if ($this->group->relationLoaded('members')) {
                    return $this->group->members->contains('id', $userId);
                }

                return $this->group->members()->where('users.id', $userId)->exists();
            }

            return ChatGroupMember::query()
                ->where('chat_group_id', (int) $this->group_id)
                ->where('user_id', $userId)
                ->exists();
        }

        return (int) $this->from_id === $userId || (int) $this->to_id === $userId;
    }

    public function canBeDeletedBy(int $userId): bool
    {
        if ($this->isCallMessage()) {
            return false;
        }

        return (int) $this->from_id === $userId;
    }

    public function isVoiceMessage(): bool
    {
        return ($this->message_type ?? 'text') === 'voice';
    }

    public function supportsInteractions(): bool
    {
        return ! $this->isCallMessage();
    }

    public function broadcastRecipientIds(): array
    {
        if ($this->isGroupMessage()) {
            $members = $this->relationLoaded('group') && $this->group
                ? ($this->group->relationLoaded('members')
                    ? $this->group->members
                    : $this->group->members()->get(['users.id']))
                : User::query()
                    ->select('users.id')
                    ->join('chat_group_members', 'chat_group_members.user_id', '=', 'users.id')
                    ->where('chat_group_members.chat_group_id', (int) $this->group_id)
                    ->get();

            return collect($members)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all();
        }

        return collect([(int) $this->from_id, (int) $this->to_id])
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    public function callStatus(): string
    {
        return (string) data_get($this->meta, 'status', 'ended');
    }

    public function callDurationSeconds(): int
    {
        return (int) data_get($this->meta, 'duration_seconds', 0);
    }

    public function callDurationLabel(): string
    {
        return $this->formatDurationLabel($this->callDurationSeconds());
    }

    public function voiceNoteDurationSeconds(): int
    {
        return (int) data_get($this->meta, 'duration_seconds', 0);
    }

    public function voiceNoteDurationLabel(): string
    {
        $seconds = $this->voiceNoteDurationSeconds();

        return $seconds > 0 ? $this->formatDurationLabel($seconds) : '';
    }

    public function replySnippet(): string
    {
        if ($this->isCallMessage()) {
            return ucfirst((string) data_get($this->meta, 'call_type', 'video')) . ' call';
        }

        if ($this->isVoiceMessage()) {
            $durationLabel = $this->voiceNoteDurationLabel();

            return 'Voice note' . ($durationLabel ? ' · ' . $durationLabel : '');
        }

        if ($this->body) {
            return Str::limit(trim(preg_replace('/\s+/', ' ', $this->body) ?: ''), 72, '…');
        }

        if ($this->hasAttachments()) {
            return Str::ucfirst($this->attachmentSummary());
        }

        return 'Message';
    }

    public function replyAuthorLabel(int $viewerId): string
    {
        if ((int) $this->from_id === $viewerId) {
            return 'You';
        }

        return $this->fromUser?->name ?: 'Reply';
    }

    public function replyPreviewPayload(?int $viewerId = null): ?array
    {
        $reply = $this->relationLoaded('replyTo') ? $this->replyTo : $this->replyTo()->with('fromUser:id,name')->first();

        if (! $reply) {
            return null;
        }

        return [
            'id' => (int) $reply->id,
            'from_id' => (int) $reply->from_id,
            'message_type' => $reply->message_type ?? 'text',
            'snippet' => $reply->replySnippet(),
            'sender_name' => $reply->fromUser?->name,
            'sender_label' => $viewerId !== null
                ? $reply->replyAuthorLabel($viewerId)
                : ($reply->fromUser?->name ?: 'Reply'),
        ];
    }

    public function reactionMap(): array
    {
        $rawReactions = data_get($this->meta, 'reactions', []);

        if (! is_array($rawReactions)) {
            return [];
        }

        return collect($rawReactions)
            ->mapWithKeys(function ($userIds, $emoji) {
                $sanitizedIds = collect(Arr::wrap($userIds))
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->unique()
                    ->values()
                    ->all();

                return count($sanitizedIds) > 0 ? [$emoji => $sanitizedIds] : [];
            })
            ->all();
    }

    public function reactionSummary(?int $viewerId = null): array
    {
        return collect($this->reactionMap())
            ->map(fn (array $userIds, string $emoji) => [
                'emoji' => $emoji,
                'count' => count($userIds),
                'reacted' => $viewerId !== null && in_array($viewerId, $userIds, true),
            ])
            ->values()
            ->all();
    }

    public function toggleReaction(string $emoji, int $userId): array
    {
        $emoji = trim($emoji);
        $reactions = collect($this->reactionMap());
        $userIds = collect($reactions->get($emoji, []));

        if ($userIds->contains($userId)) {
            $userIds = $userIds->reject(fn ($id) => (int) $id === $userId)->values();
        } else {
            $userIds->push($userId);
        }

        if ($userIds->isEmpty()) {
            $reactions->forget($emoji);
        } else {
            $reactions->put($emoji, $userIds->map(fn ($id) => (int) $id)->unique()->values()->all());
        }

        $meta = $this->meta ?? [];

        if ($reactions->isEmpty()) {
            unset($meta['reactions']);
        } else {
            $meta['reactions'] = $reactions->all();
        }

        $this->meta = empty($meta) ? null : $meta;
        $this->save();

        return $this->reactionSummary($userId);
    }

    protected function formatDurationLabel(int $seconds): string
    {
        $seconds = max(0, $seconds);
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%d:%02d:%02d', $hours, $minutes, $remainingSeconds);
        }

        return sprintf('%d:%02d', $minutes, $remainingSeconds);
    }

    public function attachmentSummary(): string
    {
        $attachments = $this->attachmentItems();

        if (empty($attachments)) {
            return $this->isVoiceMessage() ? 'Voice note' : 'Attachment';
        }

        $imageCount = collect($attachments)->where('type', 'image')->count();
        $audioCount = collect($attachments)->where('type', 'audio')->count();
        $videoCount = collect($attachments)->where('type', 'video')->count();
        $fileCount = count($attachments) - $imageCount - $audioCount - $videoCount;

        $parts = [];

        if ($imageCount > 0) {
            $parts[] = $imageCount === 1 ? '1 photo' : "{$imageCount} photos";
        }

        if ($audioCount > 0) {
            $parts[] = $audioCount === 1 ? '1 audio file' : "{$audioCount} audio files";
        }

        if ($videoCount > 0) {
            $parts[] = $videoCount === 1 ? '1 video' : "{$videoCount} videos";
        }

        if ($fileCount > 0) {
            $parts[] = $fileCount === 1 ? '1 file' : "{$fileCount} files";
        }

        return implode(', ', $parts) ?: 'Attachment';
    }

    public function previewText(int $viewerId): string
    {
        $senderPrefix = $this->isGroupMessage()
            ? (($this->from_id === $viewerId ? 'You' : ($this->fromUser?->name ?: 'Someone')) . ': ')
            : '';

        if ($this->isCallMessage()) {
            $prefix = $this->from_id === $viewerId ? 'You ' : '';
            $callType = ucfirst((string) data_get($this->meta, 'call_type', 'video'));
            $status = $this->callStatus();

            return $senderPrefix . match ($status) {
                'ringing' => $prefix . 'started a ' . strtolower($callType) . ' call',
                'active' => $prefix . 'is on a ' . strtolower($callType) . ' call',
                'declined' => $prefix . 'declined a ' . strtolower($callType) . ' call',
                default => $prefix . 'ended a ' . strtolower($callType) . ' call' . ($this->callDurationSeconds() > 0 ? ' · ' . $this->callDurationLabel() : ''),
            };
        }

        if ($this->isVoiceMessage()) {
            $durationLabel = $this->voiceNoteDurationLabel();

            return $senderPrefix . ($this->from_id === $viewerId
                ? 'You sent a voice note' . ($durationLabel ? ' · ' . $durationLabel : '') . '.'
                : 'Sent a voice note' . ($durationLabel ? ' · ' . $durationLabel : '') . '.');
        }

        if ($this->hasAttachments()) {
            $summary = $this->attachmentSummary();

            return $senderPrefix . ($this->from_id === $viewerId
                ? 'You sent ' . strtolower($summary) . '.'
                : 'Sent ' . strtolower($summary) . '.');
        }

        return $senderPrefix . ($this->body ?: 'Message');
    }

    protected function normalizeAttachment(mixed $attachment): ?array
    {
        if (is_string($attachment)) {
            $attachment = ['path' => $attachment];
        }

        if (!is_array($attachment)) {
            return null;
        }

        $path = $attachment['path'] ?? null;

        if (!$path) {
            return null;
        }

        $mime = $attachment['mime'] ?? null;
        $type = $attachment['type'] ?? $this->guessAttachmentType($path, $mime);

        return [
            'path' => $path,
            'name' => $attachment['name'] ?? basename($path),
            'mime' => $mime,
            'type' => $type,
            'size' => $attachment['size'] ?? null,
        ];
    }

    protected function guessAttachmentType(string $path, ?string $mime = null): string
    {
        $mime = $mime ?: (function_exists('mime_content_type') ? @mime_content_type(public_path($path)) : null);

        if (is_string($mime)) {
            if (Str::startsWith($mime, 'image/')) {
                return 'image';
            }

            if (Str::startsWith($mime, 'audio/')) {
                return 'audio';
            }

            if (Str::startsWith($mime, 'video/')) {
                return 'video';
            }
        }

        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif' => 'image',
            'mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm' => 'audio',
            'mp4', 'mov', 'mkv' => 'video',
            default => 'file',
        };
    }


}
