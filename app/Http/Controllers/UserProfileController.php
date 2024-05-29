<?php

namespace App\Http\Controllers;

use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    use FileUploadTrait;
    
    /**
     * Update the user's profile information.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request)
    {dd($request->all());
        $request->validate([
            'avatar' => ['nullable', 'image', 'max:500'],
            'name' => ['required', 'string', 'max:50'],
            'user_id' => ['required', 'string', 'min:6', 'max:20', 'unique:users,user_name,' . auth()->user()->id],
            'email' => ['required', 'string', 'email', 'max:100', 'unique:users,email,' . auth()->user()->id],
        ]);

        $avatarPath = $this->uploadFile($request, 'avatar');
        dd($avatarPath);

    } //End Method

}
