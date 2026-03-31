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

Broadcast::channel('call.user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('call.session.{uuid}', function ($user, $uuid) {
    return \App\Models\CallSession::where('uuid', $uuid)
        ->where(function ($query) use ($user) {
            $query->where('caller_id', $user->id)
                ->orWhere('callee_id', $user->id);
        })
        ->exists();
});
