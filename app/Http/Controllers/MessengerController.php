<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\User;
use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class MessengerController extends Controller
{
    
    use FileUploadTrait;

    
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
                        ->where(function ($q) use ($input) {
                                $q->where('name', 'LIKE', "%{$input}%")
                                  ->orWhere('user_name', 'LIKE', "%{$input}%");
                        })->paginate(10);

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
     * Saves a new message to the db,
     * and encrypts the message body 
     *  while saving to db and uploads
     * the attachment also decrypts
     * the body and pass it to the response,
     * in message ensuring the message privacy
     * and safety of the user.
     * @param \Illuminate\Http\Request $request
     * @return void
    */
    public function sendMessage(Request $request)
    {
        $request->validate([
            // 'message'        => ['required'],
            'id'             => ['required', 'integer'],
            'temporaryMsgId' => ['required'],
            'attachment'    =>  ['nullable', 'max:2048', 'image'],
        ]);

        // Storing the  data to database and encrypting the message body.
        $attachmentPath     = $this->uploadFile($request, 'attachment');
        $message            = new Message();
        $message->from_id   = Auth::user()->id;
        $message->to_id     = $request->id;
        $message->body      =  $message->body = $request->message ? Crypt::encrypt($request->message) : null;
        if($attachmentPath) 
            $message->attachment = json_encode($attachmentPath);
        $message->save();
        $message->body = $message->body ? Crypt::decrypt($message->body) : null;

        return response()->json([
            'message'   => $message->attachment ?  $this->messageCard($message, true) : $this->messageCard($message),
            'tempID'    => $request->temporaryMsgId,
        ]);

    } //End Method


    public function messageCard($message, $attachment = false) 
    {
        
        return view('messenger.components.message-card', compact('message',  'attachment'))->render();

    }//End Method


    /**
     * Fetches messages from the database
     * for the authenticated user.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function fetchMessages(Request $request)
    {
        $messages = Message::where(function ($q) use ($request) {
                            $q->where('from_id', Auth::id())
                            ->where('to_id', $request->id);
                            })->orWhere(function ($q) use ($request) {
                            $q->where('from_id', $request->id)
                            ->where('to_id', Auth::id());
                        })->latest()->paginate(20);

        $response = [
            'last_page'    => $messages->lastPage(),
            'last_message' => $messages->last(),
            'messages'     => '',
        ];

        if(count($messages) < 1)
        {
            $name = User::where('id', $request->id)->first()->name;

            $response['messages'] = "<div class='d-flex justify-content-center align-items-center h-100'>
                                            <p class='text-muted'>
                                                Oops, No Messages Here 😥 !!
                                            </p>
                                        </div>
                                        <div class='d-flex justify-content-center align-items-center mb-4'>
                                            <p class='text-muted fst-italic mt-2'>
                                                Say 'Hey 🖐️' to {$name} and start the conversation!!
                                            </p>
                                        </div>
                                    ";
            
        
            return response()->json($response);
        }
        
        $allMessages = '';
        foreach ($messages->reverse() as $message) 
        {
            $message->body = $message->body ? Crypt::decrypt($message->body) : null;
        
            
            $allMessages .= $this->messageCard($message, $message->attachment ? true : false);
        }

        $response['messages'] = $allMessages;

        return response()->json($response);

    } //End Method

    /**
     * Fetches a paginated list of contacts for 
     * the authenticated user.
     *
     * This method joins the `messages` and `users` tables
     * to retrieve a list of users that the authenticated 
     * user has had a conversation with. It orders the results 
     * by the most recent message and groups the results by 
     * user ID, paginating the response.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Pagination\LengthAwarePaginator
     */
    function fetchContacts(Request $request)
    {
        $users = Message::join('users', function ($join) {
                        $join->on('messages.from_id', '=', 'users.id')
                            ->orOn('messages.to_id', '=', 'users.id');
                        })
                            ->where(function ($q) {
                            $q->where('messages.from_id', Auth::user()->id)
                            ->orWhere('messages.to_id', Auth::user()->id);
                        })
                            ->where('users.id', '!=', Auth::user()->id)
                            ->select('users.*', DB::raw('MAX(messages.created_at) max_created_at'))
                            ->orderBy('max_created_at', 'desc')
                            ->groupBy('users.id', 'users.avatar', 'users.name','users.user_name', 'users.email', 'users.email_verified_at', 'users.password', 'users.remember_token', 'users.created_at', 'users.updated_at')
                            ->paginate(10);

        return $users;

    } //End Method



}
