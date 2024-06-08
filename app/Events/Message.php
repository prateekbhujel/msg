<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class Message implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $receiver_id;

    /**
     * Create a new event instance.
     */
    public function __construct($message, $receiver_id)
    {
        $this->message = $message;
        $this->receiver_id = $receiver_id;  

    }//End Method


    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('message.' . $this->receiver_id), // Example: 'message.1' or 'message.2' or so on...
        ];
    }


    /**
     * Get the data to be broadcast with the event.
     *
     * @return array
     */
    public function broadcastWith(): array
    {
        return [
            'message'       => $this->message,
            'receiver_id'   => $this->receiver_id,
            'auth_id'       => auth()->user()->id,
        ];
        
    } //End Method


}
