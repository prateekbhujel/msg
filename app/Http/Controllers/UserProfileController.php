<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    
    
    public function update(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'user_id' => ['required', 'string', 'min:6', 'max:20', 'unique:users,user_name,' . auth()->user()->id],
            'email' => ['required', 'string', 'email', 'max:100', 'unique:users,email,' . auth()->user()->id],
        ]);

    }//End Method

}
