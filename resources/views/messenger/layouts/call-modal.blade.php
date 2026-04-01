<div id="incoming-call-modal" class="incoming-call-modal" aria-hidden="true">
    <div class="incoming-call-modal__backdrop"></div>
    <section class="incoming-call-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="incoming-call-title">
        <div class="incoming-call-modal__handle" aria-hidden="true"></div>

        <div class="incoming-call-modal__avatar-wrap">
            <div class="incoming-call-modal__avatar call-participant-avatar" style="background-image: url('{{ asset('default/avatar.png') }}');"></div>
            <div class="incoming-call-modal__pulse" aria-hidden="true"></div>
        </div>

        <div class="incoming-call-modal__copy">
            <p class="incoming-call-modal__eyebrow call-media-label">Incoming call</p>
            <h2 id="incoming-call-title" class="incoming-call-modal__title call-title">Call</h2>
            <p class="incoming-call-modal__name call-participant-name">Ready to connect</p>
            <p class="incoming-call-modal__status call-status">Waiting…</p>
        </div>

        <div class="incoming-call-modal__timer">
            <span class="call-screen__timer-label">Missed in</span>
            <strong class="call-duration">00:30</strong>
        </div>

        <div class="incoming-call-modal__actions incoming-call-actions">
            <button type="button" class="incoming-call-modal__button incoming-call-modal__button--decline decline-call">
                <i class="fas fa-phone-slash"></i>
                <span>Decline</span>
            </button>
            <button type="button" class="incoming-call-modal__button incoming-call-modal__button--accept accept-call">
                <i class="fas fa-phone"></i>
                <span>Answer</span>
            </button>
        </div>
    </section>
</div>
