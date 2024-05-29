<?php

namespace App\Http\Controllers;

use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserProfileController extends Controller
{
    use FileUploadTrait;
    
    /**
     * Update the user's profile information after verification.
     */
    public function update(Request $request)
    {
        $request->validate([
            'avatar' => ['nullable', 'image', 'max:500'],
            'name' => ['required', 'string', 'max:50'],
            'user_id' => [
                'required',
                'string',
                'min:6',
                'max:20',
                'regex:/^[a-z0-9.]+$/', // Only lowercase letters, numbers, and dots(.)
                'unique:users,user_name,' . auth()->user()->id
            ],
            'email' => [
                'required',
                'string',
                'email',
                'max:100',
                'unique:users,email,' . auth()->user()->id
            ],
        ], [
            'user_id.regex' => 'The user id can only contain lowercase letters, numbers, and dots(.).'
        ]);

        $avatarPath = $this->uploadFile($request, 'avatar');
        
        $user = Auth::user();

        if($avatarPath) $user->avatar = $avatarPath;

        $user->name = $request->name;
        $user->user_name = $request->user_id;
        $user->email = $request->email;
        $user->save();

        notyf()->addSuccess('Updated Successfully.');;
        return response()->json(['message' => 'Updated Successfully.'], 200);

    } //End Method

}
