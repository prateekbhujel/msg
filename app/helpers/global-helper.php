<?php



    if(!function_exists('timeAgo'))
    {
        /**
         * Calculates the time difference between the current time and a given timestamp in a human-readable format.
         *
         * @param string $timestamp The timestamp to calculate the time difference for.
         * @return string The time difference in a human-readable format, such as "5s ago", "10m minutes ago", "3h hours ago", or the date in the format "j M y".
        */
        function timeAgo($timestamp)
        {
            $timeDifference =  time() - strtotime($timestamp);

            $seconds        = $timeDifference;
            $minutes        = round($timeDifference / 60);
            $hours          = round($timeDifference / 3600);
            $days           = round($timeDifference / 86400);

            if ($seconds <= 60) 
            {
                if($seconds <=1)
                    return "an second ago";    
                
                return $seconds . "s ago";

            } else
            if ($minutes <= 60) 
            {
                return $minutes . "m ago";

            } else
            if ($hours <= 24) 
            {
                return $hours . "h ago";

            } else 
            {
                return date('j M y', strtotime($timestamp));

            }
            
        } //End Method

    }

    /**
     * Truncates a string to a specified length, appending an ellipsis if the string is longer than the limit.
     *
     * @param string $string The string to truncate.
     * @param int $limit The maximum length of the string, default is 18.
     * @param string $end The string to append if the original string is truncated, default is '...'.
     * @return string The truncated string.
     */
    if (!function_exists('truncate')) {
        function truncate($string, $limit = 18, $end = '...')
        {
            return \Illuminate\Support\Str::limit($string, $limit, $end);
        }
    }
