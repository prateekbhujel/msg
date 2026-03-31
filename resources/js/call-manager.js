const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
];

function parseIceServers(rawValue)
{
    if (!rawValue) {
        return DEFAULT_ICE_SERVERS;
    }

    try {
        const parsed = JSON.parse(rawValue);

        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch (error) {
        // Fall back to the public STUN server below.
    }

    return DEFAULT_ICE_SERVERS;
}

function resolveAssetUrl(assetBaseUrl, path)
{
    if (!path) {
        return '';
    }

    if (/^(?:https?:)?\/\//i.test(path)) {
        return path;
    }

    return new URL(path.replace(/^\/+/, ''), assetBaseUrl).toString();
}

function getNotifier()
{
    if (window.notyf) {
        return window.notyf;
    }

    if (typeof notyf !== 'undefined') {
        return notyf;
    }

    return null;
}

function notify(type, message)
{
    const notifier = getNotifier();

    if (notifier && typeof notifier[type] === 'function') {
        notifier[type](message);
    }
}

function toDescriptionInit(description)
{
    if (!description) {
        return null;
    }

    return {
        type: description.type,
        sdp: description.sdp,
    };
}

function toCandidateInit(candidate)
{
    if (!candidate) {
        return null;
    }

    if (typeof candidate.toJSON === 'function') {
        return candidate.toJSON();
    }

    return {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment,
    };
}

function participantName(participant)
{
    if (!participant) {
        return 'Unknown user';
    }

    return participant.name || participant.user_name || 'Unknown user';
}

function escapeHtml(value)
{
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatTimestampLabel(timestamp)
{
    if (!timestamp) {
        return 'Just now';
    }

    const time = new Date(timestamp);

    if (Number.isNaN(time.getTime())) {
        return 'Just now';
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - time.getTime()) / 1000));

    if (diffSeconds <= 60) {
        return diffSeconds <= 1 ? 'Just now' : `${diffSeconds}s ago`;
    }

    const diffMinutes = Math.round(diffSeconds / 60);

    if (diffMinutes <= 60) {
        return `${diffMinutes}m ago`;
    }

    const diffHours = Math.round(diffSeconds / 3600);

    if (diffHours <= 24) {
        return `${diffHours}h ago`;
    }

    return time.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
    });
}

function formatCallStatusLabel(status)
{
    if (!status) {
        return 'Ended';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getSelectedConversationId()
{
    const conversationKey = $('meta[name=conversation-key]').attr('content') || '';

    if (conversationKey.startsWith('group:')) {
        return 0;
    }

    const metaId = Number($('meta[name=id]').attr('content') || 0);

    if (metaId > 0) {
        return metaId;
    }

    return Number($('.messenger-list-item.active').first().data('userId') || $('.messenger-list-item.active').first().data('id') || 0);
}

class MessengerCallManager
{
    constructor()
    {
        this.authId = Number($('meta[name=auth_id]').attr('content') || 0);
        this.csrfToken = $('meta[name=csrf_token]').attr('content') || '';
        this.assetUrl = $('meta[name=asset-url]').attr('content') || `${window.location.origin}/`;
        this.iceServers = parseIceServers($('meta[name=webrtc-ice-servers]').attr('content'));

        this.$modal = $('#callModal');
        this.$title = this.$modal.find('.call-title');
        this.$status = this.$modal.find('.call-status');
        this.$placeholder = this.$modal.find('.call-placeholder');
        this.$participantAvatar = this.$modal.find('.call-participant-avatar');
        this.$participantName = this.$modal.find('.call-participant-name');
        this.$mediaLabel = this.$modal.find('.call-media-label');
        this.$duration = this.$modal.find('.call-duration');
        this.$remoteVideo = this.$modal.find('.call-remote-video');
        this.$localVideo = this.$modal.find('.call-local-video');
        this.$incomingActions = this.$modal.find('.incoming-call-actions');
        this.$acceptButton = this.$modal.find('.accept-call');
        this.$declineButton = this.$modal.find('.decline-call');
        this.$hangupButton = this.$modal.find('.hangup-call');
        this.$closeButton = this.$modal.find('.call-close');

        this.modalInstance = null;
        this.session = null;
        this.role = 'idle';
        this.callType = 'video';
        this.localStream = null;
        this.peerConnection = null;
        this.remoteStream = null;
        this.sessionChannelName = null;
        this.pendingCandidates = [];
        this.negotiationStarted = false;
        this.ringtoneAudio = null;
        this.callTimer = null;
        this.callStartedAt = null;
        this.latestHistoryMessage = null;
        this.initialized = false;
    }

    init()
    {
        if (this.initialized || !this.$modal.length || !window.Echo || !this.authId) {
            return;
        }

        this.modalInstance = this.getModalInstance();
        this.bindEvents();
        this.subscribeToInvitationChannel();
        this.resetModalUI();
        this.initialized = true;
    }

    getModalInstance()
    {
        if (window.bootstrap && window.bootstrap.Modal) {
            return window.bootstrap.Modal.getOrCreateInstance(this.$modal[0]);
        }

        return {
            show: () => this.$modal.addClass('show').css('display', 'block'),
            hide: () => this.$modal.removeClass('show').css('display', 'none'),
        };
    }

    bindEvents()
    {
        $('body')
            .off('click.callManager', '.start-call')
            .on('click.callManager', '.start-call', async (event) => {
                event.preventDefault();

                const callType = $(event.currentTarget).data('call-type') || 'video';
                await this.startOutgoingCall(callType);
            });

        this.$acceptButton
            .off('click.callManager')
            .on('click.callManager', async (event) => {
                event.preventDefault();
                await this.acceptCurrentCall();
            });

        this.$declineButton
            .off('click.callManager')
            .on('click.callManager', async (event) => {
                event.preventDefault();
                await this.endCurrentCall('decline');
            });

        this.$hangupButton
            .off('click.callManager')
            .on('click.callManager', async (event) => {
                event.preventDefault();
                await this.endCurrentCall('hangup');
            });

        this.$closeButton
            .off('click.callManager')
            .on('click.callManager', async (event) => {
                event.preventDefault();
                await this.endCurrentCall(this.role === 'incoming' ? 'decline' : 'hangup');
            });

        this.$modal.off('hidden.bs.modal.callManager').on('hidden.bs.modal.callManager', () => {
            this.cleanup({ leaveSession: true });
        });

        $(window).off('beforeunload.callManager').on('beforeunload.callManager', () => {
            this.stopMediaStream();
            this.closePeerConnection();
        });
    }

    subscribeToInvitationChannel()
    {
        const channelName = `call.user.${this.authId}`;

        window.Echo.private(channelName).listen('.CallInvitation', (event) => {
            this.handleIncomingInvitation(event);
        });
    }

    subscribeToSessionChannel(uuid)
    {
        if (!uuid) {
            return;
        }

        if (this.sessionChannelName && this.sessionChannelName !== `call.session.${uuid}`) {
            window.Echo.leave(this.sessionChannelName);
        }

        this.sessionChannelName = `call.session.${uuid}`;

        window.Echo.private(this.sessionChannelName).listen('.CallSignal', (event) => {
            this.handleSessionSignal(event);
        });
    }

    isBusy()
    {
        return this.role !== 'idle';
    }

    resetModalUI()
    {
        this.$title.text('Call');
        this.updateStatus('Waiting...', 'muted');
        this.$incomingActions.addClass('d-none');
        this.$hangupButton.text('Hang up');
        this.$participantName.text('Ready to connect');
        this.$mediaLabel.text('Video call');
        this.$duration.text('00:00');
        this.$placeholder.removeClass('d-none');
        this.$participantAvatar.css('background-image', `url("${resolveAssetUrl(this.assetUrl, 'default/avatar.png')}")`);
        this.$remoteVideo[0].srcObject = null;
        this.$localVideo[0].srcObject = null;
        this.$localVideo.addClass('d-none');
        this.$remoteVideo.css({ opacity: 1, pointerEvents: 'auto' });
    }

    formatDuration(seconds)
    {
        const totalSeconds = Math.max(0, Number(seconds || 0));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;

        if (hours > 0) {
            return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
        }

        return [minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
    }

    startCallDurationTimer(startedAt = null)
    {
        this.stopCallDurationTimer();

        const parsedStart = startedAt ? new Date(startedAt) : new Date();
        this.callStartedAt = Number.isNaN(parsedStart.getTime()) ? Date.now() : parsedStart.getTime();

        const tick = () => {
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.callStartedAt) / 1000));
            this.$duration.text(this.formatDuration(elapsedSeconds));
        };

        tick();
        this.callTimer = window.setInterval(tick, 1000);
    }

    stopCallDurationTimer()
    {
        if (this.callTimer) {
            window.clearInterval(this.callTimer);
            this.callTimer = null;
        }

        this.callStartedAt = null;
        this.$duration.text('00:00');
    }

    getConversationPartnerId(session = this.session, historyMessage = null)
    {
        const callerId = Number(session?.caller?.id || session?.caller_id || historyMessage?.from_id || 0);
        const calleeId = Number(session?.callee?.id || session?.callee_id || historyMessage?.to_id || 0);

        if (!callerId || !calleeId) {
            return Number(historyMessage?.from_id || 0) === this.authId
                ? Number(historyMessage?.to_id || 0)
                : Number(historyMessage?.from_id || 0);
        }

        return callerId === this.authId ? calleeId : callerId;
    }

    syncHistoryMessage(historyMessage, historyMessageHtml, session = this.session)
    {
        if (!historyMessage || !historyMessageHtml) {
            return;
        }

        const partnerId = this.getConversationPartnerId(session, historyMessage);

        if (!partnerId || Number(getSelectedConversationId()) !== Number(partnerId)) {
            return;
        }

        const $chatBody = $('.wsus__chat_area_body');

        if (!$chatBody.length) {
            return;
        }

        const messageSelector = `.message-card[data-id="${historyMessage.id}"]`;
        const renderedHistoryMessage = this.renderHistoryMessageCard(historyMessage) || historyMessageHtml;
        const $replacement = $(renderedHistoryMessage);

        this.latestHistoryMessage = {
            historyMessage: { ...historyMessage },
            historyMessageHtml: renderedHistoryMessage,
            session,
        };

        $chatBody.find('.no_messages').addClass('d-none');

        if ($chatBody.find(messageSelector).length) {
            $chatBody.find(messageSelector).replaceWith($replacement);
        } else {
            $chatBody.append($replacement);
            $chatBody.stop().animate({ scrollTop: $chatBody[0].scrollHeight });
        }
    }

    renderHistoryMessageCard(historyMessage)
    {
        if (!historyMessage || (historyMessage.message_type || 'text') !== 'call') {
            return '';
        }

        const isMine = Number(historyMessage.from_id || 0) === this.authId;
        const callType = historyMessage?.meta?.call_type || 'video';
        const status = historyMessage?.meta?.status || 'ended';
        const duration = this.formatDuration(historyMessage?.meta?.duration_seconds || 0);
        const callIcon = callType === 'audio' ? 'fas fa-phone' : 'fas fa-video';
        const badgeClass = status === 'active'
            ? 'call_history_card--active'
            : status === 'declined'
                ? 'call_history_card--declined'
                : status === 'ringing'
                    ? 'call_history_card--ringing'
                    : 'call_history_card--ended';
        const body = escapeHtml(historyMessage.body || `${callType.charAt(0).toUpperCase()}${callType.slice(1)} call`);
        const messageTime = formatTimestampLabel(historyMessage.created_at);

        return `
            <div class="wsus__single_chat_area message-card" data-id="${historyMessage.id}" data-message-type="call">
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    <div class="call_history_card ${badgeClass}">
                        <div class="call_history_card__icon">
                            <i class="${callIcon}"></i>
                        </div>
                        <div class="call_history_card__content">
                            <div class="call_history_card__title">${body}</div>
                            <div class="call_history_card__meta">
                                <span>${formatCallStatusLabel(status)}</span>
                                <span>•</span>
                                <span>${duration}</span>
                            </div>
                        </div>
                    </div>
                    <span class="time">${messageTime} · ${duration}</span>
                </div>
            </div>
        `;
    }

    rehydrateHistoryMessage()
    {
        if (!this.latestHistoryMessage) {
            return;
        }

        const { historyMessage, historyMessageHtml, session } = this.latestHistoryMessage;
        this.syncHistoryMessage(historyMessage, historyMessageHtml, session);
    }

    updateStatus(message, tone = 'muted')
    {
        const tones = 'text-white-50 text-warning text-success text-danger text-info text-muted';

        this.$status.removeClass(tones).text(message);

        if (tone === 'muted') {
            this.$status.addClass('text-white-50');
            return;
        }

        this.$status.addClass(`text-${tone}`);
    }

    updateHangupLabel(label)
    {
        this.$hangupButton.text(label);
    }

    toggleIncomingActions(show)
    {
        this.$incomingActions.toggleClass('d-none', !show);
    }

    setParticipantCard(participant)
    {
        const image = participant?.avatar || 'default/avatar.png';

        this.$participantName.text(participantName(participant));
        this.$participantAvatar.css('background-image', `url("${resolveAssetUrl(this.assetUrl, image)}")`);
    }

    setCallMode(callType)
    {
        const isVideo = callType === 'video';

        this.callType = isVideo ? 'video' : 'audio';
        this.$mediaLabel.text(isVideo ? 'Video call' : 'Audio call');
        this.$localVideo.toggleClass('d-none', !isVideo);
        this.$remoteVideo.css({
            opacity: isVideo ? 1 : 0,
            pointerEvents: isVideo ? 'auto' : 'none',
        });

        if (!isVideo) {
            this.$placeholder.removeClass('d-none');
        }
    }

    prepareRingtone()
    {
        if (this.ringtoneAudio) {
            return this.ringtoneAudio;
        }

        this.ringtoneAudio = new Audio(resolveAssetUrl(this.assetUrl, 'default/message-sound.mp3'));
        this.ringtoneAudio.preload = 'auto';
        this.ringtoneAudio.loop = true;
        this.ringtoneAudio.volume = 0.45;

        return this.ringtoneAudio;
    }

    playRingtone()
    {
        const audio = this.prepareRingtone();

        if (!audio) {
            return;
        }

        audio.currentTime = 0;

        const playPromise = audio.play();

        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    }

    stopRingtone()
    {
        if (!this.ringtoneAudio) {
            return;
        }

        this.ringtoneAudio.pause();
        this.ringtoneAudio.currentTime = 0;
    }

    blurFocusedElement()
    {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
    }

    showModal()
    {
        this.modalInstance.show();
    }

    hideModal()
    {
        this.blurFocusedElement();
        this.modalInstance.hide();
    }

    async startOutgoingCall(callType)
    {
        const calleeId = getSelectedConversationId();

        if (!calleeId) {
            notify('error', 'Select a conversation before calling.');
            return;
        }

        if (calleeId === this.authId) {
            notify('error', 'You cannot call yourself.');
            return;
        }

        if (this.isBusy()) {
            notify('error', 'Finish the current call before starting a new one.');
            return;
        }

        this.cleanup({ leaveSession: true });
        this.role = 'dialing';
        this.callType = callType;
        this.updateStatus(
            callType === 'video' ? 'Requesting camera and microphone...' : 'Requesting microphone...',
            'warning'
        );

        try {
            await this.ensureLocalStream(callType);

            const response = await $.ajax({
                method: 'POST',
                url: route('messenger.calls.store'),
                data: {
                    _token: this.csrfToken,
                    callee_id: calleeId,
                    call_type: callType,
                },
            });

            this.session = response.session;
            this.role = 'caller';
            this.callType = this.session.call_type || callType;
            this.negotiationStarted = false;
            this.pendingCandidates = [];

            this.setParticipantCard(this.session.callee);
            this.setCallMode(this.callType);
            this.$title.text(
                this.session.status === 'active'
                    ? `In call with ${participantName(this.session.callee)}`
                    : `Calling ${participantName(this.session.callee)}`
            );
            this.updateStatus(
                this.session.status === 'active' ? 'Connected' : 'Ringing...',
                this.session.status === 'active' ? 'success' : 'warning'
            );
            this.updateHangupLabel(this.session.status === 'active' ? 'Hang up' : 'Cancel call');
            this.toggleIncomingActions(false);
            this.syncHistoryMessage(response.history_message, response.history_message_html, this.session);
            if (this.session.status === 'active') {
                this.stopRingtone();
                this.startCallDurationTimer(response.history_message?.meta?.started_at || this.session.accepted_at);
            }
            this.showModal();
            this.subscribeToSessionChannel(this.session.uuid);
        } catch (error) {
            this.notifyAjaxError(error, 'Unable to start the call.');
            this.cleanup({ leaveSession: true });
            this.hideModal();
        }
    }

    async handleIncomingInvitation(event)
    {
        const session = event?.session;

        if (!session?.uuid || Number(event?.to_id) !== this.authId) {
            return;
        }

        if (this.session?.uuid === session.uuid) {
            return;
        }

        if (this.isBusy()) {
            await this.autoRejectIncomingInvitation(session.uuid);
            return;
        }

        this.cleanup({ leaveSession: true });
        this.session = session;
        this.role = 'incoming';
        this.callType = session.call_type || 'video';
        this.negotiationStarted = false;
        this.pendingCandidates = [];

        this.setParticipantCard(session.caller);
        this.$title.text(`Incoming ${this.callType} call`);
        this.setCallMode(this.callType);
        this.updateStatus('Incoming call', 'warning');
        this.updateHangupLabel('Decline');
        this.toggleIncomingActions(true);
        this.syncHistoryMessage(event.history_message, event.history_message_html, session);
        this.playRingtone();
        this.subscribeToSessionChannel(session.uuid);
        this.showModal();

        notify('info', `${participantName(session.caller)} is calling you.`);
    }

    async autoRejectIncomingInvitation(uuid)
    {
        try {
            await $.ajax({
                method: 'POST',
                url: route('messenger.calls.decline', { session: uuid }),
                data: {
                    _token: this.csrfToken,
                },
            });
        } catch (error) {
            // Ignore auto-decline errors. The caller will time out or hang up on their side.
        }
    }

    async acceptCurrentCall()
    {
        if (!this.session || this.role !== 'incoming') {
            return;
        }

        this.setActionButtonsDisabled(true);
        this.updateStatus('Connecting...', 'warning');

        try {
            await this.ensureLocalStream(this.callType);
            await this.ensurePeerConnection();

            const response = await $.ajax({
                method: 'POST',
                url: route('messenger.calls.accept', { session: this.session.uuid }),
                data: {
                    _token: this.csrfToken,
                },
            });

            this.session = response.session;
            this.role = 'callee';
            this.callType = this.session.call_type || this.callType;
            this.stopRingtone();
            this.setParticipantCard(this.session.caller);
            this.setCallMode(this.callType);
            this.toggleIncomingActions(false);
            this.updateHangupLabel('Hang up');
            this.updateStatus('Connected', 'success');
            this.syncHistoryMessage(response.history_message, response.history_message_html, this.session);
            this.startCallDurationTimer(response.history_message?.meta?.started_at || this.session.accepted_at);
        } catch (error) {
            this.notifyAjaxError(error, 'Unable to accept the call.');
            await this.endCurrentCall('decline', true);
        } finally {
            this.setActionButtonsDisabled(false);
        }
    }

    async endCurrentCall(action = 'hangup', silent = false)
    {
        if (!this.session) {
            this.cleanup({ leaveSession: true });
            this.hideModal();
            return;
        }

        const isDecline = action === 'decline' || this.role === 'incoming';
        const method = isDecline ? 'POST' : 'DELETE';
        const url = isDecline
            ? route('messenger.calls.decline', { session: this.session.uuid })
            : route('messenger.calls.hangup', { session: this.session.uuid });

        try {
            const response = await $.ajax({
                method,
                url,
                data: {
                    _token: this.csrfToken,
                },
            });

            this.syncHistoryMessage(response?.history_message, response?.history_message_html, this.session);
        } catch (error) {
            if (!silent) {
                this.notifyAjaxError(error, 'Unable to finish the call.');
            }
        } finally {
            this.stopRingtone();
            this.cleanup({ leaveSession: true });
            this.hideModal();
        }
    }

    async handleSessionSignal(event)
    {
        const session = event?.session;

        if (!session?.uuid || Number(event?.to_id) !== this.authId) {
            return;
        }

        if (this.session?.uuid && this.session.uuid !== session.uuid) {
            return;
        }

        this.session = session;
        this.syncHistoryMessage(event.history_message, event.history_message_html, session);

        switch (event.type) {
        case 'accepted':
            this.stopRingtone();
            if (this.role === 'caller' && !this.negotiationStarted) {
                this.$title.text(`Calling ${participantName(this.session.callee)}`);
                this.updateStatus('Connecting...', 'warning');
                this.startCallDurationTimer(event.history_message?.meta?.started_at || this.session.accepted_at);
                await this.startCallerNegotiation();
            }
            break;
        case 'declined':
            this.stopRingtone();
            notify('info', 'The call was declined.');
            this.updateStatus('Call declined', 'danger');
            this.stopCallDurationTimer();
            this.cleanup({ leaveSession: true });
            this.hideModal();
            break;
        case 'hangup':
            this.stopRingtone();
            this.updateStatus('Call ended', 'muted');
            this.stopCallDurationTimer();
            this.cleanup({ leaveSession: true });
            this.hideModal();
            break;
        case 'signal':
            await this.handleSignalPayload(event.payload || {});
            break;
        default:
            break;
        }
    }

    async handleSignalPayload(payload)
    {
        if (!payload.signal_type || !payload.signal_data) {
            return;
        }

        if (payload.signal_type === 'offer') {
            await this.receiveOffer(payload.signal_data);
        } else if (payload.signal_type === 'answer') {
            await this.receiveAnswer(payload.signal_data);
        } else if (payload.signal_type === 'candidate') {
            await this.receiveCandidate(payload.signal_data);
        }
    }

    async startCallerNegotiation()
    {
        await this.ensurePeerConnection();

        if (!this.peerConnection || !this.session) {
            return;
        }

        this.negotiationStarted = true;

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            await this.sendSignal('offer', toDescriptionInit(offer));
            this.updateStatus('Waiting for answer...', 'info');
        } catch (error) {
            this.negotiationStarted = false;
            this.notifyAjaxError(error, 'Unable to create the call offer.');
            await this.endCurrentCall('hangup', true);
        }
    }

    async receiveOffer(signalData)
    {
        try {
            await this.ensurePeerConnection();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData));
            await this.flushPendingCandidates();

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.sendSignal('answer', toDescriptionInit(answer));
            this.updateStatus('Connected', 'success');
        } catch (error) {
            this.notifyAjaxError(error, 'Unable to answer the call.');
            await this.endCurrentCall('hangup', true);
        }
    }

    async receiveAnswer(signalData)
    {
        try {
            await this.ensurePeerConnection();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signalData));
            await this.flushPendingCandidates();
            this.stopRingtone();
            this.updateStatus('Connected', 'success');
            if (!this.callTimer) {
                this.startCallDurationTimer(this.callStartedAt || this.session?.accepted_at || this.session?.history_message?.meta?.started_at);
            }

            if (this.callType === 'video') {
                this.$placeholder.addClass('d-none');
            }
        } catch (error) {
            this.notifyAjaxError(error, 'Unable to connect the call.');
            await this.endCurrentCall('hangup', true);
        }
    }

    async receiveCandidate(candidateData)
    {
        if (!candidateData) {
            return;
        }

        if (!this.peerConnection || !this.peerConnection.remoteDescription) {
            this.pendingCandidates.push(candidateData);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
        } catch (error) {
            // Ignore individual ICE candidate failures to keep the call flowing.
        }
    }

    async flushPendingCandidates()
    {
        if (!this.peerConnection || !this.peerConnection.remoteDescription) {
            return;
        }

        while (this.pendingCandidates.length > 0) {
            const candidate = this.pendingCandidates.shift();

            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                // Keep flushing even if one candidate is invalid.
            }
        }
    }

    async ensureLocalStream(callType)
    {
        if (this.localStream) {
            this.attachLocalStream(this.localStream);
            return this.localStream;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video' ? { facingMode: 'user' } : false,
        });

        this.localStream = stream;
        this.attachLocalStream(stream);

        return stream;
    }

    attachLocalStream(stream)
    {
        if (!stream) {
            return;
        }

        this.$localVideo[0].srcObject = stream;
        this.$localVideo[0].muted = true;
        this.$localVideo[0].play().catch(() => {});
    }

    async ensurePeerConnection()
    {
        if (this.peerConnection) {
            return this.peerConnection;
        }

        const peerConnection = new RTCPeerConnection({
            iceServers: this.iceServers,
        });

        this.remoteStream = new MediaStream();
        this.$remoteVideo[0].srcObject = this.remoteStream;

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;

            if (remoteStream) {
                this.$remoteVideo[0].srcObject = remoteStream;
                this.$remoteVideo[0].play().catch(() => {});
            } else if (event.track) {
                this.remoteStream.addTrack(event.track);
                this.$remoteVideo[0].srcObject = this.remoteStream;
                this.$remoteVideo[0].play().catch(() => {});
            }

            if (this.callType === 'video') {
                this.$placeholder.addClass('d-none');
            }

            this.updateStatus('Connected', 'success');
        };

        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await this.sendSignal('candidate', toCandidateInit(event.candidate));
                } catch (error) {
                    // Ignore signalling hiccups; the browser will continue to try alternative candidates.
                }
            }
        };

        peerConnection.onconnectionstatechange = () => {
            if (['failed', 'closed', 'disconnected'].includes(peerConnection.connectionState) && this.session) {
                this.updateStatus('Connection lost', 'danger');
            }
        };

        this.peerConnection = peerConnection;

        return peerConnection;
    }

    async sendSignal(signalType, signalData)
    {
        if (!this.session?.uuid) {
            return;
        }

        return $.ajax({
            method: 'POST',
            url: route('messenger.calls.signal', { session: this.session.uuid }),
            data: {
                _token: this.csrfToken,
                signal_type: signalType,
                signal_data: JSON.stringify(signalData),
            },
        });
    }

    setActionButtonsDisabled(disabled)
    {
        this.$acceptButton.prop('disabled', disabled);
        this.$declineButton.prop('disabled', disabled);
        this.$hangupButton.prop('disabled', disabled);
        this.$closeButton.prop('disabled', disabled);
    }

    stopMediaStream()
    {
        if (!this.localStream) {
            return;
        }

        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
    }

    closePeerConnection()
    {
        if (this.peerConnection) {
            this.peerConnection.ontrack = null;
            this.peerConnection.onicecandidate = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.remoteStream = null;
        this.negotiationStarted = false;
    }

    leaveSessionChannel()
    {
        if (this.sessionChannelName) {
            window.Echo.leave(this.sessionChannelName);
            this.sessionChannelName = null;
        }
    }

    clearVideoElements()
    {
        this.$remoteVideo[0].srcObject = null;
        this.$localVideo[0].srcObject = null;
    }

    cleanup({ leaveSession = true } = {})
    {
        this.stopMediaStream();
        this.closePeerConnection();
        this.stopRingtone();
        this.stopCallDurationTimer();

        if (leaveSession) {
            this.leaveSessionChannel();
        }

        this.session = null;
        this.role = 'idle';
        this.callType = 'video';
        this.pendingCandidates = [];

        this.clearVideoElements();
        this.resetModalUI();
    }

    notifyAjaxError(error, fallbackMessage)
    {
        const message = error?.responseJSON?.message || fallbackMessage;
        notify('error', message);
    }
}

export function initializeCallManager()
{
    if (!window.__messengerCallManager) {
        window.__messengerCallManager = new MessengerCallManager();
    }

    window.__messengerCallManager.init();
}
