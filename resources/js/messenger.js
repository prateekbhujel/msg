

/**
 * --------------------
 * Resuable Function
 * --------------------
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
 * --------------------
 * On DOM Load
 * --------------------
 */
$(document).ready(function()
{
    
    $('#select_file').change(function()
    {
        imagePreview(this, '.profile-image-preview');
    });

});