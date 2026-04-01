@php
    $isGroup = ($contact['conversation_type'] ?? 'user') === 'group';
    $avatarPath = asset($contact['avatar']);
    $memberIds = collect($contact['member_ids'] ?? [])->map(fn ($id) => (int) $id)->filter()->values();
    $groupInitials = strtoupper(mb_substr($contact['name'] ?? 'G', 0, 2));
@endphp

@if ($isGroup)
    <div
        class="group-card messenger-list-item"
        data-conversation-key="{{ $contact['conversation_key'] }}"
        data-conversation-type="group"
        data-group-id="{{ $contact['group_id'] }}"
        data-member-count="{{ (int) ($contact['member_count'] ?? $memberIds->count()) }}"
        data-member-ids="{{ $memberIds->implode(',') }}"
    >
        <button type="button" class="group-card__body">
            <div class="group-card__avatar-wrap">
                @if (($contact['avatar'] ?? '') !== 'default/avatar.png')
                    <img src="{{ $avatarPath }}" alt="{{ $contact['name'] }}" class="group-card__avatar-img">
                @else
                    <span class="group-card__avatar-fallback">{{ $groupInitials }}</span>
                @endif
                <span class="group-card__status-dot d-none"></span>
            </div>
            <div class="group-card__info">
                <div class="group-card__topline">
                    <strong class="group-card__name">{{ $contact['name'] }}</strong>
                    @if (($contact['unseen_count'] ?? 0) > 0)
                        <span class="group-card__badge">{{ $contact['unseen_count'] }}</span>
                    @endif
                </div>
                <div class="group-card__meta">
                    <span>{{ (int) ($contact['member_count'] ?? $memberIds->count()) }} members</span>
                    <span>·</span>
                    <span class="group-online-count">0 active</span>
                </div>
                <div class="group-card__preview">{{ truncate($contact['preview'], 56) }}</div>
            </div>
        </button>
        <div class="group-card__actions">
            <button type="button" class="btn-icon group-voice-call" data-call-type="audio" title="Voice call" aria-label="Start group voice call">
                <i class="fas fa-phone"></i>
            </button>
            <button type="button" class="btn-icon group-video-call" data-call-type="video" title="Video call" aria-label="Start group video call">
                <i class="fas fa-video"></i>
            </button>
            <button type="button" class="btn-icon group-open-chat" title="Open chat" aria-label="Open group chat">
                <i class="fas fa-angle-right"></i>
            </button>
        </div>
    </div>
@else
    <div
        class="wsus__user_list_item messenger-list-item"
        data-conversation-key="{{ $contact['conversation_key'] }}"
        data-conversation-type="{{ $contact['conversation_type'] }}"
        @if (! empty($contact['user_id']))
            data-id="{{ $contact['user_id'] }}"
            data-user-id="{{ $contact['user_id'] }}"
        @endif
        @if (! empty($contact['group_id']))
            data-group-id="{{ $contact['group_id'] }}"
        @endif
    >
        <div class="img">
            <img src="{{ $avatarPath }}" alt="User" class="img-fluid">
            <span class="inactive"></span>
        </div>
        <div class="text">
            <h5>{{ $contact['name'] }}</h5>
            <p>{{ truncate($contact['preview'], 42) }}</p>
        </div>
        @if (($contact['unseen_count'] ?? 0) > 0)
            <span class="time badge bg-danger text-light unseen_count p-2">
                {{ $contact['unseen_count'] }}
            </span>
        @endif
    </div>
@endif
