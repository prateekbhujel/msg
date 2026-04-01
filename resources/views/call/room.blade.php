<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="csrf_token" content="{{ csrf_token() }}">
    <meta name="auth_id" content="{{ auth()->id() }}">
    <meta name="asset-url" content="{{ asset('') }}">
    <meta name="webrtc-ice-servers" content='@json(config("services.webrtc.ice_servers"))'>
    <meta name="call-room-token" content="{{ $roomToken }}">
    <meta name="call-room-id" content="{{ $session->uuid }}">
    <meta name="theme-color" content="#050816">
    <title>{{ config('app.name') }} Call</title>
    <link rel="icon" type="image/png" href="{{ asset('assets/images/icon.png') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/all.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/responsive.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/call-room.css') }}">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.css">
    @routes
    @vite(['resources/js/bootstrap.js', 'resources/js/call-room.js'])
</head>
<body class="call-room-page">
    <script id="call-room-session" type="application/json">@json($sessionPayload)</script>
    <script id="call-room-invite-candidates" type="application/json">@json($inviteCandidates)</script>

    <main class="call-room" data-call-room>
        <div class="call-room__backdrop"></div>

        <section class="call-room__topbar">
            <div class="call-room__identity">
                <div class="call-room__avatar" data-call-identity-avatar style="background-image: url('{{ asset(data_get($sessionPayload, 'caller.avatar', 'default/avatar.png')) }}');"></div>
                <div class="call-room__identity-copy">
                    <span class="call-room__eyebrow" data-call-eyebrow>{{ count(data_get($sessionPayload, 'participant_ids', [])) > 2 ? 'Group call' : 'Call room' }}</span>
                    <h1 class="call-room__title" data-call-title>Connecting…</h1>
                    <p class="call-room__status" data-call-status>Preparing the room</p>
                </div>
            </div>
            <div class="call-room__topbar-actions">
                <button type="button" class="call-room__topbar-button" data-call-open-chat>
                    <i class="far fa-comments"></i>
                    <span>Back to chat</span>
                </button>
            </div>
        </section>

        <section class="call-room__stage" data-call-stage>
            <div class="call-room__grid" data-call-grid></div>

            <div class="call-room__empty-state" data-call-empty-state>
                <div class="call-room__empty-avatar" data-call-empty-avatar style="background-image: url('{{ asset(data_get($sessionPayload, 'caller.avatar', 'default/avatar.png')) }}');"></div>
                <div class="call-room__empty-copy">
                    <strong data-call-empty-name>{{ data_get($sessionPayload, 'caller.name', 'Call participant') }}</strong>
                    <span data-call-empty-label>Waiting for everyone to join…</span>
                </div>
            </div>

            <div class="call-room__pip is-hidden" data-local-pip>
                <video class="call-room__pip-video" data-local-video autoplay playsinline muted></video>
                <button type="button" class="call-room__pip-reposition" data-local-pip-reposition aria-label="Move local preview">
                    <i class="fas fa-arrows-alt"></i>
                </button>
            </div>

            <div class="call-room__floating-bursts" data-reaction-bursts aria-hidden="true"></div>
        </section>

        <section class="call-room__overlay" data-call-overlay>
            <div class="call-room__overlay-card">
                <div class="call-room__overlay-avatar" data-call-overlay-avatar style="background-image: url('{{ asset(data_get($sessionPayload, 'caller.avatar', 'default/avatar.png')) }}');"></div>
                <h2 data-call-overlay-title>{{ data_get($sessionPayload, 'caller.name', 'Call participant') }}</h2>
                <p data-call-overlay-copy>Joining the room…</p>
            </div>
        </section>

        <section class="call-room__invite-sheet is-hidden" data-invite-sheet>
            <div class="call-room__invite-sheet-header">
                <div>
                    <h3>Add people</h3>
                    <p>Bring more people into this call, up to six participants.</p>
                </div>
                <button type="button" class="call-room__icon-button" data-invite-close aria-label="Close invite panel">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="call-room__invite-list" data-invite-list></div>
        </section>

        <section class="call-room__reaction-tray is-hidden" data-reaction-tray>
            <button type="button" data-call-reaction="👍">👍</button>
            <button type="button" data-call-reaction="❤️">❤️</button>
            <button type="button" data-call-reaction="😂">😂</button>
            <button type="button" data-call-reaction="😮">😮</button>
            <button type="button" data-call-reaction="😢">😢</button>
            <button type="button" data-call-reaction="👏">👏</button>
            <button type="button" data-call-reaction="🎉">🎉</button>
            <button type="button" data-call-reaction="🔥">🔥</button>
        </section>

        <section class="call-room__controls" data-call-controls>
            <div class="call-room__pill">
                <button type="button" class="call-room__control" data-control="mic" aria-label="Toggle microphone">
                    <i class="fas fa-microphone"></i>
                    <span>Mic</span>
                </button>
                <button type="button" class="call-room__control" data-control="camera" aria-label="Toggle camera">
                    <i class="fas fa-video"></i>
                    <span>Camera</span>
                </button>
                <button type="button" class="call-room__control" data-control="screen" aria-label="Share screen">
                    <i class="fas fa-desktop"></i>
                    <span>Share</span>
                </button>
                <button type="button" class="call-room__control" data-control="switch-camera" aria-label="Switch camera">
                    <i class="fas fa-sync"></i>
                    <span>Switch</span>
                </button>
                <button type="button" class="call-room__control" data-control="reactions" aria-label="Send reaction">
                    <i class="far fa-smile-beam"></i>
                    <span>React</span>
                </button>
                <button type="button" class="call-room__control" data-control="invite" aria-label="Invite more people">
                    <i class="fas fa-user-plus"></i>
                    <span>Invite</span>
                </button>
                <button type="button" class="call-room__control" data-control="upgrade" aria-label="Upgrade to video">
                    <i class="fas fa-arrow-up"></i>
                    <span>Video</span>
                </button>
                <button type="button" class="call-room__control call-room__control--end" data-control="end" aria-label="End call">
                    <i class="fas fa-phone-slash"></i>
                    <span>End</span>
                </button>
            </div>
        </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.js"></script>
    <script>
        window.notyf = window.notyf || new Notyf({
            duration: 4000,
        });
    </script>
</body>
</html>
