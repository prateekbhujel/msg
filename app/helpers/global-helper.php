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