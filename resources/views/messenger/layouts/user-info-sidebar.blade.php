<div class="wsus__chat_info">
    <div class="wsus__chat_info_header">
        <h5>User Details</h5>
        <span class="user_info_close"><i class="far fa-times"></i></span>
    </div>

    <div class="wsus__chat_info_details messenger-info-view">
        <div class="user_photo">
            <img src="{{ asset('public/assets/images/author_img_2.jpg') }}" alt="User" class="img-fluid">
        </div>
        <h3 class="user_name">Krishna Yadhav</h3>
        <span class="user_unique_name text-primary"></span>
        {{-- <a href="#" class="delete_chat">Delete Conversation</a> --}}
        <p class="photo_gallery">Shared Photos</p>
        <span class="nothing_share">Nothing shared yet</span>

        <ul class="wsus__chat_info_gallery">
            <li>
                <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                    <img src="{{ asset('public/assets/images/chat_img.png') }}" alt="gallery1" class="img-fluid w-100">
                </a>
            </li>
        </ul>
    </div>
</div>