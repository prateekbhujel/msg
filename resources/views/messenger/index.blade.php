<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, target-densityDpi=device-dpi" />
    <title>{{ config('app.name') }}</title>
    <link rel="icon" type="image/png" href="{{ asset('public/assets/images/icon.png') }}">
    <link rel="stylesheet" href="{{ asset('public/assets/css/all.min.css') }}">
    <link rel="stylesheet" href="{{ asset('public/assets/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('public/assets/css/slick.css') }}">
    <link rel="stylesheet" href="{{ asset('public/assets/css/venobox.min.css') }}">
    <link rel="stylesheet" href="{{ asset('public/assets/css/emojionearea.min.css') }}">

    <link rel="stylesheet" href="{{ asset('public/assets/css/spacing.css') }} ">
    <link rel="stylesheet" href="{{ asset('public/assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('public/assets/css/responsive.css') }}">
</head>

<body>

    <!--==================================
        Chatting Application Start
    ===================================-->
    <section class="wsus__chat_app">

        <div class="wsus__user_list">
            <div class="wsus__user_list_header">
                <h3>
                    <span><img src="{{ asset('public/assets/images/chat_list_icon.png') }}" alt="Chat" class="img-fluid"></span>
                    {{ config('app.name') }}
                </h3>
                <span class="setting" data-bs-toggle="modal" data-bs-target="#exampleModal">
                    <i class="fas fa-user-cog"></i>
                </span>

                <div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel"
                    aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-body">
                                <form action="#">

                                    <div class="file">
                                        <img src="images/upload_img.jpg" alt="Upload" class="img-fluid">
                                        <label for="select_file"><i class="fal fa-camera-alt"></i></label>
                                        <input id="select_file" type="file" hidden>
                                    </div>
                                    <p>Edit information</p>
                                    <input type="text" placeholder="Name">
                                    <input type="email" placeholder="Email">
                                    <input type="text" placeholder="Phone">
                                    <p>Change password</p>
                                    <div class="row">
                                        <div class="col-xl-6">
                                            <input type="password" placeholder="Old Password">
                                        </div>
                                        <div class="col-xl-6">
                                            <input type="password" placeholder="New Password">
                                        </div>
                                        <div class="col-xl-12">
                                            <input type="password" placeholder="Confirm Password">
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary cancel"
                                    data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary save">Save changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <form action="#" class="wsus__user_list_search">
                <input class="input" type="text" placeholder="Search">
                <div class="user_search_result">
                    <div class="wsus__user_list_area_height">
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_1.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <div class="text">
                                <h5>Jubaydul islam</h5>
                                <p><span>You</span> Hi, What"s your name</p>
                            </div>
                            <span class="time">10m ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <div class="text">
                                <h5>Hasan Masud</h5>
                                <p><span>You</span> Hello, How are you?</p>
                            </div>
                            <span class="time">2h ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_3.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <div class="text">
                                <h5>Mamunur Rashid</h5>
                                <p><span>You</span> Hi. .</p>
                            </div>
                            <span class="time">46m ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_4.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <div class="text">
                                <h5>Palash munna</h5>
                                <p><span>You</span> Hello. . .</p>
                            </div>
                            <span class="time">2h ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_5.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <div class="text">
                                <h5>Imrul Kayes</h5>
                                <p><span>You</span> I'm Imrul Kayes</p>
                            </div>
                            <span class="time">46m ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_6.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <div class="text">
                                <h5>Sumon Jahan</h5>
                                <p><span>You</span> My name is Sumin Jahan</p>
                            </div>
                            <span class="time">2h ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_1.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <div class="text">
                                <h5>Jubaydul islam</h5>
                                <p><span>You</span> Hi, What"s your name</p>
                            </div>
                            <span class="time">10m ago</span>
                        </div>
                        <div class="wsus__user_list_item">
                            <div class="img">
                                <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <div class="text">
                                <h5>Hasan Masud</h5>
                                <p><span>You</span> Hello, How are you?</p>
                            </div>
                            <span class="time">2h ago</span>
                        </div>
                    </div>
                </div>
            </form>

            <div class="wsus__favourite_user">
                <div class="top">favourites</div>
                <div class="row favourite_user_slider">
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_1.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <p>mr hasin</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <p>md Hassan</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_3.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <p>humayun</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_4.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <p>mr hasin</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_5.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <p>jahid mia</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_6.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <p>mr hasin</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_1.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <p>mr hasin</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                                <span class="inactive"></span>
                            </div>
                            <p>md Hassan</p>
                        </a>
                    </div>
                    <div class="col-xl-3">
                        <a href="#" class="wsus__favourite_item">
                            <div class="img">
                                <img src="images/author_img_3.jpg" alt="User" class="img-fluid">
                                <span class="active"></span>
                            </div>
                            <p>humayun</p>
                        </a>
                    </div>
                </div>
            </div>

            <div class="wsus__save_message">
                <div class="top">your space</div>
                <div class="wsus__save_message_center">
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
                <div class="wsus__user_list_area_height">
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_1.jpg" alt="User" class="img-fluid">
                            <span class="active"></span>
                        </div>
                        <div class="text">
                            <h5>Jubaydul islam</h5>
                            <p><span>You</span> Hi, What"s your name</p>
                        </div>
                        <span class="time">10m ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                            <span class="inactive"></span>
                        </div>
                        <div class="text">
                            <h5>Hasan Masud</h5>
                            <p><span>You</span> Hello, How are you?</p>
                        </div>
                        <span class="time">2h ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_3.jpg" alt="User" class="img-fluid">
                            <span class="active"></span>
                        </div>
                        <div class="text">
                            <h5>Mamunur Rashid</h5>
                            <p><span>You</span> Hi. .</p>
                        </div>
                        <span class="time">46m ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_4.jpg" alt="User" class="img-fluid">
                            <span class="inactive"></span>
                        </div>
                        <div class="text">
                            <h5>Palash munna</h5>
                            <p><span>You</span> Hello. . .</p>
                        </div>
                        <span class="time">2h ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_5.jpg" alt="User" class="img-fluid">
                            <span class="active"></span>
                        </div>
                        <div class="text">
                            <h5>Imrul Kayes</h5>
                            <p><span>You</span> I'm Imrul Kayes</p>
                        </div>
                        <span class="time">46m ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_6.jpg" alt="User" class="img-fluid">
                            <span class="inactive"></span>
                        </div>
                        <div class="text">
                            <h5>Sumon Jahan</h5>
                            <p><span>You</span> My name is Sumin Jahan</p>
                        </div>
                        <span class="time">2h ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_1.jpg" alt="User" class="img-fluid">
                            <span class="active"></span>
                        </div>
                        <div class="text">
                            <h5>Jubaydul islam</h5>
                            <p><span>You</span> Hi, What"s your name</p>
                        </div>
                        <span class="time">10m ago</span>
                    </div>
                    <div class="wsus__user_list_item">
                        <div class="img">
                            <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                            <span class="inactive"></span>
                        </div>
                        <div class="text">
                            <h5>Hasan Masud</h5>
                            <p><span>You</span> Hello, How are you?</p>
                        </div>
                        <span class="time">2h ago</span>
                    </div>
                </div>

                <!-- <div class="wsus__user_list_liading">
                    <div class="spinner-border text-light" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div> -->

            </div>
        </div>

        <div class="wsus__chat_area">

            <div class="wsus__message_paceholder d-none"></div>

            <div class="wsus__chat_area_header">
                <div class="header_left">
                    <span class="back_to_list">
                        <i class="fas fa-arrow-left"></i>
                    </span>
                    <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                    <h4>Jubaydul islam</h4>
                </div>
                <div class="header_right">
                    <a href="#" class="favourite"><i class="fas fa-star"></i></a>
                    <a href="#" class="go_home"><i class="fas fa-home"></i></a>
                    <a href="#" class="info"><i class="fas fa-info-circle"></i></a>
                </div>
            </div>

            <div class="wsus__chat_area_body">

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat">
                        <p class="messages">Hi, How are you ?</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat chat_right">
                        <p class="messages">I'm fine, What about you ?</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat">
                        <p class="messages">I'm so so</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat">
                        <p class="messages">You can give a photo ?</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat chat_right">
                        <p class="messages">Yes</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat chat_right">
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat">
                        <p class="messages">You can give a photo ?</p>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat chat_right">
                        <p class="messages">I'm fine, What about you ?</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat">
                        <p class="messages">I'm so so</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat">
                        <p class="messages">You can give a photo ?</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat chat_right">
                        <p class="messages">Yes</p>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

                <div class="wsus__single_chat_area">
                    <div class="wsus__single_chat chat_right">
                        <div class="pre_loader">
                            <div class="spinner-border text-light" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                        <span class="time"> 5h ago</span>
                        <a class="action" href="#"><i class="fas fa-trash"></i></a>
                    </div>
                </div>

            </div>

            <div class="wsus__chat_area_footer">
                <div class="footer_message">
                    <!-- <div class="img">
                        <img src="images/chat_img.png" alt="User" class="img-fluid">
                        <span><i class="far fa-times"></i></span>
                    </div> -->
                    <form action="#">
                        <div class="file">
                            <label for="file"><i class="far fa-plus"></i></label>
                            <input id="file" type="file" hidden>
                        </div>
                        <textarea id="example1" rows="1" placeholder="Type a message.."></textarea>
                        <button><i class="fas fa-paper-plane"></i></button>
                    </form>
                </div>
            </div>
        </div>

        <div class="wsus__chat_info">
            <div class="wsus__chat_info_header">
                <h5>User Details</h5>
                <span class="user_info_close"><i class="far fa-times"></i></span>
            </div>

            <div class="wsus__chat_info_details">
                <div class="user_photo">
                    <img src="images/author_img_2.jpg" alt="User" class="img-fluid">
                </div>
                <h3 class="user_name">Hasan Masud</h3>
                <a href="#" class="delete_chat">Delete Conversation</a>
                <p class="photo_gallery">Shared Photos</p>
                <span class="nothing_share">Nothing shared yet</span>

                <ul class="wsus__chat_info_gallery">
                    <li>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                    </li>
                    <li>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                    </li>
                    <li>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                    </li>
                    <li>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                    </li>
                    <li>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                    </li>
                    <li>
                        <a class="venobox" data-gall="gallery01" href="images/chat_img.png">
                            <img src="images/chat_img.png" alt="gallery1" class="img-fluid w-100">
                        </a>
                    </li>
                </ul>
            </div>
        </div>

    </section>
    <!--==================================
        Chatting Application End
    ===================================-->


    <!--jquery library js-->
    <script src="{{ asset('public/assets/js/jquery-3.7.1.min.js') }}"></script>
    <!--bootstrap js-->
    <script src="{{ asset('public/assets/js/bootstrap.bundle.min.js') }}"></script>
    <!--font-awesome js-->
    <script src="{{ asset('public/assets/js/Font-Awesome.js') }}"></script>
    <script src="{{ asset('public/assets/js/slick.min.js') }}"></script>
    <script src="{{ asset('public/assets/js/venobox.min.js') }}"></script>
    <script src="{{ asset('public/assets/js/emojionearea.min.js') }}"></script>

    <!--main/custom js-->
    <script src="{{ asset('public/assets/js/main.js') }}"></script>

</body>

</html>