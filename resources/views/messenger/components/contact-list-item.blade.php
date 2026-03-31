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
            <img src="{{ asset($contact['avatar']) }}" alt="User" class="img-fluid">
            @if ($contact['conversation_type'] === 'user')
                <span class="inactive"></span>
            @else
                <span class="group-badge"><i class="fas fa-user-friends"></i></span>
            @endif
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
