@php
    $attachment = $attachment ?? (method_exists($photo, 'primaryAttachment') ? $photo->primaryAttachment() : null);
    $image = null;

    if (is_array($attachment)) {
        $image = $attachment['path'] ?? null;
    } elseif (is_string($attachment) && $attachment !== '') {
        $image = $attachment;
    } elseif (is_string($photo->attachment)) {
        $decoded = json_decode($photo->attachment, true);
        $image = is_array($decoded) ? ($decoded['path'] ?? null) : $decoded;
    }
@endphp

@if ($image)
    <li>
        <a class="venobox" data-gall="gallery-{{ $photo->id }}" href="{{ asset($image) }}">
            <img src="{{ asset($image) }}" alt="" class="img-fluid w-100" loading = "lazy">
        </a>
    </li>
@endif
