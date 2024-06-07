<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Favourite extends Model
{
    use HasFactory;

    protected $fillable = [];


    /**
     * Get the user that the favorite belongs to.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class,'favourite_id',  'id');

    } //Emd Method
}
