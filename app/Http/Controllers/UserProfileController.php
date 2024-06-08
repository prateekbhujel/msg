<?php

namespace App\Http\Controllers;

use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserProfileController extends Controller
{
    use FileUploadTrait;
    
    /*
    |--------------------------------------------------------------------------
    | Update Function
    |--------------------------------------------------------------------------
    |
    | This Function is responsible for handling user profile updates
    | before saving the updated data to the database, it first checks,
    | file and size and checks, if the user_name is unique and
    | if the user_name is valid and passes the validation rules.
    | Then save the data into the database.
    |
    */
    public function update(Request $request)
    {
        $request->validate([
            'avatar' => ['nullable', 'image', 'max:500'],
            'name' => ['required', 'string', 'max:50'],
            'user_id' => [
                'required',
                'string',
                'min:7',
                'max:100',
                'regex:/^@[a-z0-9._-]+$/', // Only lowercase letters, numbers, dots, hyphens, and underscores and must have @ in the beginning
                'unique:users,user_name,' . auth()->user()->id
            ],
            'email' => [
                'required',
                'string',
                'email',
                'max:100',
                'unique:users,email,' . auth()->user()->id
            ],
        ],
         [
            'user_id.regex' => 'Invalid characters. Must start with @. [a,12,.,-,_]',
        ]);
        
        $user = Auth::user();

        // Validating password and saving
        if ($request->filled('current_password')) {
            $request->validate([
                'current_password' => ['required', 'current_password', 'min:8'],
                'password' => ['required', 'string', 'min:8', 'confirmed']
            ]);

            $user->password = bcrypt($request->password);
        }

        // Saving the rest of the fields
        $avatarPath = $this->uploadFile($request, 'avatar');
        if ($avatarPath) {
            $user->avatar = $avatarPath;
        }

        $user->name = $request->name;
        
        // Remove any '@' characters from the input and ensure the username starts with '@'
        $user_name = str_replace('@', '', $request->user_id);
        if (substr($user_name, 0, 1) !== '@') {
            $user_name = '@' . $user_name;
        }
        $user->user_name = strtolower($user_name);
        
        $user->email = $request->email;
        $user->save();

        notyf()->addSuccess('Updated Successfully.');
        return response()->json(['message' => 'Updated Successfully.'], 200);
        
    } // End Method
}
