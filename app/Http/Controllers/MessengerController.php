<?php

namespace App\Http\Controllers;

use App\Events\Message as MessageEvent;
use App\Events\MessageReactionUpdated;
use App\Events\TypingIndicatorUpdated;
use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\Favourite;
use App\Models\Message;
use App\Models\User;
use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class MessengerController extends Controller
{
    use FileUploadTrait;

    public function index()
    {
        $favoriteList = Favourite::with('user:id,name,avatar,user_name')
            ->where('user_id', Auth::id())
            ->get();

        $groupCandidates = User::query()
            ->whereKeyNot(Auth::id())
            ->orderBy('name')
            ->get(['id', 'name', 'avatar', 'user_name']);

        return view('messenger.index', compact('favoriteList', 'groupCandidates'));
    }

    public function search(Request $request)
    {
        $getRecords = null;
        $input = $request['query'];

        $records = User::where('id', '!=', Auth::id())
            ->where(function ($query) use ($input) {
                $query->where('name', 'LIKE', "%{$input}%")
                    ->orWhere('user_name', 'LIKE', "%{$input}%");
            })
            ->paginate(10);

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
    }

    public function fetchIdInfo(Request $request)
    {
        $conversation = $this->resolveConversationFromRequest($request);
        $content = '';

        if ($conversation['type'] === 'group') {
            /** @var \App\Models\ChatGroup $group */
            $group = $conversation['group']->loadMissing('members:id,name,avatar,user_name');

            $sharedMedia = Message::query()
                ->where('group_id', $group->id)
                ->whereNotNull('attachment')
                ->latest()
                ->get();

            foreach ($sharedMedia as $photo) {
                foreach ($photo->attachmentItems() as $attachment) {
                    if (! in_array(($attachment['type'] ?? null), ['image', 'video'], true)) {
                        continue;
                    }

                    $content .= view('messenger.components.gallery-item', [
                        'photo' => $photo,
                        'attachment' => $attachment,
                    ])->render();
                }
            }

            return response()->json([
                'type' => 'group',
                'favorite' => false,
                'conversation_key' => $conversation['conversation_key'],
                'shared_photos' => $content,
                'group' => [
                    'id' => (int) $group->id,
                    'name' => $group->name,
                    'avatar' => $group->avatarPath(),
                    'user_name' => $group->memberCount() . ' members',
                    'member_count' => $group->memberCount(),
                ],
                'members' => $group->members->map(fn (User $member) => [
                    'id' => (int) $member->id,
                    'name' => $member->name,
                    'avatar' => $member->avatar,
                    'user_name' => $member->user_name,
                ])->values(),
            ]);
        }

        /** @var \App\Models\User $user */
        $user = $conversation['user'];
        $favorite = Favourite::where([
            'user_id' => Auth::id(),
            'favourite_id' => $user->id,
        ])->exists();

        $sharedPhotos = Message::query()
            ->whereNull('group_id')
            ->where(function ($query) use ($user) {
                $query->where(function ($nested) use ($user) {
                    $nested->where('from_id', Auth::id())
                        ->where('to_id', $user->id)
                        ->whereNotNull('attachment');
                })->orWhere(function ($nested) use ($user) {
                    $nested->where('from_id', $user->id)
                        ->where('to_id', Auth::id())
                        ->whereNotNull('attachment');
                });
            })
            ->latest()
            ->get();

        foreach ($sharedPhotos as $photo) {
            foreach ($photo->attachmentItems() as $attachment) {
                if (! in_array(($attachment['type'] ?? null), ['image', 'video'], true)) {
                    continue;
                }

                $content .= view('messenger.components.gallery-item', [
                    'photo' => $photo,
                    'attachment' => $attachment,
                ])->render();
            }
        }

        return response()->json([
            'type' => 'user',
            'conversation_key' => $conversation['conversation_key'],
            'fetch' => $user,
            'favorite' => $favorite,
            'shared_photos' => $content,
            'members' => [],
        ]);
    }

    public function sendMessage(Request $request)
    {
        $request->validate([
            'id' => ['nullable', 'integer'],
            'conversation_key' => ['nullable', 'string'],
            'temporaryMsgId' => ['required'],
            'message' => ['nullable', 'string', 'max:5000'],
            'reply_to_id' => ['nullable', 'integer'],
            'attachment' => ['nullable', 'file', 'max:51200'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['nullable', 'file', 'max:51200'],
            'voice_message' => ['nullable', 'file', 'max:51200', 'mimes:webm,ogg,mp3,wav,m4a,aac'],
            'voice_duration_seconds' => ['nullable', 'integer', 'min:0', 'max:120'],
        ]);

        $conversation = $this->resolveConversationFromRequest($request);
        $replyToMessage = $this->resolveReplyTarget($request, $conversation);
        $attachments = $this->collectAttachments($request);
        $voiceAttachment = $this->collectVoiceAttachment($request);
        $allAttachments = array_merge($attachments, $voiceAttachment ? [$voiceAttachment] : []);
        $voiceDurationSeconds = (int) $request->integer('voice_duration_seconds', 0);

        $message = new Message();
        $message->from_id = Auth::id();
        $message->to_id = $conversation['type'] === 'user' ? (int) $conversation['user']->id : null;
        $message->group_id = $conversation['type'] === 'group' ? (int) $conversation['group']->id : null;
        $message->reply_to_id = $replyToMessage?->id;
        $message->message_type = $voiceAttachment && empty($attachments) ? 'voice' : (! empty($allAttachments) ? 'media' : 'text');
        $message->body = $request->message;
        $message->meta = array_filter([
            'duration_seconds' => $voiceDurationSeconds > 0 ? $voiceDurationSeconds : null,
        ], static fn ($value) => $value !== null);

        if (! empty($allAttachments)) {
            $message->attachment = $allAttachments;
        }

        $message->save();
        $message->loadMissing(['fromUser:id,name,avatar,user_name', 'replyTo.fromUser', 'group.members:id,name']);

        if ($conversation['type'] === 'group') {
            $this->markGroupConversationRead((int) $conversation['group']->id, Auth::id(), (int) $message->id);
        }

        if (
            ($conversation['type'] === 'user' && Auth::id() !== (int) $conversation['user']->id)
            || ($conversation['type'] === 'group' && count($message->broadcastRecipientIds()) > 1)
        ) {
            $this->dispatchBroadcastSafely(static fn () => MessageEvent::dispatch($message));
        }

        return response()->json([
            'message' => $this->messageCard($message),
            'tempID' => $request->temporaryMsgId,
            'conversation_key' => $conversation['conversation_key'],
        ]);
    }

    public function messageCard($message)
    {
        return view('messenger.components.message-card', compact('message'))->render();
    }

    public function fetchMessages(Request $request)
    {
        $conversation = $this->resolveConversationFromRequest($request);
        $messages = $this->conversationMessagesQuery($conversation)
            ->latest()
            ->paginate(20);

        $response = [
            'last_page' => $messages->lastPage(),
            'last_message' => $messages->last(),
            'messages' => '',
        ];

        if (count($messages) < 1) {
            $name = $conversation['type'] === 'group'
                ? $conversation['group']->name
                : $conversation['user']->name;

            $prompt = $conversation['type'] === 'group'
                ? "Kick off {$name} with the first message."
                : "Say 'Hey 🖐️' to {$name} and start the conversation!!";

            $response['messages'] = "<div class='d-flex justify-content-center align-items-center h-100'>
                                            <p class='text-muted no_messages'>
                                                Oops, No Messages Here 😥 !!
                                            </p>
                                        </div>
                                        <div class='d-flex justify-content-center align-items-center mb-4'>
                                            <p class='text-muted fst-italic mt-2 no_messages'>
                                                {$prompt}
                                            </p>
                                        </div>";

            return response()->json($response);
        }

        $allMessages = '';
        foreach ($messages->reverse() as $message) {
            $allMessages .= $this->messageCard($message);
        }

        $response['messages'] = $allMessages;

        return response()->json($response);
    }

    public function fetchContacts()
    {
        $authId = (int) Auth::id();
        $directContacts = $this->buildDirectContacts($authId);
        $groupContacts = $this->buildGroupContacts($authId);

        $contacts = $directContacts
            ->concat($groupContacts)
            ->sortByDesc(fn (array $contact) => $contact['last_message_at'] ?: now()->subYears(30))
            ->values();

        if ($contacts->isEmpty()) {
            $contactHtml = "<p class='text text-muted text-center mt-5 no_contact'>Your Contacts list is empty! 😥 </p>";
        } else {
            $contactHtml = $contacts
                ->map(fn (array $contact) => $this->getContactItem($contact))
                ->implode('');
        }

        return response()->json([
            'contacts' => $contactHtml,
            'last_page' => 1,
        ]);
    }

    public function getContactItem(array $contact): string
    {
        return view('messenger.components.contact-list-item', compact('contact'))->render();
    }

    public function updateContactItem(Request $request)
    {
        $conversation = $this->resolveConversationFromRequest($request);
        $authId = (int) Auth::id();

        if ($conversation['type'] === 'group') {
            $contact = $this->buildGroupContact($conversation['group']->fresh(['members:id,name,avatar,user_name']), $authId);
        } else {
            $contact = $this->buildDirectContact($conversation['user'], $authId);
        }

        return response()->json([
            'contact_item' => $this->getContactItem($contact),
            'conversation_key' => $conversation['conversation_key'],
        ], 200);
    }

    public function makeSeen(Request $request): bool
    {
        $conversation = $this->resolveConversationFromRequest($request);

        if ($conversation['type'] === 'group') {
            $latestMessageId = Message::query()
                ->where('group_id', $conversation['group']->id)
                ->max('id');

            if ($latestMessageId) {
                $this->markGroupConversationRead((int) $conversation['group']->id, (int) Auth::id(), (int) $latestMessageId);
            }

            return true;
        }

        Message::query()
            ->whereNull('group_id')
            ->where('from_id', $conversation['user']->id)
            ->where('to_id', Auth::id())
            ->where('seen', 0)
            ->update(['seen' => 1]);

        return true;
    }

    public function favorite(Request $request)
    {
        $conversation = $this->resolveConversationFromRequest($request);
        abort_if($conversation['type'] !== 'user', 422, 'Groups cannot be favorited yet.');

        $query = Favourite::where([
            'user_id' => Auth::id(),
            'favourite_id' => $conversation['user']->id,
        ]);

        if (! $query->exists()) {
            $favorite = new Favourite();
            $favorite->user_id = Auth::id();
            $favorite->favourite_id = $conversation['user']->id;
            $favorite->save();

            return response(['status' => 'added']);
        }

        $query->delete();

        return response(['status' => 'removed']);
    }

    public function deleteMessage(Request $request)
    {
        $message = Message::findOrFail($request->message_id);
        abort_unless($message->canBeDeletedBy((int) Auth::id()), 403);

        foreach ($message->attachmentItems() as $attachment) {
            $attachmentPath = $this->resolveStoredUploadPath($attachment['path']);

            if (file_exists($attachmentPath)) {
                unlink($attachmentPath);
            }
        }

        $message->delete();

        return response()->json([
            'id' => $request->message_id,
            'message' => 'Message Deleted Successfully',
        ], 200);
    }

    public function react(Request $request, Message $message)
    {
        $request->validate([
            'emoji' => ['required', 'string', 'in:👍,❤️,😂,😮,😢,🔥'],
        ]);

        abort_unless($message->isParticipant((int) Auth::id()), 403);

        if (! $message->supportsInteractions()) {
            throw ValidationException::withMessages([
                'emoji' => 'This message does not support reactions.',
            ]);
        }

        $message->toggleReaction((string) $request->string('emoji'), (int) Auth::id());
        $message->refresh()->loadMissing(['replyTo.fromUser', 'group.members:id,name']);

        $this->dispatchBroadcastSafely(static fn () => MessageReactionUpdated::dispatch($message));

        return response()->json([
            'message_id' => $message->id,
            'reactions' => $message->reactionSummary((int) Auth::id()),
        ]);
    }

    public function createGroup(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'members' => ['required', 'array', 'min:1'],
            'members.*' => ['required', 'integer', 'exists:users,id', 'distinct'],
        ]);

        $memberIds = collect($data['members'])
            ->map(fn ($id) => (int) $id)
            ->reject(fn ($id) => $id === (int) Auth::id())
            ->unique()
            ->values();

        if ($memberIds->isEmpty()) {
            throw ValidationException::withMessages([
                'members' => 'Choose at least one other person for the group.',
            ]);
        }

        $group = ChatGroup::create([
            'owner_id' => Auth::id(),
            'name' => trim($data['name']),
            'avatar' => 'default/avatar.png',
        ]);

        $attachPayload = $memberIds
            ->prepend((int) Auth::id())
            ->unique()
            ->mapWithKeys(fn ($id) => [$id => [
                'created_at' => now(),
                'updated_at' => now(),
            ]])
            ->all();

        $group->members()->attach($attachPayload);

        $contact = $this->buildGroupContact($group->fresh(['members:id,name,avatar,user_name']), (int) Auth::id());

        return response()->json([
            'group' => [
                'id' => (int) $group->id,
                'name' => $group->name,
                'conversation_key' => $group->conversationKey(),
            ],
            'contact_item' => $this->getContactItem($contact),
        ], 201);
    }

    public function typing(Request $request)
    {
        $request->validate([
            'conversation_key' => ['required', 'string'],
            'typing' => ['nullable', 'boolean'],
        ]);

        $conversation = $this->resolveConversationFromRequest($request);
        $typing = $request->boolean('typing', true);
        $authId = (int) Auth::id();

        $recipientIds = $conversation['type'] === 'group'
            ? $conversation['group']->members()->pluck('users.id')->map(fn ($id) => (int) $id)->reject(fn ($id) => $id === $authId)->values()->all()
            : collect([(int) $conversation['user']->id])->reject(fn ($id) => $id === $authId)->values()->all();

        if (! empty($recipientIds)) {
            $this->dispatchBroadcastSafely(static fn () => TypingIndicatorUpdated::dispatch(
                $recipientIds,
                $conversation['conversation_key'],
                $authId,
                Auth::user()->name,
                $typing
            ));
        }

        return response()->json([
            'ok' => true,
        ]);
    }

    protected function collectAttachments(Request $request): array
    {
        $attachments = [];

        if ($request->hasFile('attachments')) {
            $files = $request->file('attachments');
            $files = is_array($files) ? $files : [$files];

            foreach ($files as $file) {
                if ($file instanceof UploadedFile) {
                    $storedPath = $this->storeUploadedFile($file, 'uploads/messages');
                    $attachments[] = $this->buildAttachmentPayload($file, $storedPath);
                }
            }
        }

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');

            if ($file instanceof UploadedFile) {
                $storedPath = $this->storeUploadedFile($file, 'uploads/messages');
                $attachments[] = $this->buildAttachmentPayload($file, $storedPath);
            }
        }

        return $attachments;
    }

    protected function collectVoiceAttachment(Request $request): ?array
    {
        if (! $request->hasFile('voice_message')) {
            return null;
        }

        $file = $request->file('voice_message');

        if (! $file instanceof UploadedFile) {
            return null;
        }

        $storedPath = $this->storeUploadedFile($file, 'uploads/voice-notes');

        return $this->buildAttachmentPayload($file, $storedPath, 'audio');
    }

    protected function resolveReplyTarget(Request $request, array $conversation): ?Message
    {
        $replyToId = (int) $request->integer('reply_to_id', 0);

        if ($replyToId < 1) {
            return null;
        }

        $replyMessage = $this->conversationMessagesQuery($conversation)
            ->whereKey($replyToId)
            ->first();

        if (! $replyMessage) {
            throw ValidationException::withMessages([
                'reply_to_id' => 'The selected reply target is not part of this conversation.',
            ]);
        }

        if (! $replyMessage->supportsInteractions()) {
            throw ValidationException::withMessages([
                'reply_to_id' => 'Call history items cannot be replied to.',
            ]);
        }

        return $replyMessage;
    }

    protected function resolveConversationFromRequest(Request $request): array
    {
        $conversationKey = trim((string) $request->input('conversation_key', ''));

        if ($conversationKey === '') {
            $fallbackId = (int) $request->integer('id', $request->integer('user_id', 0));
            if ($fallbackId > 0) {
                $conversationKey = 'user:' . $fallbackId;
            }
        }

        if ($conversationKey === '') {
            throw ValidationException::withMessages([
                'conversation_key' => 'Select a conversation first.',
            ]);
        }

        if (str_starts_with($conversationKey, 'group:')) {
            $groupId = (int) substr($conversationKey, strlen('group:'));
            $group = ChatGroup::query()
                ->whereKey($groupId)
                ->whereHas('members', fn ($query) => $query->where('users.id', Auth::id()))
                ->firstOrFail();

            return [
                'type' => 'group',
                'conversation_key' => $conversationKey,
                'group' => $group,
            ];
        }

        $userId = str_starts_with($conversationKey, 'user:')
            ? (int) substr($conversationKey, strlen('user:'))
            : (int) $conversationKey;

        $user = User::query()->findOrFail($userId);

        return [
            'type' => 'user',
            'conversation_key' => 'user:' . $user->id,
            'user' => $user,
        ];
    }

    protected function conversationMessagesQuery(array $conversation)
    {
        $query = Message::query()->with(['fromUser:id,name,avatar,user_name', 'replyTo.fromUser', 'group.members:id,name']);

        if ($conversation['type'] === 'group') {
            return $query->where('group_id', $conversation['group']->id);
        }

        return $query->whereNull('group_id')
            ->where(function ($builder) use ($conversation) {
                $builder->where(function ($nested) use ($conversation) {
                    $nested->where('from_id', Auth::id())
                        ->where('to_id', $conversation['user']->id);
                })->orWhere(function ($nested) use ($conversation) {
                    $nested->where('from_id', $conversation['user']->id)
                        ->where('to_id', Auth::id());
                });
            });
    }

    protected function buildDirectContacts(int $authId): Collection
    {
        $userIds = Message::query()
            ->whereNull('group_id')
            ->where(function ($query) use ($authId) {
                $query->where('from_id', $authId)
                    ->orWhere('to_id', $authId);
            })
            ->get(['from_id', 'to_id'])
            ->flatMap(fn (Message $message) => [(int) $message->from_id, (int) $message->to_id])
            ->reject(fn ($id) => $id === $authId)
            ->unique()
            ->values();

        if ($userIds->isEmpty()) {
            return collect();
        }

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'name', 'avatar', 'user_name']);

        return $users
            ->map(fn (User $user) => $this->buildDirectContact($user, $authId))
            ->values();
    }

    protected function buildGroupContacts(int $authId): Collection
    {
        return ChatGroup::query()
            ->with(['members:id,name,avatar,user_name'])
            ->whereHas('members', fn ($query) => $query->where('users.id', $authId))
            ->get()
            ->map(fn (ChatGroup $group) => $this->buildGroupContact($group, $authId))
            ->values();
    }

    protected function buildDirectContact(User $user, int $authId): array
    {
        $lastMessage = Message::query()
            ->with('fromUser:id,name')
            ->whereNull('group_id')
            ->where(function ($query) use ($user, $authId) {
                $query->where(function ($nested) use ($user, $authId) {
                    $nested->where('from_id', $authId)
                        ->where('to_id', $user->id);
                })->orWhere(function ($nested) use ($user, $authId) {
                    $nested->where('from_id', $user->id)
                        ->where('to_id', $authId);
                });
            })
            ->latest()
            ->first();

        $unseenCounter = Message::query()
            ->whereNull('group_id')
            ->where('from_id', $user->id)
            ->where('to_id', $authId)
            ->where('seen', 0)
            ->count();

        return [
            'conversation_key' => 'user:' . $user->id,
            'conversation_type' => 'user',
            'user_id' => (int) $user->id,
            'group_id' => null,
            'avatar' => $user->avatar,
            'name' => $user->name,
            'secondary' => $user->user_name,
            'preview' => $lastMessage ? $lastMessage->previewText($authId) : 'Say hi and start the conversation.',
            'unseen_count' => $unseenCounter,
            'last_message_at' => $lastMessage?->created_at,
        ];
    }

    protected function buildGroupContact(ChatGroup $group, int $authId): array
    {
        $lastMessage = Message::query()
            ->with('fromUser:id,name')
            ->where('group_id', $group->id)
            ->latest()
            ->first();

        $membership = ChatGroupMember::query()
            ->where('chat_group_id', $group->id)
            ->where('user_id', $authId)
            ->first();

        $lastReadId = (int) ($membership?->last_read_message_id ?? 0);
        $unseenCounter = Message::query()
            ->where('group_id', $group->id)
            ->where('from_id', '!=', $authId)
            ->when($lastReadId > 0, fn ($query) => $query->where('id', '>', $lastReadId))
            ->count();

        return [
            'conversation_key' => $group->conversationKey(),
            'conversation_type' => 'group',
            'user_id' => null,
            'group_id' => (int) $group->id,
            'avatar' => $group->avatarPath(),
            'name' => $group->name,
            'secondary' => $group->members->count() . ' members',
            'preview' => $lastMessage ? $lastMessage->previewText($authId) : 'Create the first message for this group.',
            'unseen_count' => $unseenCounter,
            'last_message_at' => $lastMessage?->created_at,
        ];
    }

    protected function markGroupConversationRead(int $groupId, int $userId, int $messageId): void
    {
        ChatGroupMember::query()->updateOrCreate(
            [
                'chat_group_id' => $groupId,
                'user_id' => $userId,
            ],
            [
                'last_read_message_id' => $messageId,
            ]
        );
    }

    protected function dispatchBroadcastSafely(callable $dispatcher): void
    {
        try {
            $dispatcher();
        } catch (\Throwable $throwable) {
            report($throwable);
        }
    }
}
