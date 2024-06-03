

/**
 *  ------------------
 * | Global Variables |
 *  ------------------
*/
var temporaryMsgId = 0;

const messageForm = $(".message-form"),
    messageInput = $(".message-input");

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
    $(".wsus__message_paceholder").addClass('d-none');

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
    let tempId = `temp_${temporaryMsgId}`; //temp_1, temp_2 ....
    const inputValue = messageInput.val();
    
    if(inputValue.length > 0)
    {
        $.ajax({
            method: 'POST',
            url: '',
            data: '',
            beforeSend: function(){
              
            },
            success: function(data){
    
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

});//End Method




