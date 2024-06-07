<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class Message extends Model
{
    use HasFactory;
    
    protected $fillable = ['seen'];
    /**
     * Encrypt the message body before saving to the database.
     *
     * @param string $value The message body to be encrypted.
     * @return void
    */
    public function setBodyAttribute($value)
    {
        $this->attributes['body'] = $value ? Crypt::encrypt($value) : null;

    }//End Method

    /**
     * Decrypt the message body after retrieving from the database.
     *
     * @param string $value The encrypted message body to be decrypted.
     * @return string|null The decrypted message body, or null if the value is null.
    */
    public function getBodyAttribute($value)
    {
        return $value ? Crypt::decrypt($value) : null;

    } //End Method


}
