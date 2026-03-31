<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'caller_id',
        'callee_id',
        'call_type',
        'status',
        'accepted_at',
        'ended_at',
        'history_message_id',
    ];

    protected $casts = [
        'caller_id' => 'integer',
        'callee_id' => 'integer',
        'history_message_id' => 'integer',
        'accepted_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    public function callee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'callee_id');
    }

    public function historyMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'history_message_id');
    }
}
