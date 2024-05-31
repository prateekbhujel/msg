<div class="wsus__user_list_item">
    <div class="img">
        <img src="{{ asset($record->avatar) }}" alt="User" class="img-fluid">
        {{-- <span class="active"></span> --}}
    </div>
    <div class="text">
        <h5>{{ $record->name }}</h5>
        <p>{{ $record->user_name }}</p>
    </div>
    {{-- <span class="time">10m ago</span> --}}
</div>