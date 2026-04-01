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
    return [
        'id' => (int) $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar,
        'user_name' => $user->user_name,
    ];

});//End Channel

Broadcast::channel('call.user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('call.session.{uuid}', function ($user, $uuid) {
    $session = \App\Models\CallSession::where('uuid', $uuid)->first();

    return $session ? $session->hasParticipant((int) $user->id) : false;
});
