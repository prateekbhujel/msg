<div class="wsus__user_list">
    <div class="wsus__user_list_header">
        <h3>
            <span><img src="{{ asset('assets/images/chat_list_icon.png') }}" alt="Chat" class="img-fluid"></span>
            {{ config('app.name') }}
        </h3>
        <div class="d-flex">
            <span class="setting me-2" data-bs-toggle="modal" data-bs-target="#createGroupModal" title="Create group">
                <i class="fas fa-user-friends"></i>
            </span>
            <form method="POST" action="{{ route('logout') }}">
                @csrf

                <a href="javascript:void(0)" onclick="event.preventDefault(); this.closest('form').submit();" style="padding-right: 4px;">
                    <span class="setting">
                        <i class="fas fa-sign-out-alt" style="color:rgb(193, 9, 9);"></i>
                    </span>
                </a>
            </form>

            <span class="setting" data-bs-toggle="modal" data-bs-target="#exampleModal">
                <i class="fas fa-user-cog"></i>
            </span>
        </div>

        @include('messenger.layouts.profile-modal')
        @include('messenger.layouts.create-group-modal')

    </div>

    @include('messenger.layouts.search-form')

    <div class="msg-tab-bar">
        <button type="button" class="msg-tab active" data-tab="dms">
            <i class="far fa-comment-dots"></i>
            <span>Chats</span>
        </button>
        <button type="button" class="msg-tab" data-tab="groups">
            <i class="fas fa-user-friends"></i>
            <span>Groups</span>
            <span class="tab-badge" id="groups-unread-badge"></span>
        </button>
        <button type="button" class="msg-tab" data-tab="active">
            <span class="active-dot-indicator"></span>
            <i class="fas fa-circle"></i>
            <span>Active</span>
            <span class="tab-badge" id="active-users-badge"></span>
        </button>
    </div>

    <div id="tab-dms" class="msg-tab-pane active">
        <div class="wsus__favourite_user">
            <div class="top">favourites</div>
            <div class="row favourite_user_slider">

                @foreach ($favoriteList as $item)
                    <div
                        class="col-xl-3 messenger-list-item"
                        role="button"
                        data-id="{{ $item->user?->id }}"
                        data-user-id="{{ $item->user?->id }}"
                        data-conversation-key="user:{{ $item->user?->id }}"
                        data-conversation-type="user"
                    >
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
            <div
                class="wsus__save_message_center messenger-list-item"
                data-id="{{ auth()->user()->id }}"
                data-user-id="{{ auth()->user()->id }}"
                data-conversation-key="user:{{ auth()->user()->id }}"
                data-conversation-type="user"
            >
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
            <div class="top">Direct Messages</div>
            <div class="wsus__user_list_area_height messenger-contacts"></div>
        </div>
    </div>

    <div id="tab-groups" class="msg-tab-pane">
        <div class="wsus__user_list_area wsus__user_list_area--groups">
            <div class="top d-flex justify-content-between align-items-center">
                <span>Groups</span>
                <button type="button" class="group-tab-create" data-bs-toggle="modal" data-bs-target="#createGroupModal">
                    New
                </button>
            </div>
            <div class="wsus__user_list_area_height messenger-groups"></div>
        </div>
    </div>

    <div id="tab-active" class="msg-tab-pane">
        <div class="wsus__user_list_area wsus__user_list_area--active">
            <div class="top">Active now</div>
            <div class="wsus__user_list_area_height messenger-active-users"></div>
        </div>
    </div>
</div>
