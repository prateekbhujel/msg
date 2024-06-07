<div class="col-xl-3">
    <a href="#" class="wsus__favourite_item">
        <div class="img">
            <img src="{{ asset($item->user?->avatar) }}" alt="User" class="img-fluid">
            <span class="inactive"></span>
        </div>
        <p>{{ $item->user->name }}</p>
    </a>
</div>
