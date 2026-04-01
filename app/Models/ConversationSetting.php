<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'direct_user_a_id',
        'direct_user_b_id',
        'group_id',
        'disappear_after',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(ChatGroup::class, 'group_id');
    }
}
