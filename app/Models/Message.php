<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'from_id',
        'to_id',
        'body',
        'attachment',
        'message_type',
        'meta',
        'seen',
    ];

    protected $casts = [
        'attachment' => 'array',
        'meta' => 'array',
        'seen' => 'boolean',
    ];
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

    public function isParticipant(int $userId): bool
    {
        return (int) $this->from_id === $userId || (int) $this->to_id === $userId;
    }

    public function canBeDeletedBy(int $userId): bool
    {
        if ($this->isCallMessage()) {
            return $this->isParticipant($userId);
        }

        return (int) $this->from_id === $userId;
    }

    public function isVoiceMessage(): bool
    {
        return ($this->message_type ?? 'text') === 'voice';
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
        $seconds = $this->callDurationSeconds();
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%02d:%02d:%02d', $hours, $minutes, $remainingSeconds);
        }

        return sprintf('%02d:%02d', $minutes, $remainingSeconds);
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
        if ($this->isCallMessage()) {
            $prefix = $this->from_id === $viewerId ? 'You ' : '';
            $callType = ucfirst((string) data_get($this->meta, 'call_type', 'video'));
            $status = $this->callStatus();

            return match ($status) {
                'ringing' => $prefix . 'started a ' . strtolower($callType) . ' call',
                'active' => $prefix . 'is on a ' . strtolower($callType) . ' call',
                'declined' => $prefix . 'declined a ' . strtolower($callType) . ' call',
                default => $prefix . 'ended a ' . strtolower($callType) . ' call' . ($this->callDurationSeconds() > 0 ? ' · ' . $this->callDurationLabel() : ''),
            };
        }

        if ($this->isVoiceMessage()) {
            return $this->from_id === $viewerId
                ? 'You sent a voice note.'
                : 'Sent a voice note.';
        }

        if ($this->hasAttachments()) {
            $summary = $this->attachmentSummary();

            return $this->from_id === $viewerId
                ? 'You sent ' . strtolower($summary) . '.'
                : 'Sent ' . strtolower($summary) . '.';
        }

        return $this->body ?: 'Message';
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
