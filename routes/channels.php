<?php

use Illuminate\Support\Facades\Broadcast;


Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    
    return (int) $user->id === (int) $id;

});//End Channel


//Message Broadcast Channel
Broadcast::channel('message.{id}', function ($user, $id) {

    return (int) $user->id === (int) $id;

});//End Channel


//User Presence Broadcast Channel
Broadcast::channel('online', function($user){
    
    return $user->only('id');

});//End Channel