/**
 *  ------------------
 * | Global Variables |
 *  ------------------
*/
var temporaryMsgId = 0;

const messageForm = $(".message-form"),
    messageInput = $(".message-input"),
    messageBoxContainer = $(".wsus__chat_area_body"),
    csrf_token = $("meta[name=csrf-token]").attr("content");

const getMessengerId = () => $("meta[name=id]").attr("content");
const setMessengerId = (id) => $("meta[name=id]").attr("content", id);

/**
 *  ---------------------
 * | Resuable Function   |
 *  ---------------------
*/
function enableChatBoxLoader()
{
    $(".wsus__message_paceholder").removeClass('d-none');

}//End Method
function disableChatBoxLoader()
{
    $(".wsus__chat_app").removeClass('show_info');
    $(".wsus__message_paceholder").addClass('d-none');
    $(".wsus__message_paceholder_blank").addClass('d-none');

}//End Method
function imagePreview(input, selector) 
{
    if (input.files && input.files[0]) 
    {
        var render = new FileReader();

        render.onload = function(e)
        {
            $(selector).attr('src', e.target.result);
        }

        render.readAsDataURL(input.files[0]);
    }

}//End Method
function sendMessage()
{
    temporaryMsgId += 1;
    let tempID = `temp_${temporaryMsgId}`; //temp_1, temp_2 ....
    let hasAttachment = !!$(".attachment-input").val();
    const inputValue = messageInput.val();
    
    if(inputValue.trim().length > 0 || hasAttachment)
    {
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
            beforeSend: function(){
                //add temp message on dom
                if(hasAttachment)
                {
                    messageBoxContainer.append(sendTempMessageCard(inputValue, tempID, true));    
                }else
                {
                    messageBoxContainer.append(sendTempMessageCard(inputValue, tempID));
                }

                scrolllToBottom(messageBoxContainer);  
                messageFormReset();

            },
            success: function(data){
                const tempMsgCardElement = messageBoxContainer.find(`.message-card[data-id=${data.tempID}]`);
                
                tempMsgCardElement.before(data.message);
                tempMsgCardElement.remove();

            },
            error: function(xhr, status, error){
               
            }
        });

    }

}//End Method

/**
 *  ---------------------------------------------
 * | Generates an HTML string representing a     |
 * | temporary message card for a chat interface.|
 *  ---------------------------------------------
*/
function sendTempMessageCard(message, tempId, attachemnt = false) 
{
    if(attachemnt)
    {
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
                            <a class="action" href="#"><i class="fas fa-trash"></i></a>
                        </div>
                    </div>
                `;

    }else
    {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${tempId}">
                        <div class="wsus__single_chat chat_right">
                            <p class="messages">${message}</p>
                            <span class="clock"><i class="fas fa-clock"></i> sending</span>b
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
function messageFormReset()
{
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
function fetchMessages(id, newFetch = false)
{
    if(newFetch){
        messagesPage = 1;
        noMoreMessages = false;
    }
    if(!noMoreMessages)
    {
        $.ajax({
            method: 'GET',
            url:  route('messenger.fetch-messages'),
            data: {
                _token: csrf_token,
                id: id,
                page: messagesPage
            },
            success: function(data)
            {
                if(messagesPage == 1){

                    messageBoxContainer.html(data.messages);
                    scrolllToBottom(messageBoxContainer);

                }else{

                    messageBoxContainer.prepend(data.messages);

                }

                //Pagination Lock and Page Increment
                noMoreMessages = messagesPage >= data?.last_page;
                if(!noMoreMessages) messagesPage += 1;

            },
            error: function(xhr, status, error){

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
function searchUsers(query)
{
    if(query != searchTempVal)
    {   
        searchPage = 1;
        noMoreDataSearch = false;
    }

    searchTempVal = query;

    if(!setSearchLoading && !noMoreDataSearch)
    {
        $.ajax({
            method: 'GET',
            url:  route('messenger.search'),
            data: { query: query, page:searchPage },
            beforeSend: function(){
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
            success: function(data)
            {
                setSearchLoading = false;
                $('.user_search_list_result').find('.search-loader').remove();

                if(searchPage < 2)
                {
                    $('.user_search_list_result').html(data.records);
                    
                }else
                {
                    $('.user_search_list_result').append(data.records);
                }
                
                noMoreDataSearch = searchPage >= data?.last_page;

                if(!noMoreDataSearch) searchPage += 1;
    
            },
            error: function(xhr, status, error)
            {
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
function actionOnScroll(selector, callback, topScroll = false) 
{
    $(selector).on('scroll', function () 
    {
        let element = $(this).get(0);
        const condition = topScroll ? element.scrollTop == 0 : element.scrollTop + element.clientHeight >= element.scrollHeight;

        if (condition) 
        {
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
function debounce(callback, delay) 
{
    let timerId;

    return function(...args)
    {
        clearTimeout(timerId);
        
        timerId = setTimeout(() => {
            callback.apply(this, args);
        }, delay);
    }

}//End Method

/**
 *  ---------------------------------
 * | Fetch Id data of the userr and  |
 * | append it to the DOM.           |
 *  ---------------------------------
*/
 function Idinfo(id)
 {
    $.ajax({
        method: 'GET',
        url: route('messenger.id-info'),
        data: {id: id},
        beforeSend: function(){
            NProgress.start();
            enableChatBoxLoader();
        },
        success: function(data){
            //Fetch Messages
            fetchMessages(data.fetch.id, true);
            $(".messenger-header").find("img").attr("src", data.fetch.avatar);
            $(".messenger-header").find("h4").text(data.fetch.name);
            
            $(".messenger-info-view .user_photo").find("img").attr("src", data.fetch.avatar);
            $(".messenger-info-view").find(".user_name").text(data.fetch.name);
            $(".messenger-info-view").find(".user_unique_name").text(data.fetch.user_name);
            
            NProgress.done();
            disableChatBoxLoader();

        },
        error: function(xhr, status, error){

        }
    });

 }//End Method

/** 
 *  ----------------------------
 * | Slide to bottom on action. |
 *  ----------------------------
*/
function scrolllToBottom(container)
{
    $(container).stop().animate({
        scrollTop: $(container)[0].scrollHeight
    });

}//End Method

/**
 *  ---------------
 * | On DOM Load   |
 *  ---------------
*/
$(document).ready(function()
{
    
    $('#select_file').change(function()
    {
        imagePreview(this, '.profile-image-preview');
    });

    /**
    *  ---------------------------
    * | Search on action on keyup | 
    *  --------------------------
    */
    const debouncedSearch = debounce(function() {
        const value = $('.user_search').val();
        searchUsers(value);
    }, 500);

    $('.user_search').on('keyup', function(e) {
        e.preventDefault();
        let query = $(this).val();
        if(query.length > 0)
        {
            debouncedSearch();
        }
    });

    /**
    *  ----------------------------------- 
    * | Search Pagination on Scroll Event |
    *  ----------------------------------- 
    */
    actionOnScroll(".user_search_list_result", function() {
        let value = $('.user_search').val(); 
        searchUsers(value);

    });

    /**
     *  --------------------------------------
     * | Click action for messenger List item |
     *  --------------------------------------
    */
    $("body").on('click', '.messenger-list-item', function(){
        const dataId = $(this).attr('data-id');
        setMessengerId(dataId);
        Idinfo(dataId);
    });

    /**
     *  --------------
     * | Send Message |
     *  --------------
    */
    messageForm.on('submit', function(e){
        e.preventDefault();
        sendMessage(); 
    });

    /**
     *  -------------------------------
     * | Send Attachment From Message |
     *  -------------------------------
    */
    $(".attachment-input").change(function() 
    {
        imagePreview(this, '.attachment-preview');
        $(".attachment-block").removeClass('d-none');

    });

    /**
     *  ---------------------------------
     * | cancels the attachemnt and form |
     * | resets the form.                |
     *  ---------------------------------
    */
    $(".cancel-attachment").click(function() 
    {
        messageFormReset();

    });

    /** 
     *   ----------------------------
     *  | Message Pagination method  |
     *   ----------------------------
    */
    actionOnScroll(".wsus__chat_area_body", function() {
        
        fetchMessages(getMessengerId());

    }, true);

});//End Method




