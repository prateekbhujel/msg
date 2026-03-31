@php
    $isMine = $message->from_id == auth()->user()->id;
    $canDelete = $message->canBeDeletedBy((int) auth()->id());
    $attachments = $message->attachmentItems();
    $messageType = $message->message_type ?? 'text';
    $callType = data_get($message->meta, 'call_type', 'video');
    $callStatus = $message->callStatus();
    $statusBadge = match ($callStatus) {
        'active' => 'bg-info text-dark',
        'declined' => 'bg-danger text-white',
        'ringing' => 'bg-warning text-dark',
        default => 'bg-success text-white',
    };
    $callIcon = $callType === 'audio' ? 'fas fa-phone' : 'fas fa-video';
    $voiceAttachment = $message->primaryAttachment();
    $voiceUrl = $voiceAttachment ? asset($voiceAttachment['path']) : null;
    $voiceMime = $voiceAttachment['mime'] ?? 'audio/webm';
    $voiceSize = $voiceAttachment['size'] ?? null;
    $voiceSizeLabel = $voiceSize
        ? ($voiceSize >= 1048576
            ? number_format($voiceSize / 1048576, 1) . ' MB'
            : number_format($voiceSize / 1024, $voiceSize >= 10240 ? 0 : 1) . ' KB')
        : null;
    $voiceSubtitle = $voiceSizeLabel
        ? 'Tap play to listen · ' . $voiceSizeLabel
        : 'Tap play to listen';
@endphp

<div class="wsus__single_chat_area message-card" data-id="{{ $message->id }}" data-message-type="{{ $messageType }}">
    <div class="wsus__single_chat {{ $isMine ? 'chat_right' : '' }}">
        @if ($message->isCallMessage())
            <div class="call_history_card rounded-4 p-3 border border-2 {{ $statusBadge }}">
                <div class="d-flex align-items-center gap-3">
                    <div class="flex-shrink-0 rounded-circle bg-white text-dark d-flex align-items-center justify-content-center"
                        style="width: 54px; height: 54px;">
                        <i class="{{ $callIcon }} fs-5"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-semibold mb-1">{{ $message->body }}</div>
                        <div class="small">
                            <span>{{ ucfirst($callStatus) }}</span>
                            <span class="mx-1">•</span>
                            <span>{{ $message->callDurationLabel() }}</span>
                        </div>
                    </div>
                </div>
            </div>
        @else
            @if ($message->body)
                <p class="messages">{{ $message->body }}</p>
            @endif

            @if ($message->isVoiceMessage())
                <div class="voice-note-card voice-note-card--message" data-voice-player>
                    <div class="voice-note-icon">
                        <i class="fas fa-microphone"></i>
                    </div>
                    <div class="flex-grow-1 min-w-0">
                        <div class="voice-note-head">
                            <div class="min-w-0">
                                <div class="voice-note-title">{{ $message->body ?: 'Voice note' }}</div>
                                <div class="voice-note-subtitle">{{ $voiceSubtitle }}</div>
                            </div>
                            <div class="voice-note-wave voice-note-wave--compact" aria-hidden="true">
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>

                        @if ($voiceUrl)
                            <div class="voice-audio-player">
                                <button type="button" class="voice-audio-player__toggle" aria-label="Play voice note">
                                    <i class="fas fa-play"></i>
                                </button>
                                <div class="voice-audio-player__timeline">
                                    <div class="voice-audio-player__times">
                                        <span class="voice-audio-player__current">0:00</span>
                                        <span class="voice-audio-player__duration">0:00</span>
                                    </div>
                                    <div class="voice-audio-player__progress">
                                        <span class="voice-audio-player__progress-fill"></span>
                                    </div>
                                </div>
                                <audio class="voice-audio-player__audio" preload="none">
                                    <source src="{{ $voiceUrl }}" type="{{ $voiceMime }}">
                                </audio>
                            </div>
                        @endif
                    </div>
                </div>
            @endif

            @if (count($attachments) > 0 && ! $message->isVoiceMessage())
                <div class="message-attachment-grid d-grid gap-2" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                    @foreach ($attachments as $attachment)
                        @php
                            $attachmentUrl = asset($attachment['path']);
                            $attachmentName = $attachment['name'] ?? basename($attachment['path']);
                            $attachmentType = $attachment['type'] ?? 'file';
                        @endphp

                        @if ($attachmentType === 'image')
                            <a class="venobox vbox-item rounded-4 overflow-hidden" data-gall="gallery-{{ $message->id }}" href="{{ $attachmentUrl }}">
                                <img src="{{ $attachmentUrl }}" alt="{{ $attachmentName }}" class="img-fluid w-100" loading="lazy">
                            </a>
                        @elseif ($attachmentType === 'audio')
                            <div class="voice-note-card voice-note-card--message" data-voice-player>
                                <div class="voice-note-icon">
                                    <i class="fas fa-music"></i>
                                </div>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="voice-note-head">
                                        <div class="min-w-0">
                                            <div class="voice-note-title">{{ truncate($attachmentName, 24) }}</div>
                                            <div class="voice-note-subtitle">
                                                Tap play to listen
                                                @if (! empty($attachment['size']))
                                                    · {{ $attachment['size'] >= 1048576
                                                        ? number_format($attachment['size'] / 1048576, 1) . ' MB'
                                                        : number_format($attachment['size'] / 1024, $attachment['size'] >= 10240 ? 0 : 1) . ' KB' }}
                                                @endif
                                            </div>
                                        </div>
                                        <div class="voice-note-wave voice-note-wave--compact" aria-hidden="true">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                    <div class="voice-audio-player">
                                        <button type="button" class="voice-audio-player__toggle" aria-label="Play audio">
                                            <i class="fas fa-play"></i>
                                        </button>
                                        <div class="voice-audio-player__timeline">
                                            <div class="voice-audio-player__times">
                                                <span class="voice-audio-player__current">0:00</span>
                                                <span class="voice-audio-player__duration">0:00</span>
                                            </div>
                                            <div class="voice-audio-player__progress">
                                                <span class="voice-audio-player__progress-fill"></span>
                                            </div>
                                        </div>
                                        <audio class="voice-audio-player__audio" preload="none">
                                            <source src="{{ $attachmentUrl }}" type="{{ $attachment['mime'] ?? 'audio/mpeg' }}">
                                        </audio>
                                    </div>
                                </div>
                            </div>
                        @elseif ($attachmentType === 'video')
                            <video controls playsinline class="w-100 rounded-4 message-media-video" preload="metadata">
                                <source src="{{ $attachmentUrl }}" type="{{ $attachment['mime'] ?? 'video/mp4' }}">
                            </video>
                        @else
                            <a href="{{ $attachmentUrl }}" class="rounded-4 border bg-light d-flex align-items-center gap-3 p-3 text-decoration-none text-dark" download>
                                <span class="rounded-circle bg-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style="width: 42px; height: 42px;">
                                    <i class="fas fa-file-alt text-primary"></i>
                                </span>
                                <span class="small fw-semibold text-truncate" style="max-width: 220px;">{{ $attachmentName }}</span>
                            </a>
                        @endif
                    @endforeach
                </div>
            @endif
        @endif

        @if (! $message->isCallMessage())
            <span class="time">{{ timeAgo($message->created_at) }}</span>
        @else
            <span class="time">{{ timeAgo($message->created_at) }} · {{ $message->callDurationLabel() }}</span>
        @endif

        @if ($canDelete)
            <a class="action dlt-message" href="javascript:void()" data-msgid="{{ $message->id }}"><i class="fas fa-trash"></i></a>
        @endif
    </div>
</div>
