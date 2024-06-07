
    <div class="wsus__user_list_item messenger-list-item" data-id="{{ $user->id }}">
        <div class="img">
            <img src="{{ asset($user->avatar) }}" alt="User" class="img-fluid">
            <span class="active"></span>
        </div>
        <div class="text">
            
            <h5>{{ $user->name }}</h5>

            @if ($lastMessage->from_id == auth()->user()->id)
                @if ($lastMessage->attachment)
                    <p><span>You: </span>sent a photo. </p> 
                @else
                    <p><span>You:</span>{{ Str::limit($lastMessage->body, 20) }}</p>
                @endif 
            @else
                @if ($lastMessage->attachment)
                    <p>{{ $user->name }} sent you a photo.</p>
                @else
                <p> {{ Str::limit($lastMessage->body, 20) }}</p>
                    
                @endif
            @endif

        </div>
            @if ($unseenCounter > 0)
                <span class="time">{{ $unseenCounter }}</span>
            @endif
    </div>