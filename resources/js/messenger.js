/**
 *  ------------------
 * | Global Variables |
 *  ------------------
*/
import { initializeCallManager } from './call-manager';

var temporaryMsgId = 0;
var activeUsersIds = [];
var voiceRecorder = null;
var voiceRecordingStream = null;
var voiceRecordingChunks = [];
var voiceRecordingBlob = null;
var voiceRecordingUrl = null;
var voiceRecordingStopResolver = null;
var voiceRecordingActive = false;
var attachmentPreviewUrls = [];

const messageForm             = $(".message-form"),
      messageInput            = $(".message-input"),
      messageBoxContainer     = $(".wsus__chat_area_body"),
      csrf_token              = $("meta[name=csrf_token]").attr("content"),
      auth_id                 = $("meta[name=auth_id]").attr("content"),
      assetUrl                = $("meta[name=asset-url]").attr("content") || `${window.location.origin}/`,
      messengerContactBox     = $(".messenger-contacts"),
      composerShell           = $(".footer_message"),
      attachmentInput         = $(".attachment-input"),
      attachmentPreviewBlock  = $(".attachment-block"),
      attachmentPreviewList   = $(".attachment-preview-list"),
      voicePreview            = $(".voice-preview"),
      voiceRecordToggle       = $(".voice-record-toggle"),
      voiceRecordStatus       = $(".voice-record-status"),
      voiceRecordToggleIcon   = $(".voice-record-toggle i");

const getMessengerId          = () => $("meta[name=id]").attr("content");
const setMessengerId          = (id) => $("meta[name=id]").attr("content", id);

function resolveAssetUrl(path)
{
    if (!path) {
        return "";
    }

    if (/^(?:https?:)?\/\//i.test(path)) {
        return path;
    }

    return new URL(path.replace(/^\/+/, ""), assetUrl).toString();
}

function truncateText(value, limit = 24)
{
    if (!value) {
        return "";
    }

    if (value.length <= limit) {
        return value;
    }

    return `${value.slice(0, Math.max(limit - 1, 1))}…`;
}

function formatDurationSeconds(seconds)
{
    const totalSeconds = Number(seconds || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
    }

    return [minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
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

function escapeHtml(value)
{
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getComposerEmojiArea()
{
    return messageInput.data('emojioneArea') || $("#example1").data('emojioneArea') || null;
}

function getComposerText()
{
    const composer = getComposerEmojiArea();

    if (composer && typeof composer.getText === 'function') {
        return composer.getText();
    }

    return messageInput.val() || '';
}

function setComposerText(value = '')
{
    const composer = getComposerEmojiArea();

    if (composer && typeof composer.setText === 'function') {
        composer.setText(value);
        return;
    }

    messageInput.val(value);
}

function shouldSendFromComposer(event)
{
    return !!event
        && event.key === 'Enter'
        && !event.shiftKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && !event.isComposing;
}

function toggleComposerState(className, active = false)
{
    composerShell.toggleClass(className, !!active);
}

function setVoiceRecordButtonState(active = false)
{
    voiceRecordToggle.toggleClass('active', active);
    voiceRecordToggle.attr('aria-pressed', active ? 'true' : 'false');
    voiceRecordToggle.attr('title', active ? 'Stop recording' : 'Record voice note');
    voiceRecordToggle.attr('aria-label', active ? 'Stop recording' : 'Record voice note');

    if (voiceRecordToggleIcon.length) {
        voiceRecordToggleIcon.toggleClass('fa-microphone', !active);
        voiceRecordToggleIcon.toggleClass('fa-stop', active);
    }
}

function formatFileSize(bytes)
{
    const value = Number(bytes || 0);

    if (!Number.isFinite(value) || value <= 0) {
        return '';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const precision = size >= 10 || unitIndex === 0 ? 0 : 1;

    return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function renderVoiceWaveBars()
{
    return '<span></span><span></span><span></span><span></span><span></span>';
}

function renderVoicePlayerMarkup({
    source,
    mime = 'audio/webm',
    title = 'Voice note',
    subtitle = 'Tap play to listen',
    iconClass = 'fas fa-microphone',
    sizeText = '',
    variantClass = '',
} = {})
{
    const subtitleParts = [subtitle, sizeText].filter(Boolean);
    const subtitleLabel = escapeHtml(subtitleParts.join(' · '));
    const waveClass = `voice-note-wave${variantClass.includes('recording') ? ' voice-note-wave--recording' : ''}`;

    return `
        <div class="voice-note-card ${variantClass}" data-voice-player>
            <div class="voice-note-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="flex-grow-1 min-w-0">
                <div class="voice-note-head">
                    <div class="min-w-0">
                        <div class="voice-note-title">${escapeHtml(title)}</div>
                        <div class="voice-note-subtitle">${subtitleLabel}</div>
                    </div>
                    <div class="${waveClass} voice-note-wave--compact" aria-hidden="true">
                        ${renderVoiceWaveBars()}
                    </div>
                </div>
                <div class="voice-audio-player">
                    <button type="button" class="voice-audio-player__toggle" aria-label="Play voice note">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-audio-player__timeline">
                        <div class="voice-audio-player__times">
                            <span class="voice-audio-player__current">0:00</span>
                            <span class="voice-audio-player__duration">0:00</span>
                        </div>
                        <div class="voice-audio-player__progress">
                            <span class="voice-audio-player__progress-fill"></span>
                        </div>
                    </div>
                    <audio class="voice-audio-player__audio" preload="none">
                        <source src="${escapeHtml(source)}" type="${escapeHtml(mime)}">
                    </audio>
                </div>
            </div>
        </div>
    `;
}

function initializeVoicePlayers(scope = document)
{
    $(scope).find('[data-voice-player]').each(function () {
        const $player = $(this);

        if ($player.data('voicePlayerBound')) {
            return;
        }

        const audio = $player.find('.voice-audio-player__audio').get(0);
        const toggle = $player.find('.voice-audio-player__toggle');
        const icon = toggle.find('i');
        const currentTime = $player.find('.voice-audio-player__current');
        const durationTime = $player.find('.voice-audio-player__duration');
        const progressFill = $player.find('.voice-audio-player__progress-fill');

        if (!audio || !toggle.length) {
            return;
        }

        const sync = () => {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
            const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
            const ratio = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

            currentTime.text(formatDurationSeconds(current));
            durationTime.text(duration > 0 ? formatDurationSeconds(duration) : '0:00');
            progressFill.css('width', `${ratio}%`);
        };

        const setPlayingState = (playing) => {
            $player.toggleClass('is-playing', playing);
            icon.toggleClass('fa-play', !playing);
            icon.toggleClass('fa-pause', playing);
        };

        const resetPlayer = () => {
            audio.currentTime = 0;
            progressFill.css('width', '0%');
            setPlayingState(false);
            sync();
        };

        toggle.on('click', async function () {
            if (audio.paused) {
                $('[data-voice-player]').not($player).each(function () {
                    const otherAudio = $(this).find('.voice-audio-player__audio').get(0);
                    if (otherAudio && !otherAudio.paused) {
                        otherAudio.pause();
                    }
                });

                try {
                    await audio.play();
                } catch (error) {
                    // Ignore autoplay blocking and keep the UI stable.
                }
            } else {
                audio.pause();
            }
        });

        audio.addEventListener('loadedmetadata', sync);
        audio.addEventListener('timeupdate', sync);
        audio.addEventListener('play', function () {
            setPlayingState(true);
            sync();
        });
        audio.addEventListener('pause', function () {
            setPlayingState(false);
            sync();
        });
        audio.addEventListener('ended', resetPlayer);

        sync();
        $player.data('voicePlayerBound', true);
    });
}

function formatAttachmentTypeLabel(type)
{
    switch (type) {
        case 'image':
            return 'Photo';
        case 'audio':
            return 'Audio';
        case 'video':
            return 'Video';
        default:
            return 'File';
    }
}

function guessAttachmentTypeFromPath(path)
{
    const extension = String(path || '').split('.').pop()?.toLowerCase() || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(extension)) {
        return 'image';
    }

    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension)) {
        return 'audio';
    }

    if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(extension)) {
        return 'video';
    }

    return 'file';
}

function normalizeAttachments(attachments, messageType = 'text')
{
    if (Array.isArray(attachments) && attachments.length > 0) {
        return attachments.map((attachment) => {
            if (typeof attachment === 'string') {
                return {
                    path: attachment,
                    name: attachment.split('/').pop(),
                    type: messageType === 'voice' ? 'audio' : guessAttachmentTypeFromPath(attachment),
                };
            }

            return attachment;
        });
    }

    if (typeof attachments === 'string' && attachments.length > 0) {
        return [
            {
                path: attachments,
                name: attachments.split('/').pop(),
                type: messageType === 'voice' ? 'audio' : guessAttachmentTypeFromPath(attachments),
            },
        ];
    }

    return [];
}

function guessAttachmentTypeFromFile(file)
{
    if (!file) {
        return 'file';
    }

    if (file.type && file.type.startsWith('image/')) {
        return 'image';
    }

    if (file.type && file.type.startsWith('audio/')) {
        return 'audio';
    }

    if (file.type && file.type.startsWith('video/')) {
        return 'video';
    }

    return guessAttachmentTypeFromPath(file.name || '');
}

function formatCallStatusLabel(status)
{
    if (!status) {
        return 'Ended';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildGalleryGroupId(messageId)
{
    return `gallery-${messageId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function clearAttachmentPreviewUrls()
{
    attachmentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    attachmentPreviewUrls = [];
}

function updateComposerVoiceStatus(text, active = false)
{
    if (!voiceRecordStatus.length) {
        return;
    }

    voiceRecordStatus.text(text).toggleClass('d-none', !text);
    voiceRecordStatus.toggleClass('text-danger', active);
}

function renderAttachmentPreview()
{
    const files = Array.from(attachmentInput[0]?.files || []);

    clearAttachmentPreviewUrls();

    if (!files.length) {
        attachmentPreviewList.empty();
        attachmentPreviewBlock.addClass('d-none');
        toggleComposerState('has-attachments', false);
        return;
    }

    const markup = files.map((file) => {
        const url = URL.createObjectURL(file);
        attachmentPreviewUrls.push(url);
        const attachmentType = guessAttachmentTypeFromFile(file);
        const safeFileName = escapeHtml(file.name);
        const icon = attachmentType === 'audio'
            ? 'fas fa-music'
            : attachmentType === 'video'
                ? 'fas fa-film'
                : attachmentType === 'file'
                    ? 'fas fa-file-alt'
                    : 'fas fa-image';
        const fileSize = formatFileSize(file.size);
        const attachmentLabel = formatAttachmentTypeLabel(attachmentType);

        const mediaMarkup = attachmentType === 'image'
            ? `<img src="${url}" alt="${safeFileName}" class="attachment-preview-media attachment-preview-media-image">`
            : attachmentType === 'video'
                ? `<video class="attachment-preview-media attachment-preview-media-video" controls muted playsinline preload="metadata"><source src="${url}" type="${file.type || 'video/mp4'}"></video>`
                : attachmentType === 'audio'
                    ? `<audio class="attachment-preview-media attachment-preview-media-audio" controls preload="metadata"><source src="${url}" type="${file.type || 'audio/mpeg'}"></audio>`
                    : `<div class="attachment-preview-placeholder"><i class="${icon} fs-3 text-primary"></i></div>`;

        return `
            <div class="attachment-preview-card" data-attachment-type="${attachmentType}">
                <div class="attachment-preview-media-wrap">
                    ${mediaMarkup}
                </div>
                <div class="attachment-preview-meta">
                    <span class="attachment-preview-name" title="${safeFileName}">${truncateText(safeFileName, 18)}</span>
                    <span class="attachment-preview-badge">${attachmentLabel}${fileSize ? ` • ${fileSize}` : ''}</span>
                </div>
            </div>
        `;
    }).join('');

    attachmentPreviewList.html(markup);
    attachmentPreviewBlock.removeClass('d-none');
    toggleComposerState('has-attachments', true);
}

function clearComposerAttachments()
{
    clearAttachmentPreviewUrls();
    attachmentInput.val('');
    attachmentPreviewList.empty();
    attachmentPreviewBlock.addClass('d-none');
    toggleComposerState('has-attachments', false);
}

function clearVoiceRecordingPreview()
{
    if (voiceRecordingUrl) {
        URL.revokeObjectURL(voiceRecordingUrl);
        voiceRecordingUrl = null;
    }

    voiceRecordingBlob = null;
    voicePreview.addClass('d-none').empty();
    updateComposerVoiceStatus('', false);
    toggleComposerState('has-voice-preview', false);
}

function resetVoiceRecordingState()
{
    if (voiceRecorder && voiceRecordingActive) {
        voiceRecorder.stop();
    }

    if (voiceRecordingStream) {
        voiceRecordingStream.getTracks().forEach((track) => track.stop());
    }

    voiceRecorder = null;
    voiceRecordingStream = null;
    voiceRecordingChunks = [];
    voiceRecordingActive = false;
    toggleComposerState('is-recording', false);
    setVoiceRecordButtonState(false);

    if (voiceRecordingStopResolver) {
        voiceRecordingStopResolver();
        voiceRecordingStopResolver = null;
    }
}

function stopVoiceRecording()
{
    return new Promise((resolve) => {
        if (!voiceRecorder || !voiceRecordingActive) {
            resolve();
            return;
        }

        voiceRecordingStopResolver = () => {
            resolve();
        };

        voiceRecorder.stop();
    });
}

async function startVoiceRecording()
{
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        notyf.error('Voice recording is not supported in this browser.');
        return;
    }

    if (voiceRecordingActive) {
        await stopVoiceRecording();
        return;
    }

    try {
        clearVoiceRecordingPreview();
        updateComposerVoiceStatus('Recording voice note...', true);
        voiceRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceRecordingChunks = [];
        voiceRecorder = new MediaRecorder(voiceRecordingStream);
        voiceRecordingActive = true;
        const recorder = voiceRecorder;
        toggleComposerState('is-recording', true);
        setVoiceRecordButtonState(true);

        voiceRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                voiceRecordingChunks.push(event.data);
            }
        };

        voiceRecorder.onstop = () => {
            const mimeType = recorder?.mimeType || 'audio/webm';
            const blob = new Blob(voiceRecordingChunks, { type: mimeType });

            if (voiceRecordingStream) {
                voiceRecordingStream.getTracks().forEach((track) => track.stop());
            }

            voiceRecordingBlob = blob.size > 0 ? blob : null;
            toggleComposerState('is-recording', false);

            if (voiceRecordingBlob) {
                if (voiceRecordingUrl) {
                    URL.revokeObjectURL(voiceRecordingUrl);
                }

                voiceRecordingUrl = URL.createObjectURL(voiceRecordingBlob);
                voicePreview.html(renderVoicePlayerMarkup({
                    source: voiceRecordingUrl,
                    mime: mimeType,
                    title: 'Voice note ready',
                    subtitle: 'Tap play to review',
                    iconClass: 'fas fa-microphone',
                    sizeText: formatFileSize(voiceRecordingBlob.size) || '',
                    variantClass: 'voice-note-card--message voice-note-card--recording',
                })).removeClass('d-none');
                toggleComposerState('has-voice-preview', true);
                initializeVoicePlayers(voicePreview[0]);
            } else {
                toggleComposerState('has-voice-preview', false);
            }

            voiceRecordingChunks = [];
            voiceRecordingActive = false;
            setVoiceRecordButtonState(false);
            updateComposerVoiceStatus('', false);

            if (voiceRecordingStopResolver) {
                const resolver = voiceRecordingStopResolver;
                voiceRecordingStopResolver = null;
                resolver();
            }
        };

        voiceRecorder.start();
    } catch (error) {
        voiceRecordingActive = false;
        setVoiceRecordButtonState(false);
        toggleComposerState('is-recording', false);
        updateComposerVoiceStatus('', false);
        notyf.error('Unable to access your microphone.');
    }
}

function renderMessageMedia(attachments, messageType = 'text', messageId = null)
{
    const normalizedAttachments = normalizeAttachments(attachments, messageType);

    if (!normalizedAttachments.length) {
        return '';
    }

    const galleryGroupId = buildGalleryGroupId(messageId);

    return `
        <div class="message-attachment-grid d-grid gap-2" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
            ${normalizedAttachments.map((attachment) => {
                const attachmentUrl = resolveAssetUrl(attachment.path);
                const attachmentType = attachment.type || 'file';
                const attachmentName = escapeHtml(attachment.name || attachmentUrl.split('/').pop());

                if (attachmentType === 'image') {
                    return `
                        <a class="venobox vbox-item rounded-4 overflow-hidden" data-gall="${galleryGroupId}" href="${attachmentUrl}">
                            <img src="${attachmentUrl}" alt="${attachmentName}" class="img-fluid w-100" loading="lazy">
                        </a>
                    `;
                }

                if (attachmentType === 'audio') {
                    return renderVoicePlayerMarkup({
                        source: attachmentUrl,
                        mime: attachment.mime || 'audio/mpeg',
                        title: truncateText(attachmentName, 24),
                        subtitle: 'Tap play to listen',
                        iconClass: 'fas fa-music',
                        sizeText: attachment.size ? formatFileSize(attachment.size) : '',
                        variantClass: 'voice-note-card--message',
                    });
                }

                if (attachmentType === 'video') {
                    return `
                        <video controls playsinline class="w-100 rounded-4 message-media-video" preload="metadata">
                            <source src="${attachmentUrl}" type="${attachment.mime || 'video/mp4'}">
                        </video>
                    `;
                }

                return `
                    <a href="${attachmentUrl}" class="rounded-4 border bg-light d-flex align-items-center gap-3 p-3 text-decoration-none text-dark" download>
                        <span class="rounded-circle bg-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style="width: 42px; height: 42px;">
                            <i class="fas fa-file-alt text-primary"></i>
                        </span>
                        <span class="small fw-semibold text-truncate" style="max-width: 220px;">${attachmentName}</span>
                    </a>
                `;
            }).join('')}
        </div>
    `;
}

function renderReceivedMessageCard(e)
{
    const messageType = e.message_type || 'text';
    const attachments = normalizeAttachments(e.attachments || e.attachment, messageType);
    const isMine = Number(e.from_id) === Number(auth_id);
    const canDelete = isMine && messageType !== 'call';
    const bodyText = typeof e.body === 'string' ? e.body.trim() : (e.body || '');
    const body = escapeHtml(bodyText);
    const messageTime = formatTimestampLabel(e.created_at);

    if (messageType === 'call') {
        const callType = e?.meta?.call_type || 'video';
        const status = e?.meta?.status || 'ended';
        const duration = formatDurationSeconds(e?.meta?.duration_seconds || 0);
        const callIcon = callType === 'audio' ? 'fas fa-phone' : 'fas fa-video';
        const badgeClass = status === 'active'
            ? 'bg-info text-dark'
            : status === 'declined'
                ? 'bg-danger text-white'
                : status === 'ringing'
                    ? 'bg-warning text-dark'
                    : 'bg-success text-white';

        return `
            <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="call">
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    <div class="call_history_card rounded-4 p-3 border border-2 ${badgeClass}">
                        <div class="d-flex align-items-center gap-3">
                            <div class="flex-shrink-0 rounded-circle bg-white text-dark d-flex align-items-center justify-content-center" style="width: 54px; height: 54px;">
                                <i class="${callIcon} fs-5"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="fw-semibold mb-1">${body || `${callType.charAt(0).toUpperCase()}${callType.slice(1)} call`}</div>
                                <div class="small">
                                    <span>${formatCallStatusLabel(status)}</span>
                                    <span class="mx-1">•</span>
                                    <span>${duration}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <span class="time">${messageTime} · ${duration}</span>
                    ${canDelete ? `<a class="action dlt-message" href="javascript:void(0)" data-msgid="${e.id}"><i class="fas fa-trash"></i></a>` : ''}
                </div>
            </div>
        `;
    }

    const mediaMarkup = renderMessageMedia(attachments, messageType, e.id);

    if (messageType === 'voice') {
        const voiceAttachment = attachments[0] || null;
        const voiceUrl = voiceAttachment?.path ? resolveAssetUrl(voiceAttachment.path) : '';
        const voiceMime = voiceAttachment?.mime || 'audio/webm';
        const voiceSize = formatFileSize(voiceAttachment?.size);

        return `
            <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="voice">
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    ${renderVoicePlayerMarkup({
                        source: voiceUrl,
                        mime: voiceMime,
                        title: body || 'Voice note',
                        subtitle: 'Tap play to listen',
                        iconClass: 'fas fa-microphone',
                        sizeText: voiceSize || '',
                        variantClass: 'voice-note-card--message',
                    })}
                    <span class="time">${messageTime}</span>
                    ${canDelete ? `<a class="action dlt-message" href="javascript:void(0)" data-msgid="${e.id}"><i class="fas fa-trash"></i></a>` : ''}
                </div>
            </div>
        `;
    }

    if (attachments.length > 0) {
        return `
            <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="${messageType}">
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    ${body ? `<p class="messages">${body}</p>` : ''}
                    ${mediaMarkup}
                    <span class="time">${messageTime}</span>
                    ${canDelete ? `<a class="action dlt-message" href="javascript:void(0)" data-msgid="${e.id}"><i class="fas fa-trash"></i></a>` : ''}
                </div>
            </div>
        `;
    }

    return `
        <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="${messageType}">
            <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                ${body ? `<p class="messages">${body}</p>` : ''}
                <span class="time">${messageTime}</span>
                ${canDelete ? `<a class="action dlt-message" href="javascript:void(0)" data-msgid="${e.id}"><i class="fas fa-trash"></i></a>` : ''}
            </div>
        </div>
    `;
}

/**
 *  ---------------------
 * | Resuable Function   |
 *  ---------------------
*/
function enableChatBoxLoader() {
    $(".wsus__message_paceholder").removeClass('d-none');

}//End Method
function disableChatBoxLoader() {
    $(".wsus__chat_app").removeClass('show_info');
    $(".wsus__message_paceholder").addClass('d-none');
    $(".wsus__message_paceholder_blank").addClass('d-none');

}//End Method
function imagePreview(input, selector) {
    if (input.files && input.files[0]) {
        var render = new FileReader();

        render.onload = function (e) {
            $(selector).attr('src', e.target.result);
        }

        render.readAsDataURL(input.files[0]);
    }

}//End Method
async function sendMessage() 
{
    temporaryMsgId += 1;
    let tempID = `temp_${temporaryMsgId}`; //temp_1, temp_2 ....
    const inputValue = getComposerText();

    if (voiceRecordingActive) {
        await stopVoiceRecording();
    }

    const hasAttachment = (attachmentInput[0]?.files?.length || 0) > 0;
    const hasVoiceMessage = !!voiceRecordingBlob;

    if (inputValue.trim().length > 0 || hasAttachment || hasVoiceMessage) {
        const formData = new FormData(messageForm[0]);
        formData.append("id", getMessengerId());
        formData.append("temporaryMsgId", tempID);
        formData.append("_token", csrf_token);

        if (hasVoiceMessage) {
            const voiceFile = new File(
                [voiceRecordingBlob],
                `voice-note-${Date.now()}.webm`,
                { type: voiceRecordingBlob.type || 'audio/webm' }
            );

            formData.append('voice_message', voiceFile, voiceFile.name);
        }

        $.ajax({
            method: "POST",
            url: route('messenger.send-message'),
            data: formData,
            dataType: "JSON",
            processData: false,
            contentType: false,
            beforeSend: function () {
                //Add temp message on dom
                if (hasAttachment || hasVoiceMessage) {
                    messageBoxContainer.append(
                        sendTempMessageCard(
                            inputValue.trim().length > 0 ? inputValue : (hasVoiceMessage ? 'Voice note' : ''),
                            tempID,
                            true
                        )
                    );
                } else {
                    messageBoxContainer.append(sendTempMessageCard(inputValue, tempID));
                }

                $('.no_messages').addClass('d-none');

                scrolllToBottom(messageBoxContainer);
                messageFormReset();

            },
            success: function (data) {
                makeSeen(true);
                //Update conatcts lists...
                updateContactItem(getMessengerId());
                const tempMsgCardElement = messageBoxContainer.find(`.message-card[data-id="${data.tempID}"]`);

                if (tempMsgCardElement.length) {
                    tempMsgCardElement.before(data.message);
                    tempMsgCardElement.remove();
                } else {
                    messageBoxContainer.append(data.message);
                }
                initVenobox();
                initializeVoicePlayers(messageBoxContainer[0]);
            },
            error: function (xhr, status, error) {
                // console.log(error);
            }
        });

    }

}//End Method
function deleteMessage(message_id)
{
    Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
      }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                method: "DELETE",
                url: route("messenger.delete-message"),
                data: {
                    message_id: message_id,
                    _token : csrf_token
                },
                beforeSend: function()
                {
                    $(`.message-card[data-id="${message_id}"]`).remove();

                },
                success: function(data)
                {
                    notyf.success(data.message);
                    //Update conatcts lists...
                    updateContactItem(getMessengerId());
                },
                error: function(xhr, status, error){
                    // console.log(error);
                }
            });
         
        }
      });

}//End Method


/**
 *  ---------------------------------------------
 * | Generates an HTML string representing a     |
 * | temporary message card for a chat interface.|
 *  ---------------------------------------------
*/
function sendTempMessageCard(message, tempId, attachemnt = false) 
{
    const safeMessage = escapeHtml(message);

    if (attachemnt) {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${tempId}">
                        <div class="wsus__single_chat chat_right">
                            <div class="pre_loader">
                                <div class="spinner-border text-light" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                            
                            ${safeMessage.trim().length > 0 ? `<p class="messages">${safeMessage}</p>` : ''}

                            <span class="clock"><i class="fas fa-clock"></i> sending</span>
                        </div>
                    </div>
                `;

    } else {
        return `
                    <div class="wsus__single_chat_area message-card" data-id="${tempId}">
                        <div class="wsus__single_chat chat_right">
                            <p class="messages">${safeMessage}</p>
                            <span class="clock"><i class="fas fa-clock"></i> sending</span>
                        </div>
                    </div>
                `;
    }

}//End Method

/**
 *  ---------------------------------------------
 * | Generates an HTML string representing a     |
 * | received message card for a chat interface. |
 *  ---------------------------------------------
*/
function receiveMessageCard(e) 
{
    return renderReceivedMessageCard(e);
}//End Method

/**
 *  -------------------------------------
 * | Resets the message from dom or Form |
 *  -------------------------------------
*/
function messageFormReset() 
{
    clearComposerAttachments();
    clearVoiceRecordingPreview();
    resetVoiceRecordingState();
    toggleComposerState('has-attachments', false);
    toggleComposerState('has-voice-preview', false);
    toggleComposerState('is-recording', false);
    setVoiceRecordButtonState(false);
    updateComposerVoiceStatus('', false);
    messageForm.trigger("reset");
    setComposerText('');

}//End Method

/** 
 *  ------------------------------
 * | Fetch messages from database |
 *  ------------------------------
*/
let messagesPage = 1;
let noMoreMessages = false;
let messagesLoading = false;
function fetchMessages(id, newFetch = false) 
{
    if (newFetch) {
        messagesPage = 1;
        noMoreMessages = false;
    }
    if (!noMoreMessages && !messagesLoading) {
        $.ajax({
            method: 'GET',
            url: route('messenger.fetch-messages'),
            data: {
                _token: csrf_token,
                id: id,
                page: messagesPage
            },
            beforeSend: function () {
                messagesLoading = true;
                let loader = `
                    <div class="text-center mt-2 messages-loader">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                     </div>
                `;
                messageBoxContainer.prepend(loader);
            },
            success: function (data) {
                
                //remove the loader
                messagesLoading = false;
                messageBoxContainer.find(".messages-loader").remove();

                //Make Messages seen
                makeSeen(true);
                initVenobox();

                if (messagesPage == 1) {

                    messageBoxContainer.html(data.messages);
                    initializeVoicePlayers(messageBoxContainer[0]);

                } else {
                    const lastMsg = $(messageBoxContainer).find(".message-card").first();
                    const curOffset = lastMsg.offset().top - messageBoxContainer.scrollTop();

                    messageBoxContainer.prepend(data.messages);
                    initializeVoicePlayers(messageBoxContainer[0]);
                    messageBoxContainer.scrollTop(lastMsg.offset().top - curOffset);

                }

                if (messagesPage === 1) {
                    window.__messengerCallManager?.rehydrateHistoryMessage?.();
                    scrolllToBottom(messageBoxContainer);
                }

                //Pagination Lock and Page Increment
                noMoreMessages = messagesPage >= data?.last_page;
                if (!noMoreMessages) messagesPage += 1;
                
                initVenobox();
                
                disableChatBoxLoader();
            },
            error: function (xhr, status, error) {}
        });
    }

}//End Method

/** 
 *  ----------------------------------
 * | Fetch contact list from database |
 *  ----------------------------------
*/
let contactsPage = 1;
let noMoreContacts = false;
let contactLoading = false;
function getContacts()
{
    if(!contactLoading && !noMoreContacts )
    {
        $.ajax({
            method: "GET",
            url: route("messenger.fetch-contacts"),
            data: {page: contactsPage},
            beforeSend: function(){
                contactLoading = true;
                let loader =`
                                <div class="text-center mt-2 contact-loader">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            `;
                messengerContactBox.append(loader);

            },
            success: function(data){
                contactLoading = false;
                messengerContactBox.find(".contact-loader").remove();

                if(contactsPage < 2)
                {
                    messengerContactBox.html(data.contacts);

                }else
                {
                    messengerContactBox.append(data.contacts);
                }
                
                noMoreContacts =  contactsPage >= data?.last_page;
                
                if(!noMoreContacts) contactsPage ++;

                //Cheks either the user is activate on pagination or not and set active class.
                updateUserActiveList();

            },
            error: function(xhr, status, error){
                contactLoading = false;
                messengerContactBox.find(".contact-loader").remove();
            }
        });
    }


}//End Method

/**
 *  ----------------------
 * | User Search Function |
 *  ----------------------
 */
let searchPage = 1;
let noMoreDataSearch = false;
let searchTempVal = "";
let setSearchLoading = false;

function searchUsers(query) {
    // Check if the new query is different from the previous one
    if (query !== searchTempVal) {
        searchPage = 1;
        noMoreDataSearch = false;
    }

    searchTempVal = query;
    // Update the URL with the search query
    const url = new URL(window.location);
    if (query) {
        url.searchParams.set('search', encodeURIComponent(query));
    } else {
        url.searchParams.delete('search');
    }
    history.replaceState(null, '', url.toString());

    // Proceed with the search request if not currently loading and if there's more data to fetch
    if (!setSearchLoading && !noMoreDataSearch) {
        $.ajax({
            method: 'GET',
            url: route('messenger.search'),
            data: { query: query, page: searchPage },
            beforeSend: function () {
                setSearchLoading = true;
                let loader = `
                    <div class="text-center mt-2 search-loader">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                `;
                $('.user_search_list_result').append(loader);
            },
            success: function (data) {
                setSearchLoading = false;
                $('.user_search_list_result').find('.search-loader').remove();

                if (searchPage < 2) {
                    $('.user_search_list_result').html(data.records);
                } else {
                    $('.user_search_list_result').append(data.records);
                }

                noMoreDataSearch = searchPage >= data?.last_page;

                if (!noMoreDataSearch) searchPage += 1;
            },
            error: function (xhr, status, error) {
                setSearchLoading = false;
                $('.user_search_list_result').find('.search-loader').remove();
            }
        });
    }
}// End Method

/**
 *  --------------------------------------
 * | Attaches a scroll event listener     |
 * | to the specified selector and calls  |
 * | the provided callback function when  |
 * | the scroll reaches the top or bottom |
 * | of the element.                      |
 *  --------------------------------------
*/
function actionOnScroll(selector, callback, topScroll = false) {
    $(selector).on('scroll', function () {
        let element = $(this).get(0);
        const condition = topScroll ? element.scrollTop == 0 : element.scrollTop + element.clientHeight >= element.scrollHeight;

        if (condition) {
            callback();
        }

    });

}//End Method

/**
 *  ---------------------------------
 * | Debounces a function,           |
 * | ensuring that it is only        |
 * | called after a specified delay. |
 *  ---------------------------------
*/
function debounce(callback, delay) 
{
    let timerId;

    return function (...args) {
        clearTimeout(timerId);

        timerId = setTimeout(() => {
            callback.apply(this, args);
        }, delay);
    }

}//End Method

/**
 *  ---------------------------------
 * | Fetch Id data of the user and   |
 * | append it to the DOM.           |
 *  ---------------------------------
*/
function Idinfo(id)
{
    $.ajax({
        method: 'GET',
        url: route('messenger.id-info'),
        data: { id: id },
        beforeSend: function () {
            NProgress.start();
            enableChatBoxLoader();
        },
        success: function (data) {
            //Fetch Messages
            fetchMessages(data.fetch.id, true);

            //Load gallery:
            $(".wsus__chat_info_gallery").html("");
            if(data?.shared_photos)
                {
                    $(".nothing_share").addClass("d-none");
                    $(".wsus__chat_info_gallery").html(data.shared_photos);
            }else
            {
                $(".nothing_share").removeClass("d-none");
            }

            initVenobox();
            initializeVoicePlayers(messageBoxContainer[0]);

            //Fetch Favourites and handles the favorite button
            data.favorite > 0 ? $(".favourite").addClass("active") : $(".favourite").removeClass("active");

            $(".messenger-header").find("img").attr("src", resolveAssetUrl(data.fetch.avatar));
            $(".messenger-header").find("h4").text(data.fetch.name);

            $(".messenger-info-view .user_photo").find("img").attr("src", resolveAssetUrl(data.fetch.avatar));
            $(".messenger-info-view").find(".user_name").text(data.fetch.name);
            $(".messenger-info-view").find(".user_unique_name").text(data.fetch.user_name);
            NProgress.done();
        },
        error: function (xhr, status, error) {
            disableChatBoxLoader();
        }
    });

}//End Method

/** 
 *  ----------------------------
 * | Slide to bottom on action. |
 *  ----------------------------
*/
function scrolllToBottom(container) 
{
    $(container).stop().animate({
        scrollTop: $(container)[0].scrollHeight
    });

}//End Method

/**
 *  ----------------------------
 * | This function is called    |
 * | only when the user sends   |
 * | a new message, and in the  |
 * | meantime it updates the    |
 * | contact item.              |
 *  ----------------------------
*/
function updateContactItem(user_id)
{
    if(user_id != auth_id)
    {
        $.ajax({
            method: 'GET',
            url : route('messenger.update-contact-item'),
            data: { user_id: user_id },
            success: function(data){
                if (messageBoxContainer.find('.no_contact').length) {
                    messengerContactBox.find('.no_contact').remove();
                }
                messengerContactBox.find(`.messenger-list-item[data-id="${user_id}"]`).remove();
                messengerContactBox.prepend(data.contact_item);
                // Adding (+) -- Infornt of the vairable 
                // sets or makes it integer
                if(activeUsersIds.includes(+user_id)){
                   userActive(user_id);
                }else{
                    userInactive(user_id);
                }

                if(user_id == getMessengerId()) updateSelectedContent(user_id);
    
            },
            error: function(xhr, status, error){}
    
        });
    }

}//End Method


/**
 *  -------------------------------------
 * | Updates the selected content in dom |
 * | sets to active class.               |
 *  -------------------------------------
*/
function updateSelectedContent(user_id)
{
    $(".messenger-list-item").removeClass('active');
    $(`.messenger-list-item[data-id="${user_id}"]`).addClass('active');

}//End Method

/**
 *  ----------------------------------
 * | saves users to favoruite lists.   |
 *  ----------------------------------
*/
function star(user_id)
{
    $(".favourite").toggleClass('active');

    $.ajax({
        method: "POST",
        url: route("messenger.favorite"),
        data: {  
            _token: csrf_token,
            id: user_id,
        },
        success: function(data) {
            if(data.status == 'added')
            {
                notyf.success('User added to favourite list.');
            }else
            {
                notyf.success('User removed from favourite list.');
            }

        },
        error: function(xhr, status, error){

        }
    });

}//End Method


/**
 *  ---------------------
 * | Make Messaes seen   |
 *  ---------------------
*/
function makeSeen(status)
{
    $(`.messenger-list-item[data-id="${getMessengerId()}"]`).find('.unseen_count').remove();
    $.ajax({
        method: 'POST',
        url: route('messenger.make-seen'),
        data: {  
            _token: csrf_token,
            id: getMessengerId()
        },
        success: function(data){},
        error: function(xhr, status, error){}

    });

}//End Method

/**
 *  ---------------------------
 * | Initialize venobox.js     |
 *  ---------------------------
*/
function initVenobox()
{
    $('.venobox').venobox();
}

/**
 *  ---------------------------
 * | Play Message Sound.       |
 *  ---------------------------
*/
function playNotficationSound()
{
    const sound = new Audio(resolveAssetUrl('default/message-sound.mp3'));
    sound.play();
}

/**
 *  --------------------------------
 * | Boradcasting Listener that,    |
 * | listens to the Message channel.|
 *  --------------------------------
*/
window.Echo.private('message.' + auth_id)
    .listen("Message", (e) => {
        // console.log(e);

        if(getMessengerId() != e.from_id)
        {
            updateContactItem(e.from_id);
            playNotficationSound();
        }
    
        let message = receiveMessageCard(e);
        if(getMessengerId() == e.from_id)
        {
            messageBoxContainer.append(message);
            scrolllToBottom(messageBoxContainer);
        }

});//End Method

/** 
 *  ---------------------------------------
 *  | Listens to the User Presence Channel.|
 *  ---------------------------------------
*/
window.Echo.join('online')
    .here((users) => {
        //Set Active Users Ids
        setActiveUsersIds(users);
        // console.log(activeUsersIds);
        $.each(users, function(index, user){
            let contactItem = $(`.messenger-list-item[data-id="${user.id}"]`).find('.img').find('span');
            contactItem.removeClass('inactive');
            contactItem.addClass('active');

        });

}).joining((user) => {
    //Adding new user to the active users array
    addNewUserId(user.id);
    // console.log(activeUsersIds);
    userActive(user.id);

}).leaving((user) => {
    //Removing user from the active users array
    removeUserId(user.id);
    // console.log(activeUsersIds);
    userInactive(user.id);

});//End Method


/**
 *  ------------------------------------------------
 * | cheks the id in user lists while pagination,    |
 * | Makes the user active.                          |
 *  -------------------------------------------------
*/
function updateUserActiveList()
{
    $('.messenger-list-item').each(function(index, value){
        let id = $(this).data('id');

        if(activeUsersIds.includes(+id)) userActive(id);

    });

}//End Method

/**
 *  -----------------------------------
 * | Cheks the id of the user and if   |
 * | active sets the class active.     |
 *  -----------------------------------
*/
function userActive(id)
{
    let contactItem = $(`.messenger-list-item[data-id="${id}"]`).find('.img').find('span');
    contactItem.removeClass('inactive');
    contactItem.addClass('active');

}//End Method

/**
 *  ------------------------------------
 * | Cheks the id of the user and if    |
 * | active sets the class inactive.    |
 *  ------------------------------------
*/
function userInactive(id)
{
    let contactItem = $(`.messenger-list-item[data-id="${id}"]`).find('.img').find('span');
    contactItem.removeClass('active');
    contactItem.addClass('inactive');

}//End Method

/**
 *  -----------------------------------
 * | Set Active Users id to an array   |
 *  -----------------------------------
*/
function setActiveUsersIds(users)
{
    $.each(users, function(index, user){
        activeUsersIds.push(user.id);
    });

}//End Method


/**
 *  -------------------------------
 * | Add New User id to an array   |
 *  -------------------------------
*/
function addNewUserId(id)
{
    activeUsersIds.push(id);

}


/**
 *  -------------------------------
 * | Remove User id to an array.   |
 *  -------------------------------
*/
function removeUserId(id)
{
    let index = activeUsersIds.indexOf(id);

    if(index !== -1){
        activeUsersIds.splice(index, 1);
    }

}


/**
 *  ---------------
 * | On DOM Load   |
 *  ---------------
*/
$(document).ready(function () 
{   
    getContacts();;
    initializeCallManager();

    /**
     *  -------------------------------------------
     * | Hides the contact lists and shows mesages |
     * | and vice-versa.                           |
     *  -------------------------------------------
    */
    if(window.innerWidth < 768)
    {
        $("body").on("click", ".messenger-list-item", function() {
            $(".wsus__user_list").addClass('d-none');
        }); 
        
        $("body").on("click", ".back_to_list", function() {
            $(".wsus__user_list").removeClass('d-none');
        });

    }
    
    /**
     *   ------------------------------
     *  | Short-cut Key for Search box |
     *   ------------------------------
     */
    $('body').on('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault(); // Prevent the default browser action (save page)
            var $input = $('.user_search');
            $input.show().focus(); // Show and focus the input element
            $input.trigger('click'); 
        }
    });

    $('#select_file').change(function () {
        imagePreview(this, '.profile-image-preview');
    });

    /**
    *  ---------------------------
    * | Search on action on keyup | 
    *  --------------------------
    */
    const debouncedSearch = debounce(function () {
        const value = $('.user_search').val();
        searchUsers(value);
    }, 500);

    $('.user_search').on('keyup', function (e) {
        e.preventDefault();
        let query = $(this).val();
        if (query.length > 0) {
            debouncedSearch();
        }
    });

    /**
    *  ----------------------------------- 
    * | Search Pagination on Scroll Event |
    *  ----------------------------------- 
    */
    actionOnScroll(".user_search_list_result", function () {
        let value = $('.user_search').val();
        searchUsers(value);

    });

    /**
     *  --------------------------------------
     * | Click action for messenger List item |
     *  --------------------------------------
    */
    $("body").on('click', '.messenger-list-item', function () {
        const dataId = $(this).attr('data-id');
        
        updateSelectedContent(dataId);

        setMessengerId(dataId);
        Idinfo(dataId);
        messageFormReset();
    });

    /**
     *  --------------
     * | Send Message |
     *  --------------
    */
    messageForm.on('submit', function (e) {
        e.preventDefault();
        sendMessage();
    });

    const composerEnterHandler = function (e) {
        if (!shouldSendFromComposer(e)) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        sendMessage();
    };

    messageInput.on('keydown', composerEnterHandler);
    $('body').on('keydown', '.emojionearea-editor', composerEnterHandler);

    /**
     *  -------------------------------
     * | Send Attachment From Message |
     *  -------------------------------
    */
    $(".attachment-input").change(function () {
        renderAttachmentPreview();

    });

    voiceRecordToggle.on('click', function (e) {
        e.preventDefault();
        startVoiceRecording();
    });

    /**
     *  ---------------------------------
     * | cancels the attachemnt and form |
     * | resets the form.                |
     *  ---------------------------------
    */
    $(".cancel-attachment").click(function () {
        messageFormReset();

    });

    /** 
     *   ----------------------------
     *  | Message Pagination method  |
     *   ----------------------------
    */
    actionOnScroll(".wsus__chat_area_body", function () {

        fetchMessages(getMessengerId());

    }, true);

    /** 
     *   -----------------------------
     *  | Contacts Pagination method. | 
     *   -----------------------------
    */
    actionOnScroll(".messenger-contacts", function () {

       getContacts();

    });

    /** 
     *   -----------------------------
     *  | Add remove user favorite.   | 
     *   -----------------------------
    */
    $(".favourite").on("click", function(e){
       e.preventDefault();
       star(getMessengerId());
    });

    /** 
     *   ------------------------------------------
     *  | Delete the selected message ,of the user |
     *  | (One message at a time).                 | 
     *   ------------------------------------------
    */
   $("body").on("click", '.dlt-message', function(e){
        e.preventDefault();
        let msg_id = $(this).data('msgid');
        deleteMessage(msg_id);
   });

    /**
     *  --------------------------
     * | Custom Height adjustment |
     *  --------------------------
    */
    function adjustHeight() 
    {
        var windowHeight = $(window).height();
        $('.wsus__chat_area_body').css('height', (windowHeight-120) + 'px');
        $('.messenger-contacts').css('max-height', (windowHeight - 393) + 'px');
        $('.wsus__chat_info_gallery').css('height', (windowHeight - 400) + 'px');
        $('.user_search_list_result').css({
            'height': (windowHeight - 130) + 'px',
        }); 
    }

    /**
     *  -----------------------------
     * | Window load event listener. |
     *  -----------------------------
    */
    adjustHeight();

    /** 
     *  --------------------------------
     * | Window resize event listener.  |
     *  --------------------------------
    */
    $(window).resize(function () {
        adjustHeight();
    });

});//End Method
