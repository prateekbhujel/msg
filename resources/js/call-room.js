import axios from 'axios';

const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
];

const REACTION_CHANNEL_LABEL = 'reactions';
const MOBILE_CONTROL_IDLE_MS = 3000;
const CALL_SYNC_CHANNEL = 'messenger-call-sync';
const CALL_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥'];
const PIP_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const CALL_ROOM_NAVIGATION_DELAY_MS = 220;

function parseJsonScript(id, fallback = null)
{
    const element = document.getElementById(id);

    if (!element) {
        return fallback;
    }

    try {
        return JSON.parse(element.textContent || '');
    } catch (error) {
        return fallback;
    }
}

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
        // Fall back to the public STUN server.
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

function participantName(participant)
{
    if (!participant) {
        return 'Call participant';
    }

    return participant.name || participant.user_name || 'Call participant';
}

function formatDuration(seconds)
{
    const totalSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainder = totalSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
    }

    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getNotifier()
{
    if (window.notyf) {
        return window.notyf;
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

function sanitizeId(value)
{
    const numeric = Number(value || 0);

    return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

class CallRoomApp
{
    constructor()
    {
        this.root = document.querySelector('[data-call-room]');

        this.session = parseJsonScript('call-room-session', {}) || {};
        this.inviteCandidates = parseJsonScript('call-room-invite-candidates', []) || [];
        this.authId = sanitizeId(document.querySelector('meta[name="auth_id"]')?.getAttribute('content'));
        this.csrfToken = document.querySelector('meta[name="csrf_token"]')?.getAttribute('content') || '';
        this.assetUrl = document.querySelector('meta[name="asset-url"]')?.getAttribute('content') || `${window.location.origin}/`;
        this.roomToken = document.querySelector('meta[name="call-room-token"]')?.getAttribute('content') || '';
        this.iceServers = parseIceServers(document.querySelector('meta[name="webrtc-ice-servers"]')?.getAttribute('content'));

        this.stage = this.root?.querySelector('[data-call-stage]') || null;
        this.grid = this.root?.querySelector('[data-call-grid]') || null;
        this.emptyState = this.root?.querySelector('[data-call-empty-state]') || null;
        this.emptyName = this.root?.querySelector('[data-call-empty-name]') || null;
        this.emptyLabel = this.root?.querySelector('[data-call-empty-label]') || null;
        this.identityAvatar = this.root?.querySelector('[data-call-identity-avatar]') || null;
        this.titleLabel = this.root?.querySelector('[data-call-title]') || null;
        this.statusLabel = this.root?.querySelector('[data-call-status]') || null;
        this.eyebrowLabel = this.root?.querySelector('[data-call-eyebrow]') || null;
        this.overlay = this.root?.querySelector('[data-call-overlay]') || null;
        this.overlayAvatar = this.root?.querySelector('[data-call-overlay-avatar]') || null;
        this.overlayTitle = this.root?.querySelector('[data-call-overlay-title]') || null;
        this.overlayCopy = this.root?.querySelector('[data-call-overlay-copy]') || null;
        this.controlBar = this.root?.querySelector('[data-call-controls]') || null;
        this.localPip = this.root?.querySelector('[data-local-pip]') || null;
        this.localVideo = this.root?.querySelector('[data-local-video]') || null;
        this.reactionBurstLayer = this.root?.querySelector('[data-reaction-bursts]') || null;
        this.reactionTray = this.root?.querySelector('[data-reaction-tray]') || null;
        this.inviteSheet = this.root?.querySelector('[data-invite-sheet]') || null;
        this.moreTray = this.root?.querySelector('[data-more-tray]') || null;
        this.inviteList = this.root?.querySelector('[data-invite-list]') || null;

        this.peers = new Map();
        this.pendingCandidates = new Map();
        this.audioContext = null;
        this.localAudioStream = null;
        this.localCameraStream = null;
        this.localPreviewStream = null;
        this.screenShareStream = null;
        this.currentFacingMode = 'user';
        this.ringCountdownTimer = null;
        this.callTimer = null;
        this.callStartedAt = null;
        this.joiningRequest = null;
        this.activeSpeakerMonitors = new Map();
        this.qualityMonitorTimer = null;
        this.broadcastChannel = typeof window.BroadcastChannel === 'function'
            ? new window.BroadcastChannel(CALL_SYNC_CHANNEL)
            : null;
        this.wakeLock = null;
        this.controlsHideTimer = null;
        this.mobileControlsVisible = true;
        this.pipPositionIndex = 0;
        this.dragState = null;
        this.callEnding = false;
        this.roomFinished = false;
        this.leaveSignalSent = false;
        this.connectionBootstrapPromise = null;
        this.sessionRefreshTimer = null;
        this.sessionRefreshRequest = null;
        this.initialized = false;
    }

    init()
    {
        if (this.initialized || !this.root || !this.session?.uuid || !window.Echo || !this.authId) {
            return;
        }

        this.initialized = true;
        this.decorateSessionPayload(this.session);
        this.renderInviteCandidates();
        this.bindControls();
        this.bindBroadcastChannel();
        this.subscribeToSession();
        this.renderSessionSummary();
        this.updateControlStates();
        this.setOverlayVisible(true);
        this.startSessionRefreshLoop();

        if (this.session.status === 'ringing') {
            this.enterRingingState();
        } else {
            this.enterConnectedState().catch(() => {});
        }
    }

    decorateSessionPayload(sessionPayload)
    {
        const participantIds = Array.from(new Set(
            (Array.isArray(sessionPayload?.participant_ids) ? sessionPayload.participant_ids : [])
                .map((id) => sanitizeId(id))
                .filter(Boolean)
        ));
        const joinedIds = Array.from(new Set(
            (Array.isArray(sessionPayload?.joined_participant_ids) ? sessionPayload.joined_participant_ids : [])
                .map((id) => sanitizeId(id))
                .filter(Boolean)
        ));
        const participantsById = new Map();
        const seedParticipant = (participant = {}) => {
            const id = sanitizeId(participant.id);

            if (!id || participantsById.has(id)) {
                return;
            }

            participantsById.set(id, {
                ...participant,
                id,
            });
        };

        (Array.isArray(sessionPayload?.participants) ? sessionPayload.participants : []).forEach(seedParticipant);
        seedParticipant(sessionPayload?.caller || {});
        seedParticipant(sessionPayload?.callee || {});

        const allowedParticipantIds = sessionPayload?.is_group
            ? participantIds
            : Array.from(new Set([
                sanitizeId(sessionPayload?.caller?.id),
                sanitizeId(sessionPayload?.callee?.id),
            ].filter(Boolean)));
        const normalizedParticipantIds = allowedParticipantIds.length > 0
            ? allowedParticipantIds
            : Array.from(participantsById.keys());
        const normalizedJoinedIds = joinedIds.filter((id) => normalizedParticipantIds.includes(id));

        sessionPayload.participant_ids = normalizedParticipantIds;
        sessionPayload.joined_participant_ids = normalizedJoinedIds;
        sessionPayload.participants = normalizedParticipantIds.map((participantId) => {
            const participant = participantsById.get(participantId) || {};

            return {
                ...participant,
                id: participantId,
                joined: normalizedJoinedIds.includes(participantId) || !!participant.joined,
            };
        });
    }

    isMobile()
    {
        return window.innerWidth < 768;
    }

    isVideoCall()
    {
        return String(this.session?.call_type || 'video') === 'video';
    }

    conversationKey()
    {
        return String(this.session?.conversation_key || '').trim();
    }

    isGroupConversation()
    {
        return this.conversationKey().startsWith('group:');
    }

    conversationId()
    {
        const conversationKey = this.conversationKey();

        if (!conversationKey) {
            return 0;
        }

        return sanitizeId(conversationKey.split(':')[1] || 0);
    }

    joinedParticipantIds()
    {
        return Array.from(new Set(
            (this.session?.joined_participant_ids || [])
                .map((id) => sanitizeId(id))
                .filter((id) => id > 0)
        ));
    }

    activePeerIds()
    {
        const joinedPeerIds = Array.from(new Set(
            this.joinedParticipantIds().filter((id) => id !== this.authId)
        ));

        if (joinedPeerIds.length > 0) {
            return joinedPeerIds;
        }

        if (String(this.session?.status || '') === 'active') {
            return Array.from(new Set(
                (Array.isArray(this.session?.participant_ids) ? this.session.participant_ids : [])
                    .map((id) => sanitizeId(id))
                    .filter((id) => id > 0 && id !== this.authId)
            ));
        }

        return [];
    }

    bindControls()
    {
        this.root.querySelector('[data-control="mic"]')?.addEventListener('click', () => {
            this.toggleMicrophone();
        });

        this.root.querySelector('[data-control="camera"]')?.addEventListener('click', () => {
            this.toggleCamera();
        });

        this.root.querySelector('[data-control="screen"]')?.addEventListener('click', () => {
            this.toggleMoreTray(false);
            this.toggleScreenShare().catch(() => {});
        });

        this.root.querySelector('[data-control="switch-camera"]')?.addEventListener('click', () => {
            this.toggleMoreTray(false);
            this.switchCamera().catch(() => {});
        });

        this.root.querySelector('[data-control="reactions"]')?.addEventListener('click', () => {
            this.toggleMoreTray(false);
            this.toggleReactionTray();
        });

        this.root.querySelector('[data-control="invite"]')?.addEventListener('click', () => {
            this.toggleMoreTray(false);
            this.toggleInviteSheet();
        });

        this.root.querySelector('[data-control="upgrade"]')?.addEventListener('click', () => {
            this.requestUpgradeToVideo().catch(() => {});
        });

        this.root.querySelector('[data-control="more"]')?.addEventListener('click', () => {
            this.toggleReactionTray(false);
            this.toggleInviteSheet(false);
            this.toggleMoreTray();
        });

        this.root.querySelector('[data-control="end"]')?.addEventListener('click', () => {
            this.endCall().catch(() => {});
        });

        this.root.querySelector('[data-call-open-chat]')?.addEventListener('click', () => {
            this.navigateBackToChat(false);
        });

        this.root.querySelector('[data-local-pip-reposition]')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.cyclePipPosition();
        });

        this.reactionTray?.querySelectorAll('[data-call-reaction]')?.forEach((button) => {
            button.addEventListener('click', () => {
                this.broadcastReaction(String(button.getAttribute('data-call-reaction') || ''));
                this.toggleReactionTray(false);
            });
        });

        this.root.querySelector('[data-invite-close]')?.addEventListener('click', () => {
            this.toggleInviteSheet(false);
        });

        this.stage?.addEventListener('pointerdown', () => {
            this.toggleReactionTray(false);
            this.toggleInviteSheet(false);
            this.toggleMoreTray(false);
            this.showControlsTemporarily();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.toggleReactionTray(false);
                this.toggleInviteSheet(false);
                this.toggleMoreTray(false);
            }
        });

        if (this.localPip) {
            this.localPip.addEventListener('pointerdown', (event) => this.beginPipDrag(event));
            window.addEventListener('pointermove', (event) => this.handlePipDrag(event));
            window.addEventListener('pointerup', () => this.endPipDrag());
        }

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                this.positionSheetsForViewport();
            });
        }

        window.addEventListener('resize', () => {
            this.positionSheetsForViewport();
            this.updateControlStates();
        });

        const handleLifecycleExit = () => {
            this.notifyServerOnLeave();
            this.releaseWakeLock().catch(() => {});
            this.broadcastChannel?.postMessage({
                type: 'call_room_closed',
                session_uuid: this.session?.uuid,
            });
        };

        window.addEventListener('beforeunload', handleLifecycleExit);
        window.addEventListener('pagehide', handleLifecycleExit);
    }

    bindBroadcastChannel()
    {
        if (!this.broadcastChannel) {
            return;
        }

        this.broadcastChannel.postMessage({
            type: 'call_room_opened',
            session_uuid: this.session?.uuid,
        });
    }

    subscribeToSession()
    {
        window.Echo.private(`call.session.${this.session.uuid}`)
            .listen('.CallSignal', (event) => {
                this.handleSessionSignal(event).catch(() => {});
            })
            .listen('.CallUpgradeVideo', (event) => {
                this.handleUpgradeEvent(event).catch(() => {});
            });
    }

    renderSessionSummary()
    {
        const participants = Array.isArray(this.session?.participants) ? this.session.participants : [];
        const joinedIds = new Set(this.joinedParticipantIds());
        const remoteParticipants = participants.filter((participant) => participant.id !== this.authId);
        const primaryParticipant = remoteParticipants[0] || this.session?.caller || this.session?.callee;
        const avatarUrl = resolveAssetUrl(this.assetUrl, this.session?.group?.avatar || primaryParticipant?.avatar || 'default/avatar.png');
        const title = this.session?.group?.name
            ? this.session.group.name
            : participants.length > 2
                ? participants.map((participant) => participantName(participant)).join(', ')
                : participantName(primaryParticipant);

        if (this.identityAvatar) {
            this.identityAvatar.style.backgroundImage = `url("${avatarUrl}")`;
        }

        if (this.overlayAvatar) {
            this.overlayAvatar.style.backgroundImage = `url("${avatarUrl}")`;
        }

        if (this.emptyName) {
            this.emptyName.textContent = this.session?.group?.name || participantName(primaryParticipant);
        }

        if (this.titleLabel) {
            this.titleLabel.textContent = title;
        }

        if (this.overlayTitle) {
            this.overlayTitle.textContent = this.session?.group?.name || participantName(primaryParticipant);
        }

        if (this.eyebrowLabel) {
            this.eyebrowLabel.textContent = participants.length > 2 ? 'Group call' : `${this.isVideoCall() ? 'Video' : 'Audio'} call`;
        }

        const connectedParticipantIds = joinedIds.size > 0
            ? Array.from(joinedIds)
            : (Array.isArray(this.session?.participant_ids) ? this.session.participant_ids : []).filter((id) => sanitizeId(id) > 0);
        const joinedCount = connectedParticipantIds.length;
        const hasRemotePeers = this.activePeerIds().length > 0;

        if (this.statusLabel) {
            if (this.session.status === 'ringing') {
                this.statusLabel.textContent = 'Ringing…';
            } else if (hasRemotePeers && (!this.grid || this.grid.children.length === 0)) {
                this.statusLabel.textContent = 'Connecting media…';
            } else if (joinedCount > 1) {
                this.statusLabel.textContent = `${joinedCount} people are connected`;
            } else {
                this.statusLabel.textContent = 'Connecting…';
            }
        }

        if (this.emptyLabel) {
            if (this.session.status === 'ringing') {
                this.emptyLabel.textContent = this.session?.caller?.id === this.authId
                    ? 'Waiting for them to answer…'
                    : 'Opening your call room…';
            } else if (hasRemotePeers) {
                this.emptyLabel.textContent = 'Connecting media…';
            } else if (this.session?.group?.name) {
                this.emptyLabel.textContent = 'Waiting for others to join…';
            } else {
                this.emptyLabel.textContent = 'Waiting for the other person to join…';
            }
        }
    }

    renderInviteCandidates()
    {
        if (!this.inviteList) {
            return;
        }

        if (!Array.isArray(this.inviteCandidates) || this.inviteCandidates.length === 0) {
            this.inviteList.innerHTML = '<p class="call-room__invite-empty">No one else is available to invite right now.</p>';
            return;
        }

        this.inviteList.innerHTML = this.inviteCandidates.map((candidate) => `
            <button type="button" class="call-room__invite-item" data-invite-user-id="${candidate.id}">
                <span class="call-room__invite-avatar" style="background-image: url('${resolveAssetUrl(this.assetUrl, candidate.avatar || 'default/avatar.png')}')"></span>
                <span class="call-room__invite-copy">
                    <strong>${participantName(candidate)}</strong>
                    <span>${candidate.user_name || ''}</span>
                </span>
                <span class="call-room__invite-badge">Invite</span>
            </button>
        `).join('');

        this.inviteList.querySelectorAll('[data-invite-user-id]').forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = sanitizeId(button.getAttribute('data-invite-user-id'));

                if (!userId) {
                    return;
                }

                button.setAttribute('disabled', 'disabled');

                try {
                    await axios.post(route('calls.group-invite', { session: this.session.uuid }), {
                        user_id: userId,
                        _token: this.csrfToken,
                    }, {
                        headers: {
                            'X-CSRF-TOKEN': this.csrfToken,
                        },
                    });

                    this.inviteCandidates = this.inviteCandidates.filter((candidate) => sanitizeId(candidate.id) !== userId);
                    this.renderInviteCandidates();
                    notify('success', 'Invite sent.');
                } catch (error) {
                    button.removeAttribute('disabled');
                    notify('error', error?.response?.data?.message || 'Unable to invite that person right now.');
                }
            });
        });
    }

    enterRingingState()
    {
        this.renderSessionSummary();
        this.updateOverlayCopy('Waiting for someone to answer…');
        this.startRingCountdown();
        this.refreshSessionState().catch(() => {});

        if (this.session?.caller?.id === this.authId) {
            this.prepareLocalMedia(this.isVideoCall()).catch(() => {});
        }
    }

    async enterConnectedState()
    {
        if (this.connectionBootstrapPromise) {
            return this.connectionBootstrapPromise;
        }

        if (this.callStartedAt && document.body.classList.contains('call-room-active')) {
            await this.syncPeerRoster();
            this.renderSessionSummary();
            return;
        }

        this.connectionBootstrapPromise = (async () => {
            await this.joinIfNeeded();
            await this.prepareLocalMedia(this.isVideoCall());
            await this.acquireWakeLock();

            this.setOverlayVisible(false);
            this.stopRingCountdown();

            const acceptedAt = this.session?.accepted_at ? new Date(this.session.accepted_at).getTime() : NaN;
            this.callStartedAt = this.callStartedAt || (Number.isNaN(acceptedAt) ? Date.now() : acceptedAt);
            this.startCallTimer();
            this.startQualityMonitor();
            await this.syncPeerRoster();
            this.renderSessionSummary();
            this.showControlsTemporarily();
            document.body.classList.add('call-room-active');
        })().finally(() => {
            this.connectionBootstrapPromise = null;
        });

        return this.connectionBootstrapPromise;
    }

    async joinIfNeeded()
    {
        if (this.session.status !== 'active') {
            return;
        }

        if (this.joinedParticipantIds().includes(this.authId)) {
            return;
        }

        if (this.joiningRequest) {
            await this.joiningRequest;
            return;
        }

        this.joiningRequest = axios.post(route('messenger.calls.accept', { session: this.session.uuid }), {
            _token: this.csrfToken,
        }, {
            headers: {
                'X-CSRF-TOKEN': this.csrfToken,
            },
        }).then((response) => {
            if (response?.data?.session) {
                this.session = response.data.session;
                this.decorateSessionPayload(this.session);
                this.broadcastChannel?.postMessage({
                    type: 'call_accepted_in_other_tab',
                    session_uuid: this.session.uuid,
                });
            }
        }).finally(() => {
            this.joiningRequest = null;
        });

        await this.joiningRequest;
    }

    updateOverlayCopy(message)
    {
        if (this.overlayCopy) {
            this.overlayCopy.textContent = message;
        }
    }

    setOverlayVisible(visible)
    {
        this.overlay?.classList.toggle('is-hidden', !visible);
    }

    startRingCountdown()
    {
        this.stopRingCountdown();

        const timeoutSeconds = Math.max(1, Number(this.session?.timeout_seconds || 30));
        const startedAtMs = Date.now();
        const deadline = startedAtMs + (timeoutSeconds * 1000);

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

            this.updateOverlayCopy(`No answer in ${formatDuration(remaining)}`);

            if (remaining <= 0) {
                this.stopRingCountdown();

                if (this.session?.caller?.id === this.authId) {
                    this.endCall(true).catch(() => {});
                } else {
                    this.updateOverlayCopy('Call timed out.');
                }
            }
        };

        tick();
        this.ringCountdownTimer = window.setInterval(tick, 1000);
    }

    stopRingCountdown()
    {
        if (this.ringCountdownTimer) {
            window.clearInterval(this.ringCountdownTimer);
            this.ringCountdownTimer = null;
        }
    }

    startSessionRefreshLoop()
    {
        if (this.sessionRefreshTimer || !this.session?.uuid) {
            return;
        }

        const refresh = () => {
            this.refreshSessionState().catch(() => {});
        };

        refresh();
        this.sessionRefreshTimer = window.setInterval(refresh, 2200);
    }

    stopSessionRefreshLoop()
    {
        if (this.sessionRefreshTimer) {
            window.clearInterval(this.sessionRefreshTimer);
            this.sessionRefreshTimer = null;
        }
    }

    participantSignature(ids = [])
    {
        return Array.from(new Set(
            (Array.isArray(ids) ? ids : [])
                .map((id) => sanitizeId(id))
                .filter(Boolean)
        ))
            .sort((left, right) => left - right)
            .join(',');
    }

    async refreshSessionState()
    {
        if (this.roomFinished || !this.session?.uuid) {
            return;
        }

        if (this.sessionRefreshRequest) {
            return this.sessionRefreshRequest;
        }

        this.sessionRefreshRequest = axios.get(route('messenger.calls.show', {
            session: this.session.uuid,
        }), {
            params: {
                _t: Date.now(),
            },
        }).then(async (response) => {
            const nextSession = response?.data?.session;

            if (!nextSession?.uuid) {
                return;
            }

            const previousStatus = String(this.session?.status || '');
            const previousParticipantSignature = this.participantSignature(this.session?.participant_ids || []);
            const previousJoinedSignature = this.participantSignature(this.session?.joined_participant_ids || []);
            const wasConnected = previousStatus === 'active' || !!this.callStartedAt;

            this.session = {
                ...this.session,
                ...nextSession,
            };
            this.decorateSessionPayload(this.session);
            this.renderSessionSummary();

            const nextStatus = String(this.session?.status || '');

            if (nextStatus === 'active') {
                await this.enterConnectedState();

                if (wasConnected) {
                    const nextParticipantSignature = this.participantSignature(this.session?.participant_ids || []);
                    const nextJoinedSignature = this.participantSignature(this.session?.joined_participant_ids || []);

                    if (
                        previousParticipantSignature !== nextParticipantSignature
                        || previousJoinedSignature !== nextJoinedSignature
                    ) {
                        await this.syncPeerRoster();
                        this.renderSessionSummary();
                    }
                }

                return;
            }

            if (nextStatus === 'declined') {
                this.finishRoom('Call declined.');
                return;
            }

            if (nextStatus === 'missed') {
                this.finishRoom('Call was missed.');
                return;
            }

            if (nextStatus === 'ended') {
                this.finishRoom('Call ended.');
            }
        }).catch(() => {
            // Keep listening through transient network hiccups.
        }).finally(() => {
            this.sessionRefreshRequest = null;
        });

        return this.sessionRefreshRequest;
    }

    startCallTimer()
    {
        if (this.callTimer) {
            return;
        }

        const render = () => {
            if (!this.statusLabel) {
                return;
            }

            const connectedCount = this.joinedParticipantIds().length;
            const duration = formatDuration(Math.floor((Date.now() - this.callStartedAt) / 1000));
            const suffix = connectedCount > 1 ? `${connectedCount} connected` : 'Connected';

            this.statusLabel.textContent = `${suffix} • ${duration}`;
        };

        render();
        this.callTimer = window.setInterval(render, 1000);
    }

    stopCallTimer()
    {
        if (this.callTimer) {
            window.clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    startQualityMonitor()
    {
        if (this.qualityMonitorTimer) {
            return;
        }

        const updateQuality = async () => {
            const peers = Array.from(this.peers.values());

            if (peers.length === 0) {
                this.updateQualityBars(0);
                return;
            }

            const rtts = [];

            await Promise.all(peers.map(async (peer) => {
                try {
                    const stats = await peer.connection.getStats();

                    stats.forEach((report) => {
                        if (
                            report.type === 'candidate-pair'
                            && report.state === 'succeeded'
                            && typeof report.currentRoundTripTime === 'number'
                        ) {
                            rtts.push(report.currentRoundTripTime * 1000);
                        }
                    });
                } catch (error) {
                    // Connection quality is informational and should not disrupt the call.
                }
            }));

            if (rtts.length === 0) {
                this.updateQualityBars(0);
                return;
            }

            const averageRtt = rtts.reduce((sum, value) => sum + value, 0) / rtts.length;
            const bars = averageRtt < 80
                ? 4
                : averageRtt < 150
                    ? 3
                    : averageRtt < 300
                        ? 2
                        : 1;

            this.updateQualityBars(bars);
        };

        updateQuality().catch(() => {});
        this.qualityMonitorTimer = window.setInterval(() => {
            updateQuality().catch(() => {});
        }, 3000);
    }

    stopQualityMonitor()
    {
        if (this.qualityMonitorTimer) {
            window.clearInterval(this.qualityMonitorTimer);
            this.qualityMonitorTimer = null;
        }

        this.updateQualityBars(0);
    }

    updateQualityBars(bars)
    {
        for (let index = 1; index <= 4; index += 1) {
            this.root.querySelector(`[data-quality-bar="${index}"]`)?.classList.toggle('is-active', index <= bars);
        }
    }

    async prepareLocalMedia(includeVideo = false)
    {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('This browser does not support WebRTC media access.');
        }

        if (!this.localAudioStream) {
            this.localAudioStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
        }

        if (includeVideo && !this.localCameraStream) {
            this.localCameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: this.currentFacingMode,
                },
            });
        }

        this.refreshLocalPreview();
    }

    refreshLocalPreview()
    {
        const previewTracks = [];
        const cameraTrack = this.localCameraStream?.getVideoTracks?.()[0] || null;

        if (cameraTrack) {
            previewTracks.push(cameraTrack);
        }

        this.localPreviewStream = previewTracks.length ? new MediaStream(previewTracks) : null;

        if (this.localVideo) {
            this.localVideo.srcObject = this.localPreviewStream;
            this.localVideo.play?.().catch(() => {});
        }

        this.localPip?.classList.toggle('is-hidden', !this.localPreviewStream);
    }

    audioTrack()
    {
        return this.localAudioStream?.getAudioTracks?.()[0] || null;
    }

    currentOutgoingVideoTrack()
    {
        return this.screenShareStream?.getVideoTracks?.()[0]
            || this.localCameraStream?.getVideoTracks?.()[0]
            || null;
    }

    async syncPeerRoster()
    {
        const targetPeerIds = Array.from(new Set(this.activePeerIds()));

        await Promise.all(targetPeerIds.map(async (peerId) => {
            const peer = this.ensurePeerConnection(peerId);

            await this.syncLocalTracksToPeer(peerId);

            if (sanitizeId(this.authId) < sanitizeId(peerId) && !peer.negotiating) {
                await this.negotiateWithPeer(peerId);
            }
        }));

        Array.from(this.peers.keys()).forEach((peerId) => {
            if (!targetPeerIds.includes(peerId)) {
                this.cleanupPeer(peerId);
            }
        });

        this.renderEmptyState();
    }

    ensurePeerConnection(peerId)
    {
        if (this.peers.has(peerId)) {
            return this.peers.get(peerId);
        }

        const connection = new RTCPeerConnection({
            iceServers: this.iceServers,
        });

        const remoteStream = new MediaStream();
        const tile = this.createRemoteTile(peerId, remoteStream);

        const peer = {
            id: peerId,
            connection,
            remoteStream,
            tile,
            negotiating: false,
            dataChannel: null,
        };

        connection.ontrack = (event) => {
            const stream = event.streams?.[0] || null;
            const incomingTracks = stream?.getTracks?.() || (event.track ? [event.track] : []);

            incomingTracks.forEach((track) => {
                const alreadyAttached = remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id);

                if (!alreadyAttached) {
                    remoteStream.addTrack(track);
                }
            });

            tile.video.srcObject = remoteStream;

            tile.video.play?.().catch(() => {});
            this.attachSpeakerMonitor(peerId, tile.video.srcObject);
            this.renderEmptyState();
        };

        connection.onicecandidate = (event) => {
            if (!event.candidate) {
                return;
            }

            this.sendSignal('candidate', toCandidateInit(event.candidate), peerId).catch(() => {});
        };

        connection.onconnectionstatechange = () => {
            tile.element.dataset.connectionState = connection.connectionState;

            if (['failed', 'closed'].includes(connection.connectionState)) {
                this.cleanupPeer(peerId);
            }
        };

        if (sanitizeId(this.authId) < sanitizeId(peerId)) {
            const dataChannel = connection.createDataChannel(REACTION_CHANNEL_LABEL);
            this.bindReactionChannel(peerId, dataChannel);
        }

        connection.ondatachannel = (event) => {
            if (event.channel?.label === REACTION_CHANNEL_LABEL) {
                this.bindReactionChannel(peerId, event.channel);
            }
        };

        this.peers.set(peerId, peer);

        return peer;
    }

    async syncLocalTracksToPeer(peerId)
    {
        const peer = this.ensurePeerConnection(peerId);
        const audioTrack = this.audioTrack();
        const videoTrack = this.currentOutgoingVideoTrack();
        const senders = peer.connection.getSenders();
        const audioSender = senders.find((sender) => sender.track?.kind === 'audio') || null;
        const videoSender = senders.find((sender) => sender.track?.kind === 'video') || null;

        if (audioTrack && !audioSender) {
            peer.connection.addTrack(audioTrack, this.localAudioStream);
        } else if (audioTrack && audioSender && audioSender.track !== audioTrack) {
            await audioSender.replaceTrack(audioTrack);
        }

        if (videoTrack && !videoSender) {
            const stream = this.screenShareStream || this.localCameraStream;

            if (stream) {
                peer.connection.addTrack(videoTrack, stream);
            }
        } else if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
        }
    }

    async negotiateWithPeer(peerId)
    {
        const peer = this.ensurePeerConnection(peerId);

        if (peer.negotiating) {
            return;
        }

        peer.negotiating = true;

        try {
            const offer = await peer.connection.createOffer();
            await peer.connection.setLocalDescription(offer);
            await this.sendSignal('offer', toDescriptionInit(offer), peerId);
        } finally {
            peer.negotiating = false;
        }
    }

    async handleSessionSignal(event)
    {
        if (!event?.session?.uuid || event.session.uuid !== this.session.uuid) {
            return;
        }

        if (this.roomFinished) {
            return;
        }

        this.session = {
            ...this.session,
            ...event.session,
        };
        this.decorateSessionPayload(this.session);
        this.renderSessionSummary();

        switch (event.type) {
        case 'accepted':
            this.broadcastChannel?.postMessage({
                type: 'call_accepted_in_other_tab',
                session_uuid: this.session.uuid,
            });
            await this.enterConnectedState();
            break;
        case 'declined':
            this.finishRoom('Call declined.');
            break;
        case 'hangup':
            this.finishRoom(event?.history_message?.meta?.status === 'missed' ? 'Call was missed.' : 'Call ended.');
            break;
        case 'group_participant_joined':
            await this.syncPeerRoster();
            break;
        case 'group_participant_left':
            await this.syncPeerRoster();
            break;
        case 'signal':
            await this.handleSignalPayload(event.payload || {}, sanitizeId(event.from_id));
            break;
        default:
            break;
        }
    }

    async handleUpgradeEvent(event)
    {
        if (!event?.session?.uuid || event.session.uuid !== this.session.uuid) {
            return;
        }

        this.session = {
            ...this.session,
            ...event.session,
            call_type: 'video',
        };
        this.decorateSessionPayload(this.session);
        this.updateControlStates();

        if (sanitizeId(event.fromUserId) !== this.authId) {
            try {
                await this.prepareLocalMedia(true);
                await this.syncPeerRoster();
            } catch (error) {
                notify('info', 'The call was upgraded to video, but camera access is still waiting on your permission.');
            }
        }
    }

    async handleSignalPayload(payload, fromUserId)
    {
        const signalType = String(payload.signal_type || '');
        const targetUserId = sanitizeId(payload.target_user_id || 0);

        if (targetUserId > 0 && targetUserId !== this.authId) {
            return;
        }

        if (signalType === 'screen_share_state') {
            this.updateRemoteScreenShareState(fromUserId, !!payload.signal_data?.active);
            return;
        }

        if (!fromUserId || fromUserId === this.authId) {
            return;
        }

        if (signalType === 'offer') {
            await this.receiveOffer(fromUserId, payload.signal_data);
            return;
        }

        if (signalType === 'answer') {
            await this.receiveAnswer(fromUserId, payload.signal_data);
            return;
        }

        if (signalType === 'candidate') {
            await this.receiveCandidate(fromUserId, payload.signal_data);
        }
    }

    async receiveOffer(peerId, signalData)
    {
        await this.prepareLocalMedia(this.isVideoCall());

        const peer = this.ensurePeerConnection(peerId);

        await this.syncLocalTracksToPeer(peerId);
        await peer.connection.setRemoteDescription(new RTCSessionDescription(signalData));

        const queuedCandidates = this.pendingCandidates.get(peerId) || [];

        while (queuedCandidates.length > 0) {
            const candidate = queuedCandidates.shift();
            await peer.connection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }

        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        await this.sendSignal('answer', toDescriptionInit(answer), peerId);
    }

    async receiveAnswer(peerId, signalData)
    {
        const peer = this.ensurePeerConnection(peerId);

        await peer.connection.setRemoteDescription(new RTCSessionDescription(signalData));
        const queuedCandidates = this.pendingCandidates.get(peerId) || [];

        while (queuedCandidates.length > 0) {
            const candidate = queuedCandidates.shift();
            await peer.connection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
    }

    async receiveCandidate(peerId, signalData)
    {
        const peer = this.peers.get(peerId);

        if (!peer || !peer.connection.remoteDescription) {
            const queue = this.pendingCandidates.get(peerId) || [];
            queue.push(signalData);
            this.pendingCandidates.set(peerId, queue);
            return;
        }

        await peer.connection.addIceCandidate(new RTCIceCandidate(signalData)).catch(() => {});
    }

    async sendSignal(signalType, signalData, targetUserId = null)
    {
        await axios.post(route('messenger.calls.signal', { session: this.session.uuid }), {
            _token: this.csrfToken,
            signal_type: signalType,
            signal_data: JSON.stringify(signalData),
            target_user_id: targetUserId,
        }, {
            headers: {
                'X-CSRF-TOKEN': this.csrfToken,
            },
        });
    }

    async toggleMicrophone()
    {
        await this.prepareLocalMedia(this.isVideoCall());

        const track = this.audioTrack();

        if (!track) {
            return;
        }

        track.enabled = !track.enabled;
        this.root.querySelector('[data-control="mic"]')?.classList.toggle('is-muted', !track.enabled);
    }

    async toggleCamera()
    {
        if (!this.isVideoCall()) {
            await this.requestUpgradeToVideo();
            return;
        }

        await this.prepareLocalMedia(true);

        const track = this.localCameraStream?.getVideoTracks?.()[0] || null;

        if (!track) {
            return;
        }

        track.enabled = !track.enabled;
        this.root.querySelector('[data-control="camera"]')?.classList.toggle('is-muted', !track.enabled);
    }

    async switchCamera()
    {
        if (!this.isVideoCall() || !navigator.mediaDevices?.getUserMedia) {
            return;
        }

        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';

        if (this.localCameraStream) {
            this.localCameraStream.getTracks().forEach((track) => track.stop());
            this.localCameraStream = null;
        }

        await this.prepareLocalMedia(true);
        await this.syncPeerRoster();
    }

    async toggleScreenShare()
    {
        if (this.screenShareStream) {
            await this.stopScreenShare();
            return;
        }

        if (!navigator.mediaDevices?.getDisplayMedia) {
            notify('error', 'Screen sharing is not supported in this browser.');
            return;
        }

        if (!this.isVideoCall()) {
            await this.requestUpgradeToVideo();
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
        });

        const screenTrack = stream.getVideoTracks?.()[0] || null;

        if (!screenTrack) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }

        screenTrack.addEventListener('ended', () => {
            this.stopScreenShare().catch(() => {});
        }, { once: true });

        this.screenShareStream = stream;
        await Promise.all(Array.from(this.peers.keys()).map(async (peerId) => {
            await this.syncLocalTracksToPeer(peerId);
            await this.negotiateWithPeer(peerId);
        }));

        await this.sendSignal('screen_share_state', {
            active: true,
        });

        this.root.querySelector('[data-control="screen"]')?.classList.add('is-active');
        notify('success', 'Screen sharing started.');
    }

    async stopScreenShare()
    {
        if (!this.screenShareStream) {
            return;
        }

        this.screenShareStream.getTracks().forEach((track) => track.stop());
        this.screenShareStream = null;

        await Promise.all(Array.from(this.peers.keys()).map(async (peerId) => {
            await this.syncLocalTracksToPeer(peerId);
            await this.negotiateWithPeer(peerId);
        }));

        await this.sendSignal('screen_share_state', {
            active: false,
        });

        this.root.querySelector('[data-control="screen"]')?.classList.remove('is-active');
        notify('info', 'Screen sharing stopped.');
    }

    updateRemoteScreenShareState(userId, isActive)
    {
        const peer = this.peers.get(userId);

        if (!peer?.tile?.element) {
            return;
        }

        peer.tile.element.classList.toggle('is-screen-sharing', isActive);

        if (isActive && peer.tile.element.requestFullscreen) {
            peer.tile.element.requestFullscreen().catch(() => {});
        }
    }

    async requestUpgradeToVideo()
    {
        if (this.isVideoCall()) {
            return;
        }

        await axios.post(route('calls.upgrade', { session: this.session.uuid }), {
            _token: this.csrfToken,
        }, {
            headers: {
                'X-CSRF-TOKEN': this.csrfToken,
            },
        });

        this.session.call_type = 'video';
        this.updateControlStates();

        await this.prepareLocalMedia(true);
        await Promise.all(Array.from(this.peers.keys()).map(async (peerId) => {
            await this.syncLocalTracksToPeer(peerId);
            await this.negotiateWithPeer(peerId);
        }));
    }

    bindReactionChannel(peerId, channel)
    {
        const peer = this.ensurePeerConnection(peerId);
        peer.dataChannel = channel;

        channel.addEventListener('message', (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');

                if (payload.type === 'reaction' && CALL_REACTIONS.includes(payload.emoji)) {
                    this.showReactionBurst(payload.emoji);
                }
            } catch (error) {
                // Ignore malformed data channel packets.
            }
        });
    }

    toggleReactionTray(forceState = null)
    {
        if (!this.reactionTray) {
            return;
        }

        const shouldShow = forceState === null
            ? this.reactionTray.classList.contains('is-hidden')
            : !!forceState;

        this.reactionTray.classList.toggle('is-hidden', !shouldShow);
        if (shouldShow) {
            this.toggleInviteSheet(false);
            this.toggleMoreTray(false);
        }
    }

    toggleInviteSheet(forceState = null)
    {
        if (!this.inviteSheet) {
            return;
        }

        const shouldShow = forceState === null
            ? this.inviteSheet.classList.contains('is-hidden')
            : !!forceState;

        this.inviteSheet.classList.toggle('is-hidden', !shouldShow);
        this.positionSheetsForViewport();
        if (shouldShow) {
            this.toggleReactionTray(false);
            this.toggleMoreTray(false);
        }
    }

    toggleMoreTray(forceState = null)
    {
        if (!this.moreTray) {
            return;
        }

        const shouldShow = forceState === null
            ? this.moreTray.classList.contains('is-hidden')
            : !!forceState;

        this.moreTray.classList.toggle('is-hidden', !shouldShow);
        this.positionSheetsForViewport();
    }

    positionSheetsForViewport()
    {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const viewportOffset = window.visualViewport?.offsetTop || 0;
        const bottomOffset = Math.max(0, window.innerHeight - viewportHeight - viewportOffset);

        if (this.inviteSheet) {
            this.inviteSheet.style.bottom = `${Math.max(bottomOffset + 96, 96)}px`;
        }

        if (this.reactionTray) {
            this.reactionTray.style.bottom = `${Math.max(bottomOffset + 96, 96)}px`;
        }

        if (this.moreTray) {
            this.moreTray.style.bottom = `${Math.max(bottomOffset + 96, 96)}px`;
        }
    }

    broadcastReaction(emoji)
    {
        if (!CALL_REACTIONS.includes(emoji)) {
            return;
        }

        this.showReactionBurst(emoji);

        this.peers.forEach((peer) => {
            if (peer.dataChannel?.readyState === 'open') {
                peer.dataChannel.send(JSON.stringify({
                    type: 'reaction',
                    emoji,
                }));
            }
        });
    }

    showReactionBurst(emoji)
    {
        if (!this.reactionBurstLayer) {
            return;
        }

        const burst = document.createElement('span');
        burst.className = 'call-room__burst';
        burst.textContent = emoji;
        burst.style.setProperty('--burst-x', `${Math.round((Math.random() - 0.5) * 160)}px`);

        this.reactionBurstLayer.appendChild(burst);

        window.setTimeout(() => {
            burst.remove();
        }, 2500);
    }

    createRemoteTile(peerId, stream)
    {
        const existingElement = this.grid?.querySelector(`[data-peer-id="${peerId}"]`);

        if (existingElement) {
            const existingVideo = existingElement.querySelector('video');

            if (existingVideo) {
                existingVideo.srcObject = stream;
            }

            return {
                element: existingElement,
                video: existingVideo,
            };
        }

        const participant = (this.session?.participants || []).find((item) => sanitizeId(item.id) === peerId) || {};
        const element = document.createElement('article');
        element.className = 'call-room__tile';
        element.dataset.peerId = String(peerId);

        element.innerHTML = `
            <video class="call-room__tile-video" autoplay playsinline></video>
            <div class="call-room__tile-gradient"></div>
            <span class="call-room__tile-name">${participantName(participant)}</span>
            <span class="call-room__tile-indicator"><i class="fas fa-microphone-slash"></i></span>
        `;

        const video = element.querySelector('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = false;
        video.addEventListener('loadedmetadata', () => {
            video.play?.().catch(() => {});
        });
        video.srcObject = stream;

        this.grid?.appendChild(element);

        return {
            element,
            video,
        };
    }

    renderEmptyState()
    {
        if (!this.emptyState) {
            return;
        }

        const hasRemoteTiles = this.grid?.children?.length > 0;

        this.emptyState.classList.toggle('is-hidden', hasRemoteTiles);
    }

    attachSpeakerMonitor(peerId, stream)
    {
        if (!stream || this.activeSpeakerMonitors.has(peerId)) {
            return;
        }

        try {
            this.audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();

            const source = this.audioContext.createMediaStreamSource(stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);

            const samples = new Uint8Array(analyser.frequencyBinCount);
            const peer = this.peers.get(peerId);

            const interval = window.setInterval(() => {
                analyser.getByteFrequencyData(samples);
                const average = samples.reduce((sum, sample) => sum + sample, 0) / Math.max(samples.length, 1);

                peer?.tile?.element?.classList.toggle('is-speaking', average > 22);
            }, 220);

            this.activeSpeakerMonitors.set(peerId, {
                source,
                analyser,
                interval,
            });
        } catch (error) {
            // Speaking detection is best-effort.
        }
    }

    cleanupPeer(peerId)
    {
        const peer = this.peers.get(peerId);

        if (!peer) {
            return;
        }

        const monitor = this.activeSpeakerMonitors.get(peerId);

        if (monitor) {
            window.clearInterval(monitor.interval);
            monitor.source.disconnect();
            this.activeSpeakerMonitors.delete(peerId);
        }

        peer.connection.ontrack = null;
        peer.connection.onicecandidate = null;
        peer.connection.onconnectionstatechange = null;
        peer.connection.close();
        peer.tile?.element?.remove();
        this.peers.delete(peerId);
        this.pendingCandidates.delete(peerId);
        this.renderEmptyState();
    }

    async endCall(silent = false)
    {
        if (this.callEnding || this.roomFinished) {
            return;
        }

        this.callEnding = true;

        try {
            await axios.delete(route('messenger.calls.hangup', { session: this.session.uuid }), {
                data: {
                    _token: this.csrfToken,
                },
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken,
                },
            });
        } catch (error) {
            if (!silent) {
                notify('error', error?.response?.data?.message || 'Unable to end the call cleanly.');
            }
        } finally {
            this.finishRoom('Call ended.', {
                navigate: true,
            });
        }
    }

    finishRoom(message, { navigate = true } = {})
    {
        if (this.roomFinished) {
            return;
        }

        this.roomFinished = true;
        this.leaveSignalSent = true;
        this.stopRingCountdown();
        this.stopSessionRefreshLoop();
        this.stopCallTimer();
        this.stopQualityMonitor();
        this.releaseWakeLock().catch(() => {});
        document.body.classList.remove('call-room-active');
        this.updateOverlayCopy(message);
        this.setOverlayVisible(true);
        this.broadcastChannel?.postMessage({
            type: 'call_ended_in_room',
            session_uuid: this.session?.uuid,
        });

        this.peers.forEach((_, peerId) => this.cleanupPeer(peerId));
        this.stopStream(this.localPreviewStream);
        this.localPreviewStream = null;
        this.stopStream(this.localAudioStream);
        this.localAudioStream = null;
        this.stopStream(this.localCameraStream);
        this.localCameraStream = null;
        this.stopStream(this.screenShareStream);
        this.screenShareStream = null;
        this.callEnding = false;

        if (navigate) {
            window.setTimeout(() => {
                this.navigateBackToChat();
            }, CALL_ROOM_NAVIGATION_DELAY_MS);
        }
    }

    stopStream(stream)
    {
        if (!stream?.getTracks) {
            return;
        }

        stream.getTracks().forEach((track) => {
            try {
                track.stop();
            } catch (error) {
                // Track teardown is best-effort during call shutdown.
            }
        });
    }

    notifyServerOnLeave()
    {
        if (this.leaveSignalSent || this.roomFinished || !this.session?.uuid || !this.csrfToken) {
            return;
        }

        this.leaveSignalSent = true;

        const leaveUrl = route('messenger.calls.leave', { session: this.session.uuid });
        const payload = new FormData();
        payload.append('_token', this.csrfToken);

        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(leaveUrl, payload);
                return;
            }
        } catch (error) {
            // Fall back to keepalive fetch below.
        }

        try {
            window.fetch(leaveUrl, {
                method: 'POST',
                body: payload,
                keepalive: true,
                credentials: 'same-origin',
            }).catch(() => {});
        } catch (error) {
            // Ignore lifecycle cleanup failures.
        }
    }

    navigateBackToChat(shouldCloseTab = true)
    {
        const conversationKey = this.conversationKey();
        const isGroup = this.isGroupConversation();
        const conversationId = this.conversationId();

        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({
                    type: 'call_ended',
                    conversationKey,
                    conversationId,
                    isGroup,
                }, window.location.origin);
            } catch (error) {
                // Ignore opener messaging failures and fall back to redirect.
            }

            if (shouldCloseTab) {
                try {
                    window.close();
                    return;
                } catch (error) {
                    // Redirect below if the browser blocks window.close().
                }
            }
        }

        const targetUrl = new URL('messenger', this.assetUrl);

        if (conversationKey) {
            targetUrl.searchParams.set('conversation', conversationKey);
        }

        window.location.href = targetUrl.toString();
    }

    updateControlStates()
    {
        const switchButton = this.root.querySelector('[data-control="switch-camera"]');
        const cameraButton = this.root.querySelector('[data-control="camera"]');
        const upgradeButton = this.root.querySelector('[data-control="upgrade"]');

        switchButton?.classList.toggle('is-hidden', !this.isVideoCall());
        cameraButton?.classList.toggle('is-hidden', !this.isVideoCall());
        upgradeButton?.classList.toggle('is-hidden', this.isVideoCall());

        if (!this.isMobile()) {
            this.controlBar?.classList.remove('is-hidden');
            return;
        }

        this.showControlsTemporarily();
    }

    showControlsTemporarily()
    {
        if (!this.controlBar) {
            return;
        }

        this.controlBar.classList.remove('is-hidden');

        if (!this.isMobile()) {
            return;
        }

        window.clearTimeout(this.controlsHideTimer);
        this.controlsHideTimer = window.setTimeout(() => {
            this.controlBar?.classList.add('is-hidden');
        }, MOBILE_CONTROL_IDLE_MS);
    }

    cyclePipPosition()
    {
        if (!this.localPip) {
            return;
        }

        this.pipPositionIndex = (this.pipPositionIndex + 1) % PIP_POSITIONS.length;
        this.localPip.dataset.position = PIP_POSITIONS[this.pipPositionIndex];
    }

    beginPipDrag(event)
    {
        if (!this.localPip || this.isMobile()) {
            return;
        }

        const rect = this.localPip.getBoundingClientRect();

        this.dragState = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
        };
    }

    handlePipDrag(event)
    {
        if (!this.localPip || !this.dragState || this.isMobile()) {
            return;
        }

        const maxLeft = Math.max(0, window.innerWidth - this.localPip.offsetWidth - 12);
        const maxTop = Math.max(0, window.innerHeight - this.localPip.offsetHeight - 12);
        const left = Math.min(maxLeft, Math.max(12, event.clientX - this.dragState.offsetX));
        const top = Math.min(maxTop, Math.max(12, event.clientY - this.dragState.offsetY));

        this.localPip.style.left = `${left}px`;
        this.localPip.style.top = `${top}px`;
        this.localPip.style.right = 'auto';
        this.localPip.style.bottom = 'auto';
    }

    endPipDrag()
    {
        this.dragState = null;
    }

    async acquireWakeLock()
    {
        if (!('wakeLock' in navigator) || this.wakeLock) {
            return;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => {
                this.wakeLock = null;
            });
        } catch (error) {
            // Wake lock is best-effort.
        }
    }

    async releaseWakeLock()
    {
        if (!this.wakeLock) {
            return;
        }

        try {
            await this.wakeLock.release();
        } catch (error) {
            // Ignore release failures.
        } finally {
            this.wakeLock = null;
        }
    }
}

const app = new CallRoomApp();
app.init();
