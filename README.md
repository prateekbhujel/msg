# Msg

Laravel 12 messenger with real-time chat, groups, voice notes, media sharing, WebRTC calls, reactions, replies, typing indicators, and installable PWA support.

## Highlights

- Real-time direct and group messaging with Laravel Echo / Pusher
- Group creation with shared history and member sidebar
- Voice notes with 2 minute cap, compact custom player, and duration labels
- Multi-file uploads for images, video, audio, and documents
- Replies, reactions, and typing indicators
- WebRTC audio/video calls with:
  - missed / not answered call states
  - in-chat call history
  - incoming call ringtone + browser notifications
  - screen sharing during active video calls
- Profile editing and username handles
- Shared media gallery
- Installable PWA shell with manifest + service worker
- Local chat color themes with saved preference
- Message-body encryption at rest through Laravel `Crypt`

## Stack

- Laravel 12
- PHP 8.2+
- MySQL / MariaDB
- Vite
- jQuery
- Bootstrap
- Laravel Echo
- Pusher-compatible websocket transport
- WebRTC for calls

## Local Setup

1. Clone the repo

```bash
git clone git@github.com:prateekbhujel/msg.git
cd msg
```

2. Install backend dependencies

```bash
composer install
```

3. Install frontend dependencies

```bash
npm install
```

4. Create the environment file

```bash
cp .env.example .env
```

5. Configure at minimum:

```env
APP_NAME="Msg"
APP_URL=http://localhost/msg

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=msg
DB_USERNAME=root
DB_PASSWORD=

BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=mt1

VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"

# Optional: custom STUN/TURN
WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
```

6. Generate the app key and migrate

```bash
php artisan key:generate
php artisan migrate
```

7. Run the app

```bash
npm run dev
```

Serve the project through your local web server/XAMPP path, or use:

```bash
php artisan serve
```

## Production Build

```bash
npm run build
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear
```

## PWA

The messenger now ships with:

- `public/manifest.webmanifest`
- `public/sw.js`
- installable app metadata
- home-screen / desktop install support on supported browsers

Note:
- incoming call system notifications work when the page is open and notification permission is granted
- true closed-browser push calling still needs a dedicated push service layer

## Calls

Call history states currently support:

- ringing
- connected
- declined
- missed / not answered
- ended with duration

Screen sharing is available in active video calls on browsers that support `getDisplayMedia`.

## Security Notes

- Message bodies are encrypted at rest in the database using Laravel `Crypt`
- WebRTC media is encrypted in transit by the browser stack
- This is not yet full client-side end-to-end encryption with key exchange

## Testing

```bash
php artisan test --testsuite=Feature --stop-on-failure
npm run build
```

## Deployment Notes

This project is currently deployed on cPanel/shared hosting.

Typical deploy flow:

```bash
npm run build
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear
```

If the host worktree is dirty, sync changed files and `public/build` assets carefully instead of forcing a pull.

## Important

- Uploaded runtime media is ignored through `.gitignore`
- For shared hosting, make sure `public/uploads` is writable
- Browser notifications require user permission
- Group chat creation is available from the left sidebar top action
