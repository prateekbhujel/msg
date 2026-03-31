@php
    $viewerId = (int) auth()->id();
    $isMine = $message->from_id == $viewerId;
    $canDelete = $message->canBeDeletedBy($viewerId);
    $canInteract = $message->supportsInteractions();
    $attachments = $message->attachmentItems();
    $messageType = $message->message_type ?? 'text';
    $callType = data_get($message->meta, 'call_type', 'video');
    $callStatus = $message->callStatus();
    $statusBadge = match ($callStatus) {
        'active' => 'call_history_card--active',
        'declined' => 'call_history_card--declined',
        'ringing' => 'call_history_card--ringing',
        default => 'call_history_card--ended',
    };
    $callIcon = $callType === 'audio' ? 'fas fa-phone' : 'fas fa-video';
    $voiceAttachment = $message->primaryAttachment();
    $voiceUrl = $voiceAttachment ? asset($voiceAttachment['path']) : null;
    $voiceMime = $voiceAttachment['mime'] ?? 'audio/webm';
    $voiceSize = $voiceAttachment['size'] ?? null;
    $voiceDuration = $message->voiceNoteDurationLabel();
    $voiceSizeLabel = $voiceSize
        ? ($voiceSize >= 1048576
            ? number_format($voiceSize / 1048576, 1) . ' MB'
            : number_format($voiceSize / 1024, $voiceSize >= 10240 ? 0 : 1) . ' KB')
        : null;
    $voiceSubtitleParts = array_filter([
        'Tap play to listen',
        $voiceDuration,
        $voiceSizeLabel,
    ]);
    $voiceSubtitle = implode(' · ', $voiceSubtitleParts);
    $replyPreview = $message->replyPreviewPayload($viewerId);
    $replySnippet = $message->replySnippet();
    $replyAuthor = $message->replyAuthorLabel($viewerId);
    $reactionSummary = $message->reactionSummary($viewerId);
    $reactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
    $showSenderLabel = $message->isGroupMessage() && ! $isMine && ! $message->isCallMessage();
@endphp

<div
    class="wsus__single_chat_area message-card"
    data-id="{{ $message->id }}"
    data-message-type="{{ $messageType }}"
    @if ($canInteract)
        data-reply-id="{{ $message->id }}"
        data-reply-author="{{ $replyAuthor }}"
        data-reply-snippet="{{ $replySnippet }}"
    @endif
>
    <div class="wsus__single_chat {{ $isMine ? 'chat_right' : '' }}">
        @if ($message->isCallMessage())
            <div class="call_history_card {{ $statusBadge }}">
                <div class="call_history_card__icon">
                    <i class="{{ $callIcon }}"></i>
                </div>
                <div class="call_history_card__content">
                    <div class="call_history_card__title">{{ $message->body }}</div>
                    <div class="call_history_card__meta">
                        <span>{{ ucfirst($callStatus) }}</span>
                        <span>•</span>
                        <span>{{ $message->callDurationLabel() }}</span>
                    </div>
                </div>
            </div>
        @else
            @if ($showSenderLabel)
                <span class="message-sender-label">{{ $message->fromUser?->name ?: 'Group member' }}</span>
            @endif

            @if ($replyPreview)
                <button type="button" class="message-reply-snippet" data-reply-jump="{{ $replyPreview['id'] }}">
                    <span class="message-reply-snippet__label">{{ $replyPreview['sender_label'] }}</span>
                    <span class="message-reply-snippet__text">{{ $replyPreview['snippet'] }}</span>
                </button>
            @endif

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

            @if (count($reactionSummary) > 0)
                <div class="message-reactions" data-message-reactions data-message-id="{{ $message->id }}">
                    @foreach ($reactionSummary as $reaction)
                        <button
                            type="button"
                            class="message-reaction-chip {{ $reaction['reacted'] ? 'is-active' : '' }}"
                            data-msgid="{{ $message->id }}"
                            data-reaction="{{ $reaction['emoji'] }}"
                        >
                            <span>{{ $reaction['emoji'] }}</span>
                            <span>{{ $reaction['count'] }}</span>
                        </button>
                    @endforeach
                </div>
            @endif
        @endif

        @if ($canInteract || $canDelete)
            <div class="message-actions-stack">
                @if ($canInteract)
                    <button type="button" class="message-action-button message-reply-trigger" data-msgid="{{ $message->id }}" aria-label="Reply to message">
                        <i class="fas fa-reply"></i>
                    </button>
                    <div class="message-reaction-picker-wrap">
                        <button type="button" class="message-action-button message-react-trigger" data-msgid="{{ $message->id }}" aria-label="React to message">
                            <i class="far fa-smile"></i>
                        </button>
                        <div class="message-reaction-picker" data-reaction-picker>
                            @foreach ($reactionOptions as $reactionOption)
                                <button
                                    type="button"
                                    class="message-reaction-option"
                                    data-msgid="{{ $message->id }}"
                                    data-reaction="{{ $reactionOption }}"
                                >
                                    {{ $reactionOption }}
                                </button>
                            @endforeach
                        </div>
                    </div>
                @endif

                @if ($canDelete)
                    <button type="button" class="message-action-button dlt-message" data-msgid="{{ $message->id }}" aria-label="Delete message">
                        <i class="fas fa-trash"></i>
                    </button>
                @endif
            </div>
        @endif

        @if (! $message->isCallMessage())
            <span class="time">{{ timeAgo($message->created_at) }}</span>
        @else
            <span class="time">{{ timeAgo($message->created_at) }} · {{ $message->callDurationLabel() }}</span>
        @endif
    </div>
</div>
