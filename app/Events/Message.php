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

    /**
     * Create a new event instance.
     */
    public function __construct($message)
    {
        $this->message = $message; 

    }//End Method


    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('message.' . $this->message->to_id), // Example: 'message.1' or 'message.2' or so on...
        ];
    }


    /**
     * Get the data to be broadcast with the event.
     *
     * @return array
     */
    public function broadcastWith(): array
    {
        $attachments = $this->message->attachmentItems();

        return [
            'id'            => $this->message->id,
            'body'          => $this->message->body,
            'to_id'         => $this->message->to_id,
            'reply_to_id'   => $this->message->reply_to_id,
            'reply_preview' => $this->message->replyPreviewPayload((int) $this->message->to_id),
            'attachment'    => $attachments[0]['path'] ?? null,
            'attachments'   => $attachments,
            'message_type'  => $this->message->message_type ?? 'text',
            'meta'          => $this->message->meta ?? [],
            'reactions'     => $this->message->reactionSummary((int) $this->message->to_id),
            'from_id'       => $this->message->from_id,
            'created_at'    => $this->message->created_at?->toIso8601String(),
        ];
        
    } //End Method


}
