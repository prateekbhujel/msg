<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class MessengerController extends Controller
{
    
    
    /**
     * Display the messenger index view.
     *
     * @return \Illuminate\View\View
     */
    public function index(): View
    {
        return view('messenger.index');

    } //End Method


    //Search User Profiles based on input(user id and name) from the user model and rejected the logged in user id.
    public function search(Request $request)
    {
        $getRecords = null;
        $input = $request['query'];
        $records = User::where('id', '!=', Auth::user()->id)
                        ->where('name', 'LIKE', "%{$input}%")
                        ->orWhere('user_name', 'LIKE', "%{$input}%")
                        ->get();

       foreach($records as $record)
       {
            $getRecords .= view('messenger.components.search-item', compact('record'))->render();
       }

       return response()->json([
            'records' => $getRecords,
       ]);
       
    }//End Method


}
