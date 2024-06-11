/**
 *  ------------------
 * | Global Variables |
 *  ------------------
*/
var temporaryMsgId = 0;
var activeUsersIds = [];

const messageForm             = $(".message-form"),
      messageInput            = $(".message-input"),
      messageBoxContainer     = $(".wsus__chat_area_body"),
      csrf_token              = $("meta[name=csrf_token]").attr("content"),
      auth_id                 = $("meta[name=auth_id]").attr("content"),
      url                     = $("meta[name=url]").attr("content"),
      messengerContactBox     = $(".messenger-contacts");

const getMessengerId          = () => $("meta[name=id]").attr("content");
const setMessengerId          = (id) => $("meta[name=id]").attr("content", id);

/**
 *  ---------------------
 * | Resuable Function   |
 *  ---------------------
*/
function enableChatBoxLoader() {
    $(".wsus__message_paceholder").removeClass('d-none');

}//End Method
function disableChatBoxLoader() {
    $(".wsus__chat_app").removeClass('show_info');
    $(".wsus__message_paceholder").addClass('d-none');
    $(".wsus__message_paceholder_blank").addClass('d-none');

}//End Method
function imagePreview(input, selector) {
    if (input.files && input.files[0]) {
        var render = new FileReader();

        render.onload = function (e) {
            $(selector).attr('src', e.target.result);
        }

        render.readAsDataURL(input.files[0]);
    }

}//End Method
function sendMessage() {
    temporaryMsgId += 1;
    let tempID = `temp_${temporaryMsgId}`; //temp_1, temp_2 ....
    let hasAttachment = !!$(".attachment-input").val();
    const inputValue = messageInput.val();

    if (inputValue.trim().length > 0 || hasAttachment) {
        const formData = new FormData(messageForm[0]);
        formData.append("id", getMessengerId());
        formData.append("temporaryMsgId", tempID);
        formData.append("_token", csrf_token);

        $.ajax({
            method: "POST",
            url: route('messenger.send-message'),
            data: formData,
            dataType: "JSON",
            processData: false,
            contentType: false,
            beforeSend: function () {
                //add temp message on dom
                if (hasAttachment) {
                    messageBoxContainer.append(sendTempMessageCard(inputValue, tempID, true));
                } else {
                    messageBoxContainer.append(sendTempMessageCard(inputValue, tempID));
                }

                scrolllToBottom(messageBoxContainer);
                messageFormReset();

            },
            success: function (data) {
                //Update conatcts lists...
                updateContactItem(getMessengerId());
                const tempMsgCardElement = messageBoxContainer.find(`.message-card[data-id=${data.tempID}]`);

                tempMsgCardElement.before(data.message);
                tempMsgCardElement.remove();

            },
            error: function (xhr, status, error) {
                console.log(error);
            }
        });

    }

}//End Method
function deleteMessage(message_id)
{
    Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                method: "DELETE",
                url: route("messenger.delete-message"),
                data: {
                    message_id: message_id,
                    _token : csrf_token
                },
                beforeSend: function()
                {
                    $(`.message-card[data-id="${message_id}"]`).remove();

                },
                success: function(data)
                {
                    notyf.success(data.message);
                    //Update conatcts lists...
                    updateContactItem(getMessengerId());
                },
                error: function(xhr, status, error){
                    console.log(error);
                }
            });
         
        }
      });

}//End Method


/**
 *  ---------------------------------------------
 * | Generates an HTML string representing a     |
 * | temporary message card for a chat interface.|
 *  ---------------------------------------------
*/
function sendTempMessageCard(message, tempId, attachemnt = false) {
    if (attachemnt) {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${tempId}">
                        <div class="wsus__single_chat chat_right">
                            <div class="pre_loader">
                                <div class="spinner-border text-light" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            
                            ${message.trim().length > 0 ? `<p class="messages">${message}</p>` : ''}

                            <span class="clock"><i class="fas fa-clock"></i> sending</span>
                        </div>
                    </div>
                `;

    } else {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${tempId}">
                        <div class="wsus__single_chat chat_right">
                            <p class="messages">${message}</p>
                            <span class="clock"><i class="fas fa-clock"></i> sending</span>
                        </div>
                    </div>
                `;
    }

}//End Method

/**
 *  ---------------------------------------------
 * | Generates an HTML string representing a     |
 * | received message card for a chat interface. |
 *  ---------------------------------------------
*/
function receiveMessageCard(e) 
{
    if (e.attachment) {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${e.id}">
                        <div class="wsus__single_chat">
                            <a class="venobox" data-gall="gallery${e.id}" href="${url + e.attachment}">
                                <img src="${url + e.attachment}" alt="gallery1" class="img-fluid w-100">
                            </a>
                            
                            ${e.body.trim().length > 0 ? `<p class="messages">${e.body}</p>` : ''}
                        </div>
                    </div>
                `;

    } else {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${e.id}">
                        <div class="wsus__single_chat">
                            <p class="messages">${e.body}</p>
                        </div>
                    </div>
                `;
    }


}//End Method

/**
 *  -------------------------------------
 * | Resets the message from dom or Form |
 *  -------------------------------------
*/
function messageFormReset() {
    $(".attachment-block").addClass("d-none");
    $(".emojionearea-editor").text("");
    messageForm.trigger("reset");

}//End Method

/** 
 *  ------------------------------
 * | Fetch messages from database |
 *  ------------------------------
*/
let messagesPage = 1;
let noMoreMessages = false;
let messagesLoading = false;
function fetchMessages(id, newFetch = false) {
    if (newFetch) {
        messagesPage = 1;
        noMoreMessages = false;
    }
    if (!noMoreMessages && !messagesLoading) {
        $.ajax({
            method: 'GET',
            url: route('messenger.fetch-messages'),
            data: {
                _token: csrf_token,
                id: id,
                page: messagesPage
            },
            beforeSend: function () {
                messagesLoading = true;
                let loader = `
                    <div class="text-center mt-2 messages-loader">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                     </div>
                `;
                messageBoxContainer.prepend(loader);
            },
            success: function (data) {
                
                //remove the loader
                messagesLoading = false;
                messageBoxContainer.find(".messages-loader").remove();

                //Make Messages seen
                makeSeen(true);

                if (messagesPage == 1) {

                    messageBoxContainer.html(data.messages);
                    scrolllToBottom(messageBoxContainer);

                } else {
                    const lastMsg = $(messageBoxContainer).find(".message-card").first();
                    const curOffset = lastMsg.offset().top - messageBoxContainer.scrollTop();

                    messageBoxContainer.prepend(data.messages);
                    messageBoxContainer.scrollTop(lastMsg.offset().top - curOffset);

                }

                //Pagination Lock and Page Increment
                noMoreMessages = messagesPage >= data?.last_page;
                if (!noMoreMessages) messagesPage += 1;

                disableChatBoxLoader();
            },
            error: function (xhr, status, error) {

            }
        });
    }

}//End Method

/** 
 *  ----------------------------------
 * | Fetch contact list from database |
 *  ----------------------------------
*/
let contactsPage = 1;
let noMoreContacts = false;
let contactLoading = false;
function getContacts()
{
    if(!contactLoading && !noMoreContacts )
    {
        $.ajax({
            method: "GET",
            url: route("messenger.fetch-contacts"),
            data: {page: contactsPage},
            beforeSend: function(){
                contactLoading = true;
                let loader =`
                                <div class="text-center mt-2 contact-loader">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            `;
                messengerContactBox.append(loader);

            },
            success: function(data){
                contactLoading = false;
                messengerContactBox.find(".contact-loader").remove();

                if(contactsPage < 2)
                {
                    messengerContactBox.html(data.contacts);

                }else
                {
                    messengerContactBox.append(data.contacts);
                }
                
                noMoreContacts =  contactsPage >= data?.last_page;
                
                if(!noMoreContacts) contactsPage ++;

                //Cheks either the user is activate on pagination or not and set active class.
                updateUserActiveList();

            },
            error: function(xhr, status, error){
                contactLoading = false;
                messengerContactBox.find(".contact-loader").remove();
            }
        });
    }


}//End Method

/**
 *  ----------------------
 * | User Search Function |
 *  ----------------------
*/
let searchPage = 1;
let noMoreDataSearch = false;
let searchTempVal = "";
let setSearchLoading = false;
function searchUsers(query) {
    if (query != searchTempVal) {
        searchPage = 1;
        noMoreDataSearch = false;
    }

    searchTempVal = query;

    if (!setSearchLoading && !noMoreDataSearch) {
        $.ajax({
            method: 'GET',
            url: route('messenger.search'),
            data: { query: query, page: searchPage },
            beforeSend: function () {
                setSearchLoading = true;
                let loader = `
                                <div class="text-center mt-2 search-loader">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            `;

                $('.user_search_list_result').append(loader);
            },
            success: function (data) {
                setSearchLoading = false;
                $('.user_search_list_result').find('.search-loader').remove();

                if (searchPage < 2) {
                    $('.user_search_list_result').html(data.records);

                } else {
                    $('.user_search_list_result').append(data.records);
                }

                noMoreDataSearch = searchPage >= data?.last_page;

                if (!noMoreDataSearch) searchPage += 1;

            },
            error: function (xhr, status, error) {
                setSearchLoading = false;
                $('.user_search_list_result').find('.search-loader').remove();
            }
        });
    }
}//End Method

/**
 *  --------------------------------------
 * | Attaches a scroll event listener     |
 * | to the specified selector and calls  |
 * | the provided callback function when  |
 * | the scroll reaches the top or bottom |
 * | of the element.                      |
 *  --------------------------------------
*/
function actionOnScroll(selector, callback, topScroll = false) {
    $(selector).on('scroll', function () {
        let element = $(this).get(0);
        const condition = topScroll ? element.scrollTop == 0 : element.scrollTop + element.clientHeight >= element.scrollHeight;

        if (condition) {
            callback();
        }

    });

}//End Method

/**
 *  ---------------------------------
 * | Debounces a function,           |
 * | ensuring that it is only        |
 * | called after a specified delay. |
 *  ---------------------------------
*/
function debounce(callback, delay) {
    let timerId;

    return function (...args) {
        clearTimeout(timerId);

        timerId = setTimeout(() => {
            callback.apply(this, args);
        }, delay);
    }

}//End Method

/**
 *  ---------------------------------
 * | Fetch Id data of the user and   |
 * | append it to the DOM.           |
 *  ---------------------------------
*/
function Idinfo(id)
{
    $.ajax({
        method: 'GET',
        url: route('messenger.id-info'),
        data: { id: id },
        beforeSend: function () {
            NProgress.start();
            enableChatBoxLoader();
        },
        success: function (data) {
            //Fetch Messages
            fetchMessages(data.fetch.id, true);

            //Load gallery:
            $(".wsus__chat_info_gallery").html("");
            if(data?.shared_photos)
                {
                    $(".nothing_share").addClass("d-none");
                    $(".wsus__chat_info_gallery").html(data.shared_photos);
            }else
            {
                $(".nothing_share").removeClass("d-none");
            }

            //Fetch Favourites and handles the favorite button
            data.favorite > 0 ? $(".favourite").addClass("active") : $(".favourite").removeClass("active");

            $(".messenger-header").find("img").attr("src", "public/" + data.fetch.avatar);
            $(".messenger-header").find("h4").text(data.fetch.name);

            $(".messenger-info-view .user_photo").find("img").attr("src", "public/" + data.fetch.avatar);
            $(".messenger-info-view").find(".user_name").text(data.fetch.name);
            $(".messenger-info-view").find(".user_unique_name").text(data.fetch.user_name);
            NProgress.done();
        },
        error: function (xhr, status, error) {
            disableChatBoxLoader();
        }
    });

}//End Method

/** 
 *  ----------------------------
 * | Slide to bottom on action. |
 *  ----------------------------
*/
function scrolllToBottom(container) {
    $(container).stop().animate({
        scrollTop: $(container)[0].scrollHeight
    });

}//End Method

/**
 *  ----------------------------
 * | This function is called    |
 * | only when the user sends   |
 * | a new message, and in the  |
 * | meantime it updates the    |
 * | contact item.              |
 *  ----------------------------
*/
function updateContactItem(user_id)
{
    if(user_id != auth_id)
    {
        $.ajax({
            method: 'GET',
            url : route('messenger.update-contact-item'),
            data: { user_id: user_id },
            success: function(data){
                messengerContactBox.find(`.messenger-list-item[data-id="${user_id}"]`).remove();
                messengerContactBox.prepend(data.contact_item);
                // Adding (+) -- Infornt of the vairable 
                // sets or makes it integer
                if(activeUsersIds.includes(+user_id)){
                   userActive(user_id);
                }else{
                    userInactive(user_id);
                }

                if(user_id == getMessengerId()) updateSelectedContent(user_id);
    
            },
            error: function(xhr, status, error){
    
            }
    
        });
    }

}//End Method


/**
 *  -------------------------------------
 * | Updates the selected content in dom |
 * | sets to active class.               |
 *  -------------------------------------
*/
function updateSelectedContent(user_id)
{
    $(".messenger-list-item").removeClass('active');
    $(`.messenger-list-item[data-id="${user_id}"]`).addClass('active');

}//End Method

/**
 *  ----------------------------------
 * | saves users to favoruite lists.   |
 *  ----------------------------------
*/
function star(user_id)
{
    $(".favourite").toggleClass('active');

    $.ajax({
        method: "POST",
        url: route("messenger.favorite"),
        data: {  
            _token: csrf_token,
            id: user_id,
        },
        success: function(data) {
            if(data.status == 'added')
            {
                notyf.success('User added to favourite list.');
            }else
            {
                notyf.success('User removed from favourite list.');
            }

        },
        error: function(xhr, status, error){

        }
    });

}//End Method


/**
 *  ---------------------
 * | Make Messaes seen   |
 *  ---------------------
*/
function makeSeen(status)
{
    $(`.messenger-list-item[data-id="${getMessengerId()}"]`).find('.unseen_count').remove();
    $.ajax({
        method: 'POST',
        url: route('messenger.make-seen'),
        data: {  
            _token: csrf_token,
            id: getMessengerId()
        },
        success: function(data){

        },
        error: function(xhr, status, error){

        }
    });

}//End Method

/**
 *  ---------------------------
 * | Initialize venobox.js     |
 *  ---------------------------
*/
function initVenobox()
{
    $('.venobox').venobox();
}

/**
 *  ---------------------------
 * | Play Message Sound.       |
 *  ---------------------------
*/
function playNotficationSound()
{
    const sound = new Audio(`public/default/message-sound.mp3`);
    console.log(sound);
    sound.play();
}

/**
 *  --------------------------------
 * | Boradcasting Listener that,    |
 * | listens to the Message channel.|
 *  --------------------------------
*/
window.Echo.private('message.' + auth_id)
    .listen("Message", (e) => {
        // console.log(e);

        if(getMessengerId() != e.from_id)
        {
            updateContactItem(e.from_id);
            playNotficationSound();
        }
    
        let message = receiveMessageCard(e);
        if(getMessengerId() == e.from_id)
        {
            messageBoxContainer.append(message);
            scrolllToBottom(messageBoxContainer);
        }

});//End Method

/** 
 *  ---------------------------------------
 *  | Listens to the User Presence Channel.|
 *  ---------------------------------------
*/
window.Echo.join('online')
    .here((users) => {
        //Set Active Users Ids
        setActiveUsersIds(users);
        console.log(activeUsersIds);
        $.each(users, function(index, user){
            let contactItem = $(`.messenger-list-item[data-id="${user.id}"]`).find('.img').find('span');
            contactItem.removeClass('inactive');
            contactItem.addClass('active');

        });

}).joining((user) => {
    //Adding new user to the active users array
    addNewUserId(user.id);
    console.log(activeUsersIds);
    userActive(user.id);

}).leaving((user) => {
    //Removing user from the active users array
    removeUserId(user.id);
    console.log(activeUsersIds);
    userInactive(user.id);

});//End Method


/**
 *  ------------------------------------------------
 * | cheks the id in user lists while pagination,    |
 * | Makes the user active.                          |
 *  -------------------------------------------------
*/
function updateUserActiveList()
{
    $('.messenger-list-item').each(function(index, value){
        let id = $(this).data('id');

        if(activeUsersIds.includes(+id)) userActive(id);

    });

}//End Method

/**
 *  -----------------------------------
 * | Cheks the id of the user and if   |
 * | active sets the class active.     |
 *  -----------------------------------
*/
function userActive(id)
{
    let contactItem = $(`.messenger-list-item[data-id="${id}"]`).find('.img').find('span');
    contactItem.removeClass('inactive');
    contactItem.addClass('active');

}//End Method

/**
 *  ------------------------------------
 * | Cheks the id of the user and if    |
 * | active sets the class inactive.    |
 *  ------------------------------------
*/
function userInactive(id)
{
    let contactItem = $(`.messenger-list-item[data-id="${id}"]`).find('.img').find('span');
    contactItem.removeClass('active');
    contactItem.addClass('inactive');

}//End Method

/**
 *  -----------------------------------
 * | Set Active Users id to an array   |
 *  -----------------------------------
*/
function setActiveUsersIds(users)
{
    $.each(users, function(index, user){
        activeUsersIds.push(user.id);
    });

}//End Method


/**
 *  -------------------------------
 * | Add New User id to an array   |
 *  -------------------------------
*/
function addNewUserId(id)
{
    activeUsersIds.push(id);

}


/**
 *  -------------------------------
 * | Remove User id to an array.   |
 *  -------------------------------
*/
function removeUserId(id)
{
    let index = activeUsersIds.indexOf(id);

    if(index !== -1){
        activeUsersIds.splice(index, 1);
    }

}


/**
 *  ---------------
 * | On DOM Load   |
 *  ---------------
*/
$(document).ready(function () 
{   
    getContacts();;

    /**
     *  -------------------------------------------
     * | Hides the contact lists and shows mesages |
     * | and vice-versa.                           |
     *  -------------------------------------------
    */
    if(window.innerWidth < 768)
    {
        $("body").on("click", ".messenger-list-item", function() {
            $(".wsus__user_list").addClass('d-none');
        }); 
        
        $("body").on("click", ".back_to_list", function() {
            $(".wsus__user_list").removeClass('d-none');
        });

    }
    
    /**
     *   ------------------------------
     *  | Short-cut Key for Search box |
     *   ------------------------------
     */
    $('body').on('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault(); // Prevent the default browser action (save page)
            var $input = $('.user_search');
            $input.show().focus(); // Show and focus the input element
            $input.trigger('click'); 
        }
    });

    $('#select_file').change(function () {
        imagePreview(this, '.profile-image-preview');
    });

    /**
    *  ---------------------------
    * | Search on action on keyup | 
    *  --------------------------
    */
    const debouncedSearch = debounce(function () {
        const value = $('.user_search').val();
        searchUsers(value);
    }, 500);

    $('.user_search').on('keyup', function (e) {
        e.preventDefault();
        let query = $(this).val();
        if (query.length > 0) {
            debouncedSearch();
        }
    });

    /**
    *  ----------------------------------- 
    * | Search Pagination on Scroll Event |
    *  ----------------------------------- 
    */
    actionOnScroll(".user_search_list_result", function () {
        let value = $('.user_search').val();
        searchUsers(value);

    });

    /**
     *  --------------------------------------
     * | Click action for messenger List item |
     *  --------------------------------------
    */
    $("body").on('click', '.messenger-list-item', function () {
        const dataId = $(this).attr('data-id');
        
        updateSelectedContent(dataId);

        setMessengerId(dataId);
        Idinfo(dataId);
    });

    /**
     *  --------------
     * | Send Message |
     *  --------------
    */
    messageForm.on('submit', function (e) {
        e.preventDefault();
        sendMessage();
    });

    /**
     *  -------------------------------
     * | Send Attachment From Message |
     *  -------------------------------
    */
    $(".attachment-input").change(function () {
        imagePreview(this, '.attachment-preview');
        $(".attachment-block").removeClass('d-none');

    });

    /**
     *  ---------------------------------
     * | cancels the attachemnt and form |
     * | resets the form.                |
     *  ---------------------------------
    */
    $(".cancel-attachment").click(function () {
        messageFormReset();

    });

    /** 
     *   ----------------------------
     *  | Message Pagination method  |
     *   ----------------------------
    */
    actionOnScroll(".wsus__chat_area_body", function () {

        fetchMessages(getMessengerId());

    }, true);

    /** 
     *   -----------------------------
     *  | Contacts Pagination method. | 
     *   -----------------------------
    */
    actionOnScroll(".messenger-contacts", function () {

       getContacts();

    });

    /** 
     *   -----------------------------
     *  | Add remove user favorite.   | 
     *   -----------------------------
    */
    $(".favourite").on("click", function(e){
       e.preventDefault();
       star(getMessengerId());
    });

    /** 
     *   ------------------------------------------
     *  | Delete the selected message ,of the user |
     *  | (One message at a time).                 | 
     *   ------------------------------------------
    */
   $("body").on("click", '.dlt-message', function(e){
        e.preventDefault();
        let msg_id = $(this).data('msgid');
        deleteMessage(msg_id);
   });

    /**
     *  --------------------------
     * | Custom Height adjustment |
     *  --------------------------
    */
    function adjustHeight() 
    {
        var windowHeight = $(window).height();
        $('.wsus__chat_area_body').css('height', (windowHeight-120) + 'px');
        $('.messenger-contacts').css('max-height', (windowHeight - 393) + 'px');
        $('.wsus__chat_info_gallery').css('height', (windowHeight - 360) + 'px');
        $('.user_search_list_result').css({
            'height': (windowHeight - 130) + 'px',
        }); 
    }

    /**
     *  -----------------------------
     * | Window load event listener. |
     *  -----------------------------
    */
    adjustHeight();

    /** 
     *  --------------------------------
     * | Window resize event listener.  |
     *  --------------------------------
    */
    $(window).resize(function () {
        adjustHeight();
    });

});//End Method




