<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\User;
use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class MessengerController extends Controller
{
    use FileUploadTrait;


    /**
     * Displays the main messenger interface.
     *
     * This method returns the view for the main messenger interface, which allows users to send and receive messages.
     *
     * @return \Illuminate\View\View The view for the main messenger interface.
    */
    public function index(): View
    {
        return view('messenger.index');

    } //End Method

    /**
     * Searches for users based on the provided query and returns the search results.
     *
     * This method takes a search query from the request, and returns a JSON response containing the search results. The search is performed on the user's name and username, and the results are paginated.
     *
     * @param \Illuminate\Http\Request $request The incoming HTTP request, which must contain the search query.
     * @return \Illuminate\Http\JsonResponse A JSON response containing the search results and the last page of the pagination.
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

        if ($records->total() < 1) {
            $getRecords = '<p class="text-center mt-3"> No results found. </p>';
        }
        foreach ($records as $record) {
            $getRecords .= view('messenger.components.search-item', compact('record'))->render();
        }

        return response()->json([
            'records' => $getRecords,
            'last_page' => $records->lastPage(),
        ]);
    } //End Method

    /**
     * Fetches user information for the specified user ID.
     *
     * This method takes a request containing the user ID, and returns a JSON response with the fetched user information.
     *
     * @param \Illuminate\Http\Request $request The incoming HTTP request, which must contain the user ID.
     * @return \Illuminate\Http\JsonResponse A JSON response containing the fetched user information.
    */
    public function fetchIdInfo(Request $request)
    {
        $fetch = User::where('id', $request['id'])->first();
        return response()->json([
            'fetch' => $fetch,
        ]);
    } //End Method

    /**
     * Sends a message from the authenticated user to the user with the specified ID.
     *
     * This method validates the incoming request, uploads any attached file, creates a new message, and returns a JSON response containing the message card HTML and the temporary message ID.
     *
     * @param \Illuminate\Http\Request $request The incoming HTTP request, which must contain the ID of the recipient, the temporary message ID, and an optional file attachment.
     * @return \Illuminate\Http\JsonResponse A JSON response containing the message card HTML and the temporary message ID.
    */
    public function sendMessage(Request $request)
    {
        $request->validate([
            'id' => ['required', 'integer'],
            'temporaryMsgId' => ['required'],
            'attachment' => ['nullable', 'max:2048', 'image'],
        ]);

        $attachmentPath = $this->uploadFile($request, 'attachment');
        $message = new Message();
        $message->from_id = Auth::user()->id;
        $message->to_id = $request->id;
        $message->body = $request->message;
        if ($attachmentPath) {
            $message->attachment = json_encode($attachmentPath);
        }
        $message->save();

        return response()->json([
            'message' => $message->attachment ? $this->messageCard($message, true) : $this->messageCard($message),
            'tempID' => $request->temporaryMsgId,
        ]);

    }//End Method

    /**
     * Generates a message card HTML for a given message.
     *
     * This method takes a message object and an optional boolean flag indicating whether the message has an attachment. It then renders a view that generates the HTML for the message card, which can be used to display the message in the user interface.
     *
     * @param \App\Models\Message $message The message object for which to generate the message card.
     * @param bool $attachment Whether the message has an attachment.
     * @return string The rendered HTML for the message card.
    */
    public function messageCard($message, $attachment = false)
    {
        return view('messenger.components.message-card', compact('message', 'attachment'))->render();

    } //End Method


    /**
     * Fetches a paginated list of messages between the authenticated user and the user with the specified ID.
     *
     * This method retrieves a paginated list of messages between the authenticated user and the user with the specified ID.
     * The messages are ordered by the latest message first, and 20 messages are returned per page.
     *
     * @param \Illuminate\Http\Request $request The incoming HTTP request, which must contain the ID of the user to fetch messages for.
     * @return \Illuminate\Http\JsonResponse A JSON response containing the list of messages, the last page number, and the last message.
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
            'last_page' => $messages->lastPage(),
            'last_message' => $messages->last(),
            'messages' => '',
        ];

        if (count($messages) < 1) {
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
        foreach ($messages->reverse() as $message) {
            $allMessages .= $this->messageCard($message, $message->attachment ? true : false);
        }

        $response['messages'] = $allMessages;

        return response()->json($response);
    } //End Method


    /**
     * Fetches a paginated list of contacts for the authenticated user.
     *
     * This method retrieves a list of users that the authenticated user has
     * previously messaged, ordered by the most recent message. The list is
     * paginated with 10 contacts per page.
     *
     * @param \Illuminate\Http\Request $request The incoming HTTP request.
     * @return \Illuminate\Http\JsonResponse A JSON response containing the list of contacts and the last page number.
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
            ->groupBy('users.id', 'users.avatar', 'users.name', 'users.user_name', 'users.email', 'users.email_verified_at', 'users.password', 'users.remember_token', 'users.created_at', 'users.updated_at')
            ->paginate(10);

        if (count($users) > 0) {
            $contacts = '';
            foreach ($users as $user) {
                $contacts .= $this->getContactItem($user);
            }
        } else {
            $contacts = "<p>Your Contacts list is empty! </p>";
        }

        return response()->json([
            'contacts' => $contacts,
            'last_page' => $users->lastPage()
        ]);

    }//End Method


    /**
     * Generates a contact list item view for a given user.
     *
     * @param \App\Models\User $user The user to generate the contact list item for.
     * @return string The rendered contact list item view.
    */
    public function getContactItem($user)
    {
        $lastMessage = Message::where(function ($q) use ($user) {
            $q->where('from_id', Auth::id())
                ->where('to_id', $user->id);
        })->orWhere(function ($q) use ($user) {
            $q->where('from_id', $user->id)
                ->where('to_id', Auth::id());
        })->latest()->first();

        $unseenCounter = Message::where(function ($q) use ($user) {
            $q->where('from_id', $user->id)
                ->where('to_id', Auth::user()->id)
                ->where('seen', 0);
        })->count();

        return view('messenger.components.contact-list-item', compact('lastMessage', 'unseenCounter', 'user'))->render();
    } //End Method


    /**
     * Updates the contact item for a given user.
     *
     * @param \Illuminate\Http\Request $request The request containing the user ID.
     * @return \Illuminate\Http\JsonResponse The updated contact item.
    */
    function updateContactItem(Request $request)
    {
        //Gets the User data
        $user = User::where('id', $request->user_id)->first();

        //Validating if the user cannt be find in db
        if (!$user) {
            return response()->json([
                'message'   => 'User was not Found.'
            ], 401);
        }

        $contactItem = $this->getContactItem($user);
        return response()->json([
            'contact_item' => $contactItem
        ], 200);
        
    } //End Method


}
