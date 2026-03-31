
    <div class="wsus__user_list_item messenger-list-item" data-id="{{ $user->id }}">
        <div class="img">
            <img src="{{ asset($user->avatar) }}" alt="User" class="img-fluid">
            <span class="inactive"></span>
        </div>
        <div class="text">
            
            <h5>{{ $user->name }}</h5>

            @if ($lastMessage)
                <p>{{ truncate($lastMessage->previewText(auth()->user()->id), 42) }}</p>
            @else
                <p>Say hi and start the conversation.</p>
            @endif

        </div>
            @if ($unseenCounter > 0)
                <span class="time badge bg-danger text-light unseen_count p-2">
                    {{ $unseenCounter }}
                </span>
            @endif
    </div>
