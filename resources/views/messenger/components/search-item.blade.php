<div
    class="wsus__user_list_item messenger-list-item"
    data-id="{{ $record->id }}"
    data-user-id="{{ $record->id }}"
    data-conversation-key="user:{{ $record->id }}"
    data-conversation-type="user"
>
    <div class="img">
        <img src="{{ asset($record->avatar) }}" alt="User" class="img-fluid">
    </div>
    <div class="text">
        <h5>{{ $record->name }}</h5>
        <p>{{ $record->user_name }}</p>
    </div>
</div>
