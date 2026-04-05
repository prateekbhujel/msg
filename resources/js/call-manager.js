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

function participantName(participant)
{
    if (!participant) {
        return 'Unknown person';
    }

    return participant.name || participant.user_name || 'Unknown person';
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

function callTypeLabel(callType = 'video')
{
    return callType === 'audio' ? 'Audio' : 'Video';
}

function resolveCallBadgeClass(status)
{
    return status === 'active'
        ? 'call_history_card--active'
        : status === 'declined'
            ? 'call_history_card--declined'
            : status === 'ringing'
                ? 'call_history_card--ringing'
                : status === 'missed'
                    ? 'call_history_card--missed'
                    : 'call_history_card--ended';
}

function callShowsDuration(meta = {})
{
    const status = String(meta?.status || 'ended');
    const duration = Number(meta?.duration_seconds || 0);

    return duration > 0 && ['active', 'ended'].includes(status);
}

function formatCallStatusLabel(status, isOutgoing = false)
{
    switch (status) {
    case 'ringing':
        return isOutgoing ? 'Calling' : 'Incoming';
    case 'active':
        return 'Connected';
    case 'declined':
        return 'Declined';
    case 'missed':
        return isOutgoing ? 'Not answered' : 'Missed';
    default:
        return 'Ended';
    }
}

function resolveCallTitle(historyMessage, authId)
{
    const meta = historyMessage?.meta || {};
    const callType = callTypeLabel(meta.call_type || 'video');
    const status = String(meta.status || 'ended');
    const isOutgoing = Number(historyMessage?.from_id || 0) === Number(authId);

    switch (status) {
    case 'ringing':
        return isOutgoing ? `Calling ${callType}...` : `Incoming ${callType} call`;
    case 'active':
        return `${callType} call started`;
    case 'declined':
        return isOutgoing ? `${callType} call declined` : `Declined ${callType} call`;
    case 'missed':
        return isOutgoing ? `${callType} call not answered` : `Missed ${callType} call`;
    default:
        return `${callType} call ended`;
    }
}

function getConversationKey()
{
    return $('meta[name=conversation-key]').attr('content') || '';
}

function getSelectedConversationId()
{
    const conversationKey = getConversationKey();

    if (conversationKey.startsWith('group:')) {
        return 0;
    }

    const metaId = Number($('meta[name=id]').attr('content') || 0);

    if (metaId > 0) {
        return metaId;
    }

    return Number($('.messenger-list-item.active').first().data('userId') || $('.messenger-list-item.active').first().data('id') || 0);
}

function onlineUserIds()
{
    const knownIds = window.messengerPresence?.activeUserIds;

    return Array.isArray(knownIds)
        ? knownIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];
}

class MessengerCallManager
{
    constructor()
    {
        this.authId = Number($('meta[name=auth_id]').attr('content') || 0);
        this.csrfToken = $('meta[name=csrf_token]').attr('content') || '';
        this.assetUrl = $('meta[name=asset-url]').attr('content') || `${window.location.origin}/`;
        this.baseDocumentTitle = document.title;

        this.$modal = $('#incoming-call-modal');
        this.$title = this.$modal.find('.call-title');
        this.$status = this.$modal.find('.call-status');
        this.$participantAvatar = this.$modal.find('.call-participant-avatar');
        this.$participantName = this.$modal.find('.call-participant-name');
        this.$mediaLabel = this.$modal.find('.call-media-label');
        this.$timerLabel = this.$modal.find('.call-screen__timer-label');
        this.$duration = this.$modal.find('.call-duration');
        this.$acceptButton = this.$modal.find('.accept-call');
        this.$declineButton = this.$modal.find('.decline-call');

        this.session = null;
        this.sessionChannelName = null;
        this.role = 'idle';
        this.latestHistoryMessage = null;
        this.ringtoneAudio = null;
        this.ringtoneContext = null;
        this.ringtoneInterval = null;
        this.pendingCallTimer = null;
        this.pendingCallDeadlineAt = null;
        this.pendingCallTimeoutFired = false;
        this.activeIncomingNotification = null;
        this.titlePulseTimer = null;
        this.callSyncChannel = typeof window.BroadcastChannel === 'function'
            ? new window.BroadcastChannel('messenger-call-sync')
            : null;
        this.initialized = false;
    }

    init()
    {
        if (this.initialized || !this.$modal.length || !window.Echo || !this.authId) {
            return;
        }

        this.$modal.appendTo('body');
        this.bindEvents();
        this.armNotificationPermissionRequest();
        this.subscribeToInvitationChannel();
        this.bindCallSyncChannel();
        this.dismissExpiredIncomingNotifications().catch(() => {});
        this.resetModalUI();
        this.initialized = true;
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

        this.$acceptButton.off('click.callManager').on('click.callManager', async (event) => {
            event.preventDefault();
            await this.acceptCurrentCall();
        });

        this.$declineButton.off('click.callManager').on('click.callManager', async (event) => {
            event.preventDefault();
            await this.endCurrentCall('decline');
        });

        this.$modal.find('.incoming-call-modal__backdrop').off('click.callManager').on('click.callManager', (event) => {
            event.preventDefault();
            this.showModal();
        });
    }

    bindCallSyncChannel()
    {
        if (!this.callSyncChannel) {
            return;
        }

        this.callSyncChannel.onmessage = (event) => {
            const payload = event?.data || {};

            if (!payload?.session_uuid || payload.session_uuid !== this.session?.uuid) {
                return;
            }

            if (payload.type === 'call_accepted_in_other_tab') {
                this.stopRingtone();
                this.stopPendingCallTimer(false);
                this.stopAttentionPulse();
                this.closeIncomingCallNotifications(this.session?.uuid).catch(() => {});
                this.role = 'external';
                this.hideModal();
            }

            if (payload.type === 'call_ended_in_room') {
                this.cleanup({ leaveSession: true });
                this.hideModal();
            }
        };
    }

    subscribeToInvitationChannel()
    {
        const channelName = `call.user.${this.authId}`;
        const channel = window.Echo.private(channelName);

        channel.listen('.CallInvitation', (event) => {
            this.handleIncomingInvitation(event).catch(() => {});
        });

        channel.listen('.CallGroupInvite', (event) => {
            this.handleIncomingInvitation(event).catch(() => {});
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
            this.handleSessionSignal(event).catch(() => {});
        });
    }

    resetModalUI()
    {
        this.$title.text('Incoming call');
        this.$participantName.text('Ready to connect');
        this.$status.text('Waiting…').removeClass('text-warning text-danger text-success');
        this.$mediaLabel.text('Incoming call');
        this.$timerLabel.text('Missed in');
        this.$duration.text('00:30');
        this.$participantAvatar.css('background-image', `url("${resolveAssetUrl(this.assetUrl, 'default/avatar.png')}")`);
    }

    showModal()
    {
        this.$modal.appendTo('body').addClass('is-visible').attr('aria-hidden', 'false').css('display', 'flex');
        $('body').addClass('incoming-call-open');
    }

    hideModal()
    {
        this.$modal.removeClass('is-visible').attr('aria-hidden', 'true');
        $('body').removeClass('incoming-call-open');
    }

    formatDuration(seconds)
    {
        const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
        const minutes = Math.floor(safeSeconds / 60);
        const remainder = safeSeconds % 60;

        return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    }

    startPendingCallTimer(startedAt = null, timeoutSeconds = null)
    {
        this.stopPendingCallTimer(false);

        const safeTimeoutSeconds = Math.max(1, Number(timeoutSeconds || this.session?.timeout_seconds || 30));
        const startedAtMs = (() => {
            const parsedDate = startedAt ? new Date(startedAt) : null;

            return parsedDate && !Number.isNaN(parsedDate.getTime())
                ? parsedDate.getTime()
                : Date.now();
        })();

        this.pendingCallDeadlineAt = startedAtMs + (safeTimeoutSeconds * 1000);
        this.pendingCallTimeoutFired = false;
        this.$timerLabel.text('Missed in');

        const tick = () => {
            const remainingSeconds = Math.max(0, Math.ceil((this.pendingCallDeadlineAt - Date.now()) / 1000));
            this.$duration.text(this.formatDuration(remainingSeconds));

            if (remainingSeconds <= 0 && !this.pendingCallTimeoutFired) {
                this.pendingCallTimeoutFired = true;
                this.autoTimeoutCurrentCall().catch(() => {});
            }
        };

        tick();
        this.pendingCallTimer = window.setInterval(tick, 1000);
    }

    stopPendingCallTimer(resetDisplay = true)
    {
        if (this.pendingCallTimer) {
            window.clearInterval(this.pendingCallTimer);
            this.pendingCallTimer = null;
        }

        this.pendingCallDeadlineAt = null;
        this.pendingCallTimeoutFired = false;

        if (resetDisplay) {
            this.$timerLabel.text('Missed in');
            this.$duration.text('00:30');
        }
    }

    async autoTimeoutCurrentCall()
    {
        if (!this.session || this.session.status !== 'ringing') {
            return;
        }

        this.updateStatus('Missed call', 'warning');
        await this.endCurrentCall('timeout', true);
    }

    updateStatus(message, tone = '')
    {
        this.$status.removeClass('text-warning text-danger text-success').text(message);

        if (tone) {
            this.$status.addClass(`text-${tone}`);
        }
    }

    setParticipantCard(participant)
    {
        const image = participant?.avatar || 'default/avatar.png';
        const resolvedImage = resolveAssetUrl(this.assetUrl, image);
        const name = participantName(participant);

        this.$participantName.text(name);
        this.$participantAvatar.css('background-image', `url("${resolvedImage}")`);
    }

    joinedParticipantCount(session = this.session)
    {
        const joinedParticipantIds = Array.isArray(session?.joined_participant_ids)
            ? session.joined_participant_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
            : [];

        if (joinedParticipantIds.length > 0) {
            return joinedParticipantIds.length;
        }

        const participantIds = Array.isArray(session?.participant_ids)
            ? session.participant_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
            : [];

        return participantIds.length;
    }

    isJoinableGroupSession(session = this.session)
    {
        if (!session?.is_group) {
            return false;
        }

        const joinedParticipantIds = Array.isArray(session?.joined_participant_ids)
            ? session.joined_participant_ids.map((id) => Number(id))
            : [];

        return !joinedParticipantIds.includes(this.authId);
    }

    refreshIncomingGroupInvitation(session = this.session)
    {
        if (!this.isJoinableGroupSession(session)) {
            return;
        }

        const groupParticipant = session?.group || session?.caller;
        const joinedCount = Math.max(this.joinedParticipantCount(session), 2);
        const acceptedAt = session?.accepted_at ? new Date(session.accepted_at).getTime() : NaN;
        const liveSeconds = Number.isNaN(acceptedAt)
            ? 0
            : Math.max(0, Math.floor((Date.now() - acceptedAt) / 1000));

        this.setParticipantCard(groupParticipant);
        this.$mediaLabel.text('Group call');
        this.$title.text(`${participantName(groupParticipant)} is live`);
        this.$participantName.text(`${joinedCount} people in call`);
        this.$timerLabel.text('Live now');
        this.$duration.text(this.formatDuration(liveSeconds));
        this.updateStatus('Join the live call', 'success');
        this.showModal();
    }

    isBusy()
    {
        return !['idle', 'external'].includes(this.role);
    }

    isUserReachableForCall(userId)
    {
        const safeUserId = Number(userId || 0);

        if (safeUserId < 1 || safeUserId === this.authId) {
            return false;
        }

        if (!window.messengerPresence || window.messengerPresence.ready !== true) {
            return true;
        }

        return onlineUserIds().includes(safeUserId);
    }

    onlineGroupMemberCount(groupId)
    {
        const safeGroupId = Number(groupId || 0);

        if (safeGroupId < 1 || !window.messengerPresence || window.messengerPresence.ready !== true) {
            return Number.POSITIVE_INFINITY;
        }

        const rawMemberIds = String($(`.group-card[data-group-id="${safeGroupId}"]`).first().data('memberIds') || '');
        const memberIds = rawMemberIds
            .split(',')
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0 && id !== this.authId);

        return memberIds.filter((id) => onlineUserIds().includes(id)).length;
    }

    async startOutgoingCall(callType, options = {})
    {
        const conversationKey = String(options.conversationKey || getConversationKey() || '').trim();
        const groupId = Number(options.groupId || (conversationKey.startsWith('group:') ? conversationKey.split(':')[1] : 0) || 0);
        const calleeId = Number(options.calleeId || getSelectedConversationId() || 0);

        if (!groupId && !calleeId) {
            notify('error', 'Select a conversation before calling.');
            return;
        }

        if (!groupId && calleeId === this.authId) {
            notify('error', 'You cannot call yourself.');
            return;
        }

        if (!groupId && calleeId > 0 && !this.isUserReachableForCall(calleeId)) {
            notify('error', 'That person is offline right now. Wait for them to come online before calling.');
            return;
        }

        if (groupId && this.onlineGroupMemberCount(groupId) < 1) {
            notify('error', 'No one else in this group is online right now.');
            return;
        }

        if (this.isBusy()) {
            notify('error', 'Finish the current call before starting a new one.');
            return;
        }

        const roomWindow = window.open('about:blank', '_blank');

        try {
            const response = await $.ajax({
                method: 'POST',
                url: route('messenger.calls.store'),
                data: {
                    _token: this.csrfToken,
                    callee_id: groupId ? null : calleeId,
                    group_id: groupId || null,
                    call_type: callType,
                    conversation_key: conversationKey,
                },
            });

            this.session = response.session;
            this.role = 'external';
            this.subscribeToSessionChannel(this.session.uuid);
            this.syncHistoryMessage(response.history_message, response.history_message_html, this.session);
            this.openRoomWindow(response.session?.room_url, roomWindow);
            notify('success', `${callTypeLabel(callType)} ${groupId ? 'group ' : ''}call started.`);
        } catch (error) {
            roomWindow?.close?.();
            this.notifyAjaxError(error, 'Unable to start the call.');
            this.cleanup({ leaveSession: true });
        }
    }

    async handleIncomingInvitation(event)
    {
        const session = event?.session;

        if (!session?.uuid || Number(event?.to_id || event?.invitedUserId || 0) !== this.authId) {
            return;
        }

        if (this.isBusy()) {
            await this.autoRejectIncomingInvitation(session.uuid);
            return;
        }

        this.session = session;
        this.role = 'incoming';
        this.subscribeToSessionChannel(session.uuid);
        const modalParticipant = event?.type === 'group' && session?.group ? session.group : session.caller;
        const groupMemberCount = Number(session?.group?.member_count || session?.participant_ids?.length || 0);

        this.setParticipantCard(modalParticipant);
        this.$mediaLabel.text(event?.type === 'group' ? 'Group call' : `${callTypeLabel(session.call_type)} call`);
        this.$title.text(event?.type === 'group'
            ? `${participantName(session.group || session.caller)} is calling`
            : `Incoming ${callTypeLabel(session.call_type)} call`);
        this.$participantName.text(event?.type === 'group'
            ? `${Math.max(groupMemberCount, 2)} people joining`
            : participantName(session.caller));
        this.updateStatus(event?.type === 'group' ? 'Join the live group call' : 'Incoming call', 'warning');
        this.syncHistoryMessage(event.history_message, event.history_message_html, session);
        this.startPendingCallTimer(event.history_message?.created_at, event.history_message?.meta?.timeout_seconds || session.timeout_seconds);
        this.playRingtone();
        this.startAttentionPulse(event?.type === 'group'
            ? `${participantName(session.group || session.caller)} is calling`
            : `${participantName(session.caller)} is calling`);
        this.showModal();
        await this.showIncomingCallNotification(session, event?.type === 'group');
        notify('info', event?.type === 'group'
            ? `${participantName(session.group || session.caller)} invited you into a group call.`
            : `${participantName(session.caller)} is calling you.`);
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
            // Ignore busy auto-decline errors.
        }
    }

    async acceptCurrentCall()
    {
        if (!this.session || this.role !== 'incoming') {
            return;
        }

        const roomWindow = window.open('about:blank', '_blank');
        this.vibrate([200]);
        this.$acceptButton.prop('disabled', true);
        this.$declineButton.prop('disabled', true);
        this.updateStatus('Opening call room…', 'success');

        try {
            const response = await $.ajax({
                method: 'POST',
                url: route('messenger.calls.accept', { session: this.session.uuid }),
                data: {
                    _token: this.csrfToken,
                },
            });

            this.session = response.session || this.session;
            this.role = 'external';
            this.syncHistoryMessage(response.history_message, response.history_message_html, this.session);
            this.stopRingtone();
            this.stopPendingCallTimer(false);
            this.stopAttentionPulse();
            await this.closeIncomingCallNotifications(this.session.uuid);
            this.callSyncChannel?.postMessage({
                type: 'call_accepted_in_other_tab',
                session_uuid: this.session.uuid,
            });
            this.hideModal();
            this.openRoomWindow(this.session?.room_url, roomWindow);
        } catch (error) {
            roomWindow?.close?.();
            this.notifyAjaxError(error, 'Unable to answer the call.');
            await this.endCurrentCall('decline', true);
        } finally {
            this.$acceptButton.prop('disabled', false);
            this.$declineButton.prop('disabled', false);
        }
    }

    async endCurrentCall(action = 'hangup', silent = false)
    {
        if (!this.session) {
            this.cleanup({ leaveSession: true });
            this.hideModal();
            return;
        }

        const isDecline = action === 'decline';
        const method = isDecline ? 'POST' : 'DELETE';
        const url = isDecline
            ? route('messenger.calls.decline', { session: this.session.uuid })
            : route('messenger.calls.hangup', { session: this.session.uuid });

        if (isDecline) {
            this.vibrate([100, 50, 100]);
        }

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
            this.stopPendingCallTimer(false);
            this.stopAttentionPulse();
            await this.closeIncomingCallNotifications(this.session?.uuid);
            this.cleanup({ leaveSession: true });
            this.hideModal();
        }
    }

    async handleSessionSignal(event)
    {
        const session = event?.session;

        if (!session?.uuid || session.uuid !== this.session?.uuid) {
            return;
        }

        this.session = session;
        this.syncHistoryMessage(event.history_message, event.history_message_html, session);

        switch (event.type) {
        case 'accepted':
            this.stopRingtone();
            this.stopPendingCallTimer(false);
            this.stopAttentionPulse();
            await this.closeIncomingCallNotifications(this.session.uuid);
            if (this.isJoinableGroupSession(this.session)) {
                this.role = 'incoming';
                this.refreshIncomingGroupInvitation(this.session);
                break;
            }
            if (this.role !== 'external') {
                this.role = 'external';
            }
            break;
        case 'declined':
            this.stopRingtone();
            this.stopPendingCallTimer(false);
            this.stopAttentionPulse();
            await this.closeIncomingCallNotifications(this.session.uuid);
            notify('info', 'The call was declined.');
            this.cleanup({ leaveSession: true });
            this.hideModal();
            break;
        case 'hangup':
            this.stopRingtone();
            this.stopPendingCallTimer(false);
            this.stopAttentionPulse();
            await this.closeIncomingCallNotifications(this.session.uuid);
            this.cleanup({ leaveSession: true });
            this.hideModal();
            break;
        case 'group_participant_joined':
            if (this.isJoinableGroupSession(this.session)) {
                this.role = 'incoming';
            }
            this.refreshIncomingGroupInvitation(this.session);
            break;
        case 'group_participant_left':
            if (this.isJoinableGroupSession(this.session)) {
                this.role = 'incoming';
            }
            this.refreshIncomingGroupInvitation(this.session);
            break;
        default:
            break;
        }
    }

    syncHistoryMessage(historyMessage, historyMessageHtml, session = this.session)
    {
        if (!historyMessage || !historyMessageHtml) {
            return;
        }

        const conversationTarget = this.getConversationPartnerId(session, historyMessage);
        const activeConversationKey = getConversationKey();

        if (
            !conversationTarget
            || (
                typeof conversationTarget === 'string'
                    ? activeConversationKey !== conversationTarget
                    : Number(getSelectedConversationId()) !== Number(conversationTarget)
            )
        ) {
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

    rehydrateHistoryMessage()
    {
        if (!this.latestHistoryMessage) {
            return;
        }

        const { historyMessage, historyMessageHtml, session } = this.latestHistoryMessage;
        this.syncHistoryMessage(historyMessage, historyMessageHtml, session);
    }

    renderHistoryMessageCard(historyMessage)
    {
        if (!historyMessage || (historyMessage.message_type || 'text') !== 'call') {
            return '';
        }

        const isMine = Number(historyMessage.from_id || 0) === this.authId;
        const meta = historyMessage?.meta || {};
        const callType = meta.call_type || 'video';
        const status = String(meta.status || 'ended');
        const duration = callShowsDuration(meta)
            ? this.formatDuration(meta.duration_seconds || 0)
            : '';
        const callIcon = callType === 'audio' ? 'fas fa-phone' : 'fas fa-video';
        const badgeClass = resolveCallBadgeClass(status);
        const body = escapeHtml(resolveCallTitle(historyMessage, this.authId));
        const messageTime = formatTimestampLabel(historyMessage.created_at);
        const metaMarkup = duration
            ? `<span>${formatCallStatusLabel(status, isMine)}</span><span>•</span><span>${duration}</span>`
            : `<span>${formatCallStatusLabel(status, isMine)}</span>`;
        const timeSuffix = duration ? ` · ${duration}` : '';

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
                                ${metaMarkup}
                            </div>
                        </div>
                    </div>
                    <span class="time">${messageTime}${timeSuffix}</span>
                </div>
            </div>
        `;
    }

    getConversationPartnerId(session = this.session, historyMessage = null)
    {
        const conversationKey = String(session?.conversation_key || historyMessage?.conversation_key || historyMessage?.meta?.conversation_key || '').trim();

        if (conversationKey.startsWith('group:')) {
            return conversationKey;
        }

        const callerId = Number(session?.caller?.id || session?.caller_id || historyMessage?.from_id || 0);
        const calleeId = Number(session?.callee?.id || session?.callee_id || historyMessage?.to_id || 0);

        if (!callerId || !calleeId) {
            return Number(historyMessage?.from_id || 0) === this.authId
                ? Number(historyMessage?.to_id || 0)
                : Number(historyMessage?.from_id || 0);
        }

        return callerId === this.authId ? calleeId : callerId;
    }

    buildNotificationTargetUrl(session)
    {
        const conversationKey = String(session?.conversation_key || '').trim();
        const url = new URL('messenger', this.assetUrl);

        if (conversationKey) {
            url.searchParams.set('conversation', conversationKey);
            return url.toString();
        }

        const callerId = Number(session?.caller?.id || 0);
        const calleeId = Number(session?.callee?.id || 0);
        const conversationId = callerId && callerId !== this.authId ? callerId : calleeId;

        if (conversationId > 0) {
            url.searchParams.set('conversation', `user:${conversationId}`);
        }

        return url.toString();
    }

    async showIncomingCallNotification(session, isGroupInvite = false)
    {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const title = isGroupInvite
            ? `${participantName(session?.caller)} invited you`
            : `${participantName(session?.caller)} is calling`;

        const options = {
            body: isGroupInvite
                ? 'Tap to open the call room'
                : `${callTypeLabel(session?.call_type || 'video')} call incoming`,
            icon: resolveAssetUrl(this.assetUrl, session?.caller?.avatar || 'default/avatar.png'),
            badge: resolveAssetUrl(this.assetUrl, 'assets/images/icon.png'),
            tag: `incoming-call-${session?.uuid || 'call'}`,
            renotify: true,
            requireInteraction: true,
            actions: [
                { action: 'accept', title: 'Answer' },
                { action: 'decline', title: 'Decline' },
            ],
            data: {
                url: this.buildNotificationTargetUrl(session),
                room_url: session?.room_url,
                session_uuid: session?.uuid,
                issued_at: Date.now(),
                timeout_seconds: Number(session?.timeout_seconds || 30),
            },
        };

        try {
            const registration = await (window.__messengerServiceWorkerRegistrationPromise || Promise.resolve(null));

            if (registration?.showNotification) {
                await registration.showNotification(title, options);
                return;
            }
        } catch (error) {
            // Fall back to a window-level notification.
        }

        try {
            this.activeIncomingNotification?.close();
            this.activeIncomingNotification = new Notification(title, options);
            this.activeIncomingNotification.onclick = () => {
                window.focus();
                this.showModal();
                this.activeIncomingNotification?.close();
            };
        } catch (error) {
            // Ignore desktop notification failures.
        }
    }

    async closeIncomingCallNotifications(sessionUuid = this.session?.uuid)
    {
        if (this.activeIncomingNotification) {
            this.activeIncomingNotification.close();
            this.activeIncomingNotification = null;
        }

        if (!sessionUuid) {
            return;
        }

        try {
            const registration = await (window.__messengerServiceWorkerRegistrationPromise || Promise.resolve(null));
            const notifications = await registration?.getNotifications?.({
                tag: `incoming-call-${sessionUuid}`,
            });

            (notifications || []).forEach((notification) => notification.close());
        } catch (error) {
            // Ignore notification cleanup failures.
        }
    }

    async dismissExpiredIncomingNotifications()
    {
        try {
            const registration = await (window.__messengerServiceWorkerRegistrationPromise || Promise.resolve(null));
            const notifications = await registration?.getNotifications?.();

            (notifications || []).forEach((notification) => {
                const tag = String(notification?.tag || '');

                if (!tag.startsWith('incoming-call-')) {
                    return;
                }

                const issuedAt = Number(notification?.data?.issued_at || 0);
                const timeoutSeconds = Math.max(1, Number(notification?.data?.timeout_seconds || 30));
                const notificationExpired = issuedAt > 0
                    ? (Date.now() - issuedAt) >= ((timeoutSeconds + 3) * 1000)
                    : true;

                if (notificationExpired) {
                    notification.close();
                }
            });
        } catch (error) {
            // Ignore stale notification cleanup failures.
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
        this.ringtoneAudio.volume = 0.58;

        return this.ringtoneAudio;
    }

    playSynthRingtoneBurst()
    {
        if (!this.ringtoneContext) {
            return;
        }

        const now = this.ringtoneContext.currentTime;
        const tones = [
            { frequency: 880, offset: 0 },
            { frequency: 660, offset: 0.18 },
            { frequency: 932, offset: 0.38 },
        ];

        tones.forEach(({ frequency, offset }) => {
            const oscillator = this.ringtoneContext.createOscillator();
            const gain = this.ringtoneContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);

            oscillator.connect(gain);
            gain.connect(this.ringtoneContext.destination);
            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.3);
        });
    }

    playRingtone()
    {
        const audio = this.prepareRingtone();

        if (audio) {
            audio.currentTime = 0;

            const playPromise = audio.play();

            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    return true;
                }).catch(() => {
                    this.playRingtoneWithWebAudioFallback();
                });

                return;
            }
        }

        this.playRingtoneWithWebAudioFallback();
    }

    playRingtoneWithWebAudioFallback()
    {
        if (this.ringtoneInterval) {
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        try {
            this.ringtoneContext = this.ringtoneContext || new AudioContextClass();

            if (this.ringtoneContext.state === 'suspended') {
                this.ringtoneContext.resume().catch(() => {});
            }

            this.playSynthRingtoneBurst();
            this.ringtoneInterval = window.setInterval(() => {
                this.playSynthRingtoneBurst();
            }, 1450);
        } catch (error) {
            // Ignore ringtone fallback failures.
        }
    }

    stopRingtone()
    {
        if (this.ringtoneInterval) {
            window.clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }

        if (this.ringtoneAudio) {
            this.ringtoneAudio.pause();
            this.ringtoneAudio.currentTime = 0;
        }
    }

    armNotificationPermissionRequest()
    {
        if (!('Notification' in window) || Notification.permission !== 'default') {
            return;
        }

        const requestPermission = () => {
            Notification.requestPermission().catch(() => {});
        };

        document.addEventListener('pointerdown', requestPermission, { once: true });
    }

    startAttentionPulse(label)
    {
        this.stopAttentionPulse();

        if (!document.hidden) {
            return;
        }

        this.titlePulseTimer = window.setInterval(() => {
            document.title = document.title === this.baseDocumentTitle ? label : this.baseDocumentTitle;
        }, 900);
    }

    stopAttentionPulse()
    {
        if (this.titlePulseTimer) {
            window.clearInterval(this.titlePulseTimer);
            this.titlePulseTimer = null;
        }

        document.title = this.baseDocumentTitle;
    }

    vibrate(pattern)
    {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    openRoomWindow(roomUrl, existingWindow = null)
    {
        if (!roomUrl) {
            return;
        }

        if (existingWindow && !existingWindow.closed) {
            existingWindow.location.href = roomUrl;
            existingWindow.focus();
            return;
        }

        const openedWindow = window.open(roomUrl, '_blank');

        if (!openedWindow) {
            window.location.href = roomUrl;
        }
    }

    cleanup({ leaveSession = true } = {})
    {
        this.stopRingtone();
        this.stopPendingCallTimer(false);
        this.stopAttentionPulse();

        if (leaveSession && this.sessionChannelName) {
            window.Echo.leave(this.sessionChannelName);
            this.sessionChannelName = null;
        }

        this.session = null;
        this.role = 'idle';
        this.resetModalUI();
    }

    notifyAjaxError(error, fallbackMessage)
    {
        let message = error?.responseJSON?.message || '';

        if (!message && typeof error?.responseText === 'string' && error.responseText.trim().startsWith('{')) {
            try {
                message = JSON.parse(error.responseText).message || '';
            } catch (parseError) {
                message = '';
            }
        }

        notify('error', message || fallbackMessage);
    }
}

export function initializeCallManager()
{
    if (!window.__messengerCallManager) {
        window.__messengerCallManager = new MessengerCallManager();
    }

    window.__messengerCallManager.init();
}
