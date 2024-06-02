
/**
 * ----------------------
 * | Resuable Function   |
 * ----------------------
*/
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

}

/**
 * -----------------------
 * | User Search Function |
 * -----------------------
*/
function searchUsers(query)
{
    $.ajax({
        method: 'GET',
        url:  route('messenger.search'),
        data: { query: query },
        success: function(data){
            
            $('.user_search_list_result').html(data.records);

        },
        error: function(xhr, status, error){

        }
    });
}

/**
 * ---------------------------------------
 * | Attaches a scroll event listener     |
 * | to the specified selector and calls  |
 * | the provided callback function when  |
 * | the scroll reaches the top or bottom |
 * | of the element.                      |
 * ---------------------------------------
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
}


/**
 * ----------------------------------
 * | Debounces a function,           |
 * | ensuring that it is only        |
 * | called after a specified delay. |
 * ----------------------------------
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

}

/**
 * ---------------------
 * |    On DOM Load     |
 * ---------------------
*/
$(document).ready(function()
{
    
    $('#select_file').change(function()
    {
        imagePreview(this, '.profile-image-preview');
    });

    //Search action on keyup
    const debouncedSearch = debounce(function() {
        const value = $('.user_search').val();
        searchUsers(value);
    }, 500);

    $('.user_search').on('keyup', function()
    {
        // e.preventDefault();

        let query = $(this).val();
        if(query.length > 0)
        {
            debouncedSearch();
        }
    });

    // Search pagination
    actionOnScroll(".user_search_list_result", function(){
        let value = $('.user_search').val();
        searchUsers(value);
    });

});


