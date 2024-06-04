<?php

namespace App\Http\Controllers;

use App\Models\Message;
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


    /**
     * Search for user profiles based on input (user ID and name) from the user model, excluding the logged-in user.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
    */
    public function search(Request $request)
    {
        $getRecords = null;
        $input = $request['query'];

        $records = User::where('id', '!=', Auth::user()->id)
            ->where('name', 'LIKE', "%{$input}%")
            ->orWhere('user_name', 'LIKE', "%{$input}%")
            ->paginate(10);

        if($records->total() < 1)
        {
            $getRecords = '<p class="text-center mt-3"> No results found. </p>';
        }
        foreach ($records as $record) {
            $getRecords .= view('messenger.components.search-item', compact('record'))->render();
        }

        return response()->json([
            'records'   => $getRecords,
            'last_page' => $records->lastPage(),
        ]);
    } //End Method

    /**
     * Fetch information about the provided request ID.
     *
     * @param \Illuminate\Http\Request $request
     * @return void
    */
    public function fetchIdInfo(Request $request)
    {
        $fetch = User::where('id', $request['id'])->first();
        return response()->json([
            'fetch' => $fetch,
        ]);

    } //End Method

    /**
     * Saves a new message to the database.
     *
     * @param \Illuminate\Http\Request $request
     * @return void
    */
    public function sendMessage(Request $request)
    {
        $request->validate([
            'message'        => ['required'],
            'id'             => ['required', 'integer'],
            'temporaryMsgId' => ['required']
        ]);

        // Save message to database
        $message            = new Message();
        $message->from_id   = Auth::user()->id;
        $message->to_id     = $request->id;
        $message->body      = $request->message;
        $message->save();

        return response()->json([
            'message'   => $this->messageCard($message),
            'tempID'    => $request->temporaryMsgId,
        ]);

    } //End Method


    public function messageCard($message) 
    {
        return view('messenger.components.message-card', compact('message'))->render();

    }//End Method









}
