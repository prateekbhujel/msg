@php
    $attachment = $attachment ?? (method_exists($photo, 'primaryAttachment') ? $photo->primaryAttachment() : null);
    $mediaPath = null;
    $mediaType = 'image';
    $mediaMime = null;

    if (is_array($attachment)) {
        $mediaPath = $attachment['path'] ?? null;
        $mediaType = $attachment['type'] ?? 'image';
        $mediaMime = $attachment['mime'] ?? null;
    } elseif (is_string($attachment) && $attachment !== '') {
        $mediaPath = $attachment;
    } elseif (is_string($photo->attachment)) {
        $decoded = json_decode($photo->attachment, true);
        $mediaPath = is_array($decoded) ? ($decoded['path'] ?? null) : $decoded;
    }
@endphp

@if ($mediaPath)
    <li>
        @if ($mediaType === 'video')
            <video class="shared-media-video" controls muted playsinline preload="metadata">
                <source src="{{ asset($mediaPath) }}" type="{{ $mediaMime ?: 'video/mp4' }}">
            </video>
        @else
            <a class="venobox" data-gall="gallery-{{ $photo->id }}" href="{{ asset($mediaPath) }}">
                <img src="{{ asset($mediaPath) }}" alt="{{ basename($mediaPath) }}" class="img-fluid w-100" loading="lazy">
            </a>
        @endif
    </li>
@endif
