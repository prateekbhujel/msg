<div id="callModal" class="call-screen" aria-hidden="true">
    <div class="call-screen__backdrop"></div>
    <div class="call-screen__shell">
        <div class="call-screen__header">
            <div class="call-screen__identity">
                <div class="call-participant-avatar" style="background-image: url('{{ asset('default/avatar.png') }}');"></div>
                <div class="call-screen__copy">
                    <h5 class="call-title">Call</h5>
                    <div class="call-participant-name">Ready to connect</div>
                    <p class="call-status">Waiting...</p>
                </div>
            </div>
            <div class="call-screen__timer">
                <span class="call-screen__timer-label">Live</span>
                <span class="call-duration">00:00</span>
            </div>
            <button type="button" class="call-close" aria-label="Close call view">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div class="call-stage">
            <div class="call-stage__ambient"></div>
            <video class="call-remote-video" autoplay playsinline></video>
            <div class="call-placeholder">
                <div class="call-hero-avatar" style="background-image: url('{{ asset('default/avatar.png') }}');"></div>
                <div class="call-hero-copy">
                    <div class="call-hero-name">Ready to connect</div>
                    <div class="call-media-label">Video call</div>
                </div>
            </div>
            <div class="call-local-video-shell">
                <video class="call-local-video" autoplay playsinline muted></video>
            </div>
        </div>

        <div class="incoming-call-actions d-none">
            <button type="button" class="accept-call">
                <i class="fas fa-phone"></i>
                <span>Answer</span>
            </button>
            <button type="button" class="decline-call">
                <i class="fas fa-phone-slash"></i>
                <span>Decline</span>
            </button>
        </div>

        <div class="call-screen__controls">
            <button type="button" class="toggle-screen-share d-none">
                <i class="fas fa-desktop"></i>
                <span>Share screen</span>
            </button>
            <button type="button" class="hangup-call">
                <i class="fas fa-phone-slash"></i>
                <span>End call</span>
            </button>
        </div>
    </div>
</div>
