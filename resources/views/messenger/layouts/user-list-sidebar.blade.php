<div class="wsus__user_list">
    <div class="wsus__user_list_header">
        <h3>
            <span><img src="{{ asset('/assets/images/chat_list_icon.png') }}" alt="Chat" class="img-fluid"></span>
            {{ config('app.name') }}
        </h3>
        <span class="setting" data-bs-toggle="modal" data-bs-target="#exampleModal">
            <i class="fas fa-user-cog"></i>
        </span>
        @include('messenger.layouts.profile-modal')
    </div>
    
    {{-- search form --}}
    @include('messenger.layouts.search-form')
    
    {{-- Favorite User Lists --}}
    <div class="wsus__favourite_user">
        <div class="top">favourites</div>
        <div class="row favourite_user_slider">

            @foreach ($favoriteList as $item)
                <div class="col-xl-3 messenger-list-item" role="button" data-id="{{ $item->user?->id }}">
                    <a href="#" class="wsus__favourite_item">
                        <div class="img">
                            <img src="{{ asset($item->user?->avatar) }}" alt="User" class="img-fluid">
                            <span class="inactive"></span>
                        </div>
                        <p>{{ $item->user->name }}</p>
                    </a>
                </div>
            @endforeach

        </div>
    </div>

    <div class="wsus__save_message">
        <div class="top">your space</div>
        <div class="wsus__save_message_center messenger-list-item" data-id = "{{ auth()->user()->id }}">
            <div class="icon">
                <i class="far fa-bookmark"></i>
            </div>
            <div class="text">
                <h3>Saved Messages</h3>
                <p>Save messages secretly</p>
            </div>
            <span>you</span>
        </div>
    </div>

    <div class="wsus__user_list_area">
        <div class="top">All Messages</div>
        <div class="wsus__user_list_area_height messenger-contacts">

        </div>
        <!-- <div class="wsus__user_list_liading">
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div> -->

    </div>
</div>