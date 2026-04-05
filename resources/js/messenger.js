/**
 *  ------------------
 * | Global Variables |
 *  ------------------
*/
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
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
var voiceRecordingTimer = null;
var voiceRecordingStartedAt = null;
var voiceRecordingLimitReached = false;
var voiceRecordingDurationSeconds = 0;
var voiceRecordingDiscardRequested = false;
var messageSending = false;
var attachmentPreviewUrls = [];
var composerReplyTarget = null;
var typingIndicatorTimer = null;
var typingPingTimer = null;
var typingIndicatorHideTimer = null;
var activeTypingUsers = new Map();
var knownGroupConversationKeys = new Set();
var composerEmojiPicker = null;
var composerEmojiPickerVisible = false;
var activeUsersMap = new Map();

const VOICE_RECORDING_MAX_SECONDS = 120;
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const DEFAULT_CHAT_THEME = {
    primary: '#2180f3',
    light: '#ecf5ff',
};
const CHAT_THEME_MAP_STORAGE_KEY = 'messenger.theme.map';
const LAST_CONVERSATION_STORAGE_KEY = 'msg_last_conversation';
const MESSENGER_TAB_STORAGE_KEY = 'messenger.ui.tab';
const MESSENGER_INFO_STORAGE_KEY = 'messenger.ui.info_open';
const MESSENGER_DARKMODE_STORAGE_KEY = 'messenger.ui.darkmode';
const COMPOSER_EMOJI_SHORTCUTS = [
    { pattern: /(^|\s):\)(?=\s|$)/g, replacement: '$1😊' },
    { pattern: /(^|\s):\((?=\s|$)/g, replacement: '$1😢' },
    { pattern: /(^|\s);\)(?=\s|$)/g, replacement: '$1😉' },
    { pattern: /(^|\s):D(?=\s|$)/g, replacement: '$1😄' },
    { pattern: /(^|\s):P(?=\s|$)/gi, replacement: '$1😛' },
    { pattern: /(^|\s):\|(?=\s|$)/g, replacement: '$1😐' },
    { pattern: /(^|\s):O(?=\s|$)/gi, replacement: '$1😮' },
    { pattern: /(^|\s):'\((?=\s|$)/g, replacement: '$1😭' },
    { pattern: /(^|\s)B\)(?=\s|$)/g, replacement: '$1😎' },
    { pattern: /(^|\s)>\:\((?=\s|$)/g, replacement: '$1😠' },
    { pattern: /(^|\s):\*(?=\s|$)/g, replacement: '$1😘' },
    { pattern: /(^|\s)<3(?=\s|$)/g, replacement: '$1❤️' },
    { pattern: /(^|\s)\^_\^(?=\s|$)/g, replacement: '$1😊' },
    { pattern: /(^|\s)-_-(?=\s|$)/g, replacement: '$1😑' },
    { pattern: /(^|\s)o_O(?=\s|$)/g, replacement: '$1🤨' },
    { pattern: /(^|\s):3(?=\s|$)/g, replacement: '$1🥺' },
];

const messageForm             = $(".message-form"),
      messageInput            = $(".message-input"),
      messageBoxContainer     = $(".wsus__chat_area_body"),
      csrf_token              = $("meta[name=csrf_token]").attr("content"),
      auth_id                 = $("meta[name=auth_id]").attr("content"),
      assetUrl                = $("meta[name=asset-url]").attr("content") || `${window.location.origin}/`,
      messengerContactBox     = $(".messenger-contacts"),
      messengerGroupBox       = $(".messenger-groups"),
      messengerActiveBox      = $(".messenger-active-users"),
      messengerApp            = $(".wsus__chat_app"),
      composerShell           = $(".footer_message"),
      attachmentInput         = $(".attachment-input"),
      attachmentPreviewBlock  = $(".attachment-block"),
      attachmentPreviewList   = $(".attachment-preview-list"),
      voicePreview            = $(".voice-preview"),
      composerReplyPreview    = $(".composer-reply-preview"),
      composerReplyLabel      = $(".composer-reply-preview__label"),
      composerReplyText       = $(".composer-reply-preview__text"),
      composerRecordingRow    = $(".composer-recording-row"),
      voiceRecordCancel       = $(".voice-record-cancel"),
      voiceRecordToggle       = $(".voice-record-toggle"),
      voiceRecordStatus       = $(".voice-record-status"),
      voiceRecordToggleIcon   = $(".voice-record-toggle i"),
      emojiTriggerButton      = $(".composer-emoji-trigger"),
      composerEmojiPopover    = $("[data-composer-emoji-popover]"),
      typingIndicatorLabel    = $(".messenger-typing-indicator"),
      createGroupForm         = $(".create-group-form"),
      smartReplyChips         = $("#smart-reply-chips"),
      toneDot                 = $("#tone-dot"),
      conversationSearchPanel = $(".conversation-search-panel"),
      conversationSearchInput = $(".conversation-search-input"),
      conversationSearchResults = $(".conversation-search-results"),
      conversationDisappearOptions = $(".conversation-disappear-option"),
      themeSwatches           = $("[data-chat-theme-color]"),
      darkModeToggle          = $("[data-darkmode-toggle]"),
      messengerTabButtons     = $(".msg-tab"),
      messengerTabPanes       = $(".msg-tab-pane"),
      groupsUnreadBadge       = $("#groups-unread-badge"),
      activeUsersBadge        = $("#active-users-badge");

const getMessengerId          = () => {
    const conversationKey = getConversationKey();

    if (conversationKey.startsWith('user:')) {
        return Number(conversationKey.split(':')[1] || 0);
    }

    return Number($("meta[name=id]").attr("content") || 0);
};
const setMessengerId          = (id) => $("meta[name=id]").attr("content", id ? String(id) : '');
const getConversationKey      = () => $("meta[name=conversation-key]").attr("content") || '';
const setConversationKey      = (key) => $("meta[name=conversation-key]").attr("content", key || '');
const getConversationType     = () => getConversationKey().startsWith('group:') ? 'group' : 'user';
const getActiveGroupId        = () => {
    const conversationKey = getConversationKey();

    return conversationKey.startsWith('group:') ? Number(conversationKey.split(':')[1] || 0) : 0;
};

window.messengerPresence = window.messengerPresence || {
    ready: false,
    activeUserIds: [],
    isUserOnline() {
        return false;
    },
};

function buildConversationPayload(conversationKey = getConversationKey())
{
    if (!conversationKey) {
        return {
            id: getMessengerId(),
        };
    }

    if (/^user:\d+$/.test(conversationKey)) {
        return {
            conversation_key: conversationKey,
            id: Number(conversationKey.split(':')[1] || 0),
        };
    }

    return {
        conversation_key: conversationKey,
    };
}

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
    const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return [hours, String(minutes).padStart(2, '0'), String(remainingSeconds).padStart(2, '0')].join(':');
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function hexToRgbString(hexColor)
{
    const normalized = String(hexColor || '').trim().replace('#', '');

    if (!/^[\da-f]{6}$/i.test(normalized)) {
        return '';
    }

    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
    ].join(', ');
}

function setDocumentThemeColor(color)
{
    const fallbackColor = $('body').hasClass('dark-mode') ? '#0f172a' : DEFAULT_CHAT_THEME.primary;

    $('meta[name=theme-color]').attr('content', color || fallbackColor);
}

function readThemeMap()
{
    try {
        const parsed = JSON.parse(window.localStorage.getItem(CHAT_THEME_MAP_STORAGE_KEY) || '{}');

        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function writeThemeMap(themeMap = {})
{
    try {
        window.localStorage.setItem(CHAT_THEME_MAP_STORAGE_KEY, JSON.stringify(themeMap));
    } catch (error) {
        // Ignore storage failures and still apply the theme in-memory.
    }
}

function normalizeThemePayload(theme = {})
{
    const primary = String(theme?.primary || DEFAULT_CHAT_THEME.primary).trim() || DEFAULT_CHAT_THEME.primary;
    const light = String(theme?.light || DEFAULT_CHAT_THEME.light).trim() || DEFAULT_CHAT_THEME.light;

    return {
        primary,
        light,
    };
}

function cacheChatTheme(conversationKey = '', theme = {})
{
    const safeConversationKey = String(conversationKey || '').trim();

    if (!safeConversationKey) {
        return normalizeThemePayload(theme);
    }

    const normalizedTheme = normalizeThemePayload(theme);
    const themeMap = readThemeMap();

    themeMap[safeConversationKey] = normalizedTheme;
    writeThemeMap(themeMap);

    return normalizedTheme;
}

function themeForConversation(conversationKey = '')
{
    const safeConversationKey = String(conversationKey || '').trim();
    const themeMap = readThemeMap();
    const storedTheme = safeConversationKey ? themeMap[safeConversationKey] : null;

    return normalizeThemePayload(storedTheme || {});
}

function applyChatTheme(primaryColor = DEFAULT_CHAT_THEME.primary, lightColor = DEFAULT_CHAT_THEME.light)
{
    const rgbValue = hexToRgbString(primaryColor) || '33, 128, 243';

    document.documentElement.style.setProperty('--colorPrimary', primaryColor);
    document.documentElement.style.setProperty('--colorLightBg', lightColor);
    document.documentElement.style.setProperty('--colorPrimaryRgb', rgbValue);
    setDocumentThemeColor(primaryColor);

    themeSwatches.removeClass('is-active');
    themeSwatches.filter(`[data-chat-theme-color="${primaryColor}"]`).addClass('is-active');
}

function applyThemeForConversation(conversationKey = '')
{
    const theme = themeForConversation(conversationKey);
    applyChatTheme(theme.primary, theme.light);
}

function loadStoredChatTheme()
{
    applyThemeForConversation(getConversationKey());
}

function saveChatTheme(primaryColor, lightColor, conversationKey = getConversationKey())
{
    const normalizedTheme = cacheChatTheme(conversationKey, {
        primary: primaryColor,
        light: lightColor,
    });

    applyChatTheme(normalizedTheme.primary, normalizedTheme.light);
}

function applyConversationThemePayload(conversationKey = '', theme = {}, { apply = false } = {})
{
    const normalizedTheme = cacheChatTheme(conversationKey, theme);

    if (apply || String(conversationKey || '').trim() === getConversationKey()) {
        applyChatTheme(normalizedTheme.primary, normalizedTheme.light);
    }

    return normalizedTheme;
}

function setDarkMode(enabled = false)
{
    $('body').toggleClass('dark-mode', !!enabled);
    darkModeToggle.toggleClass('is-active', !!enabled);
    darkModeToggle.attr('aria-pressed', enabled ? 'true' : 'false');
    darkModeToggle.find('span').text(enabled ? 'Light Mode' : 'Dark Mode');
    darkModeToggle.find('i')
        .toggleClass('fa-moon', !enabled)
        .toggleClass('fa-sun', enabled);

    try {
        window.localStorage.setItem(MESSENGER_DARKMODE_STORAGE_KEY, enabled ? '1' : '0');
    } catch (error) {
        // Ignore storage failures and keep the state in-memory.
    }

    composerEmojiPicker = null;
    composerEmojiPopover.empty();
    setDocumentThemeColor(String(document.documentElement.style.getPropertyValue('--colorPrimary')).trim() || DEFAULT_CHAT_THEME.primary);
}

function loadDarkModePreference()
{
    try {
        window.localStorage.removeItem(MESSENGER_DARKMODE_STORAGE_KEY);
    } catch (error) {
        // Ignore storage failures and keep the messenger in the default theme.
    }

    setDarkMode(false);
}

function persistActiveConversation(conversationKey, options = {})
{
    if (!conversationKey) {
        return;
    }

    try {
        window.localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, JSON.stringify({
            key: conversationKey,
            type: options.type || (conversationKey.startsWith('group:') ? 'group' : 'user'),
            userId: Number(options.userId || 0),
            groupId: Number(options.groupId || 0),
        }));
    } catch (error) {
        // Ignore storage failures and keep the active chat in memory.
    }
}

function readStoredConversation()
{
    try {
        const raw = window.localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        const conversationKey = String(parsed?.key || '').trim();

        if (!/^(user|group):\d+$/.test(conversationKey)) {
            return null;
        }

        return {
            key: conversationKey,
            type: String(parsed?.type || (conversationKey.startsWith('group:') ? 'group' : 'user')),
            userId: Number(parsed?.userId || 0),
            groupId: Number(parsed?.groupId || 0),
        };
    } catch (error) {
        return null;
    }
}

function switchMessengerTab(tabName = 'dms')
{
    const safeTab = ['dms', 'groups', 'active'].includes(tabName) ? tabName : 'dms';

    messengerTabButtons.removeClass('active');
    messengerTabButtons.filter(`[data-tab="${safeTab}"]`).addClass('active');

    messengerTabPanes.removeClass('active');
    $(`#tab-${safeTab}`).addClass('active');

    try {
        window.localStorage.setItem(MESSENGER_TAB_STORAGE_KEY, safeTab);
    } catch (error) {
        // Ignore storage failures and keep the selected tab in memory.
    }
}

function restoreMessengerTab()
{
    try {
        switchMessengerTab(window.localStorage.getItem(MESSENGER_TAB_STORAGE_KEY) || 'dms');
    } catch (error) {
        switchMessengerTab('dms');
    }
}

function setInfoPanelState(open = true)
{
    messengerApp.toggleClass('show_info', !!open);

    try {
        window.localStorage.setItem(MESSENGER_INFO_STORAGE_KEY, open ? '1' : '0');
    } catch (error) {
        // Ignore storage failures.
    }
}

function restoreInfoPanelState()
{
    try {
        const shouldShowInfo = window.localStorage.getItem(MESSENGER_INFO_STORAGE_KEY);

        if (shouldShowInfo === null) {
            return;
        }

        messengerApp.toggleClass('show_info', shouldShowInfo === '1');
    } catch (error) {
        // Ignore storage failures and keep the template default.
    }
}

function updateSidebarBadges({ groupUnread = null, activeCount = null } = {})
{
    if (groupUnread !== null && groupsUnreadBadge.length) {
        groupsUnreadBadge.text(groupUnread > 99 ? '99+' : String(groupUnread));
        groupsUnreadBadge.css('display', groupUnread > 0 ? 'inline-flex' : 'none');
    }

    if (activeCount !== null && activeUsersBadge.length) {
        activeUsersBadge.text(activeCount > 99 ? '99+' : String(activeCount));
        activeUsersBadge.css('display', activeCount > 0 ? 'inline-flex' : 'none');
    }
}

function isCurrentUser(userId)
{
    return Number(userId) === Number(auth_id);
}

function countOnlineGroupMembers(memberIds = [])
{
    return memberIds.filter((id) => !isCurrentUser(id) && activeUsersMap.has(Number(id))).length;
}

function syncPresenceGlobals()
{
    const onlineIds = Array.from(new Set(
        activeUsersIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0 && !isCurrentUser(id))
    ));

    window.messengerPresence = {
        ready: true,
        activeUserIds: onlineIds,
        isUserOnline(userId) {
            const safeUserId = Number(userId || 0);

            return safeUserId > 0 && !isCurrentUser(safeUserId) && onlineIds.includes(safeUserId);
        },
    };
}

function refreshGroupOnlineState()
{
    messengerGroupBox.find('.group-card').each(function () {
        const memberIds = String($(this).data('memberIds') || '')
            .split(',')
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0);
        const onlineCount = countOnlineGroupMembers(memberIds);

        $(this).find('.group-online-count').text(`${onlineCount} active`);
        $(this).find('.group-card__status-dot').toggleClass('d-none', onlineCount < 1);
    });
}

function refreshSidebarBadgeCountsFromDom()
{
    const groupUnread = messengerGroupBox.find('.group-card__badge').toArray().reduce((sum, badge) => {
        return sum + Number($(badge).text() || 0);
    }, 0);

    updateSidebarBadges({
        groupUnread,
        activeCount: activeUsersMap.size,
    });
}

function renderActiveUsers(users = [])
{
    if (!messengerActiveBox.length) {
        return;
    }

    const visibleUsers = users.filter((user) => !isCurrentUser(user?.id));

    if (!visibleUsers.length) {
        messengerActiveBox.html("<p class='text text-muted text-center mt-5 no_active_contact'>No one is online right now.</p>");
        updateSidebarBadges({ activeCount: 0 });
        return;
    }

    messengerActiveBox.html(visibleUsers.map((user) => `
        <div class="active-user-item" data-user-id="${user.id}">
            <div class="avatar-wrap">
                <img src="${resolveAssetUrl(user.avatar || 'default/avatar.png')}" class="user-avatar" alt="${escapeHtml(user.name || 'User')}">
                <span class="online-badge"></span>
            </div>
            <div class="user-meta">
                <span class="user-name">${escapeHtml(user.name || 'User')}</span>
                <span class="user-handle text-muted">${escapeHtml(user.user_name || '')}</span>
            </div>
            <div class="user-quick-actions">
                <button type="button" class="btn-icon quick-chat" data-user-id="${user.id}" title="Chat">
                    <i class="far fa-comment-dots"></i>
                </button>
                <button type="button" class="btn-icon quick-call" data-user-id="${user.id}" data-call-type="audio" title="Call">
                    <i class="fas fa-phone"></i>
                </button>
                <button type="button" class="btn-icon quick-video" data-user-id="${user.id}" data-call-type="video" title="Video">
                    <i class="fas fa-video"></i>
                </button>
            </div>
        </div>
    `).join(''));

    updateSidebarBadges({ activeCount: visibleUsers.length });
}

function upsertActiveUser(user)
{
    if (!user?.id || isCurrentUser(user.id)) {
        return;
    }

    activeUsersMap.set(Number(user.id), {
        id: Number(user.id),
        name: user.name || 'User',
        avatar: user.avatar || 'default/avatar.png',
        user_name: user.user_name || '',
    });

    renderActiveUsers(Array.from(activeUsersMap.values()));
    refreshGroupOnlineState();
    refreshSidebarBadgeCountsFromDom();
}

function removeActiveUser(userId)
{
    if (isCurrentUser(userId)) {
        return;
    }

    activeUsersMap.delete(Number(userId));
    renderActiveUsers(Array.from(activeUsersMap.values()));
    refreshGroupOnlineState();
    refreshSidebarBadgeCountsFromDom();
}

function formatVoiceRecordingLabel(elapsedSeconds)
{
    const safeElapsed = Math.max(0, Math.min(Number(elapsedSeconds || 0), VOICE_RECORDING_MAX_SECONDS));

    return `${formatDurationSeconds(safeElapsed)} / ${formatDurationSeconds(VOICE_RECORDING_MAX_SECONDS)}`;
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

function normalizeComposerEmojiShortcuts(value = '')
{
    return COMPOSER_EMOJI_SHORTCUTS.reduce((nextValue, shortcut) => {
        return nextValue.replace(shortcut.pattern, shortcut.replacement);
    }, String(value || ''));
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

function maybeApplyComposerEmojiShortcuts()
{
    const currentValue = getComposerText();
    const normalizedValue = normalizeComposerEmojiShortcuts(currentValue);

    if (normalizedValue !== currentValue) {
        setComposerText(normalizedValue);
    }

    return normalizedValue;
}

function normalizeDisplayEmojiShortcuts(value = '')
{
    return normalizeComposerEmojiShortcuts(value);
}

function detectLanguageBadge(messageLike = {})
{
    const storedLanguage = String(messageLike?.meta?.language || '').trim();
    const text = String(messageLike?.body || '').toLowerCase();

    if (storedLanguage === 'ne') {
        return '🇳🇵';
    }

    if (storedLanguage === 'hi') {
        return '🇮🇳';
    }

    const nepaliWords = ['dai', 'didi', 'hajur', 'tapai', 'kasari', 'kasto', 'ramro', 'thik', 'cha', 'haina', 'xaina', 'ho', 'bhayo'];
    const hindiWords = ['kya', 'hai', 'nahi', 'aur', 'mera', 'tera', 'haan', 'toh', 'bhi', 'karo', 'kuch'];
    const nepaliScore = nepaliWords.filter((word) => text.includes(word)).length;
    const hindiScore = hindiWords.filter((word) => text.includes(word)).length;

    if (nepaliScore >= 2) {
        return '🇳🇵';
    }

    if (hindiScore >= 2) {
        return '🇮🇳';
    }

    return '';
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

function resolveCallTitle(messageLike = {}, viewerId = auth_id)
{
    const meta = messageLike?.meta || {};
    const status = String(meta.status || 'ended');
    const callType = callTypeLabel(meta.call_type || 'video');
    const isOutgoing = Number(messageLike?.from_id || 0) === Number(viewerId);

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

function toggleComposerState(className, active = false)
{
    composerShell.toggleClass(className, !!active);
}

function composerHasPendingMedia()
{
    return (attachmentInput[0]?.files?.length || 0) > 0
        || !!voiceRecordingBlob
        || !!voiceRecordingActive;
}

function composerHasDraft()
{
    return getComposerText().trim().length > 0 || composerHasPendingMedia() || !!composerReplyTarget;
}

function refreshComposerSurfaceState()
{
    toggleComposerState('has-draft', composerHasDraft());
    window.requestAnimationFrame(() => {
        adjustMessengerLayout();
    });
}

function setComposerFocusState(active = false)
{
    toggleComposerState('is-focused', !!active);
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

function focusComposer()
{
    const editor = $('.emojionearea-editor').get(0);

    if (editor && typeof editor.focus === 'function') {
        editor.focus();
        return;
    }

    messageInput.trigger('focus');
}

function ensureComposerEmojiPicker()
{
    if (!composerEmojiPopover.length || composerEmojiPicker) {
        return composerEmojiPicker;
    }

    composerEmojiPicker = new Picker({
        data,
        theme: $('body').hasClass('dark-mode') ? 'dark' : 'light',
        previewPosition: 'none',
        skinTonePosition: 'none',
        navPosition: 'bottom',
        maxFrequentRows: 1,
        set: 'native',
        onEmojiSelect: (emoji) => {
            insertEmojiIntoComposer(emoji?.native || '');
            toggleComposerEmojiPopover(false);
        },
    });

    composerEmojiPopover.empty().append(composerEmojiPicker);

    return composerEmojiPicker;
}

function positionComposerEmojiPopover()
{
    if (!composerEmojiPopover.length) {
        return;
    }

    if (window.innerWidth >= 768) {
        composerEmojiPopover.css({
            '--composer-emoji-bottom': 'calc(100% + 12px)',
        });

        return;
    }

    const visualHeight = window.visualViewport?.height || window.innerHeight;
    const visualOffsetTop = window.visualViewport?.offsetTop || 0;
    const keyboardInset = Math.max(0, window.innerHeight - visualHeight - visualOffsetTop);

    composerEmojiPopover.css({
        '--composer-emoji-bottom': `${Math.max(keyboardInset + 94, 94)}px`,
    });
}

function toggleComposerEmojiPopover(forceState = null)
{
    if (!composerEmojiPopover.length) {
        return;
    }

    const shouldShow = forceState === null
        ? !composerEmojiPickerVisible
        : !!forceState;

    composerEmojiPickerVisible = shouldShow;

    if (shouldShow) {
        ensureComposerEmojiPicker();
        positionComposerEmojiPopover();
    }

    composerEmojiPopover.toggleClass('d-none', !shouldShow);
}

function insertEmojiIntoComposer(emoji)
{
    if (!emoji) {
        return;
    }

    const currentValue = getComposerText();
    const nextValue = normalizeComposerEmojiShortcuts(`${currentValue}${emoji}`);

    setComposerText(nextValue);
    queueTypingIndicator();
    refreshComposerSurfaceState();
    focusComposer();
}

function renderTypingIndicator()
{
    if (!typingIndicatorLabel.length) {
        return;
    }

    const typers = Array.from(activeTypingUsers.values());

    if (!typers.length) {
        typingIndicatorLabel.addClass('d-none').removeAttr('data-visible').empty();
        return;
    }

    let label = `${typers[0].name} is typing`;

    if (typers.length === 2) {
        label = `${typers[0].name} and ${typers[1].name} are typing`;
    } else if (typers.length > 2) {
        label = `${typers[0].name}, ${typers[1].name} +${typers.length - 2} more are typing`;
    }

    typingIndicatorLabel.html(`
        <span class="typing-indicator-bubble">
            <span class="typing-indicator-label">${escapeHtml(label)}</span>
            <span class="typing-indicator-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
            </span>
        </span>
    `).removeClass('d-none').attr('data-visible', 'true');
}

function showTypingIndicator(name = 'Someone', userId = null)
{
    if (!typingIndicatorLabel.length) {
        return;
    }

    const safeUserId = Number(userId || 0);
    const typingKey = safeUserId > 0 ? safeUserId : String(name || 'Someone');
    const existingEntry = activeTypingUsers.get(typingKey);

    if (existingEntry?.timer) {
        window.clearTimeout(existingEntry.timer);
    }

    const timer = window.setTimeout(() => {
        activeTypingUsers.delete(typingKey);
        renderTypingIndicator();
    }, 2600);

    activeTypingUsers.set(typingKey, {
        name: String(name || 'Someone'),
        timer,
    });
    renderTypingIndicator();
}

function hideTypingIndicator(userId = null)
{
    if (!typingIndicatorLabel.length) {
        return;
    }

    if (userId !== null && userId !== undefined) {
        const safeUserId = Number(userId || 0);
        const typingKey = safeUserId > 0 ? safeUserId : String(userId);
        const entry = activeTypingUsers.get(typingKey);

        if (entry?.timer) {
            window.clearTimeout(entry.timer);
        }

        activeTypingUsers.delete(typingKey);
        renderTypingIndicator();
        return;
    }

    activeTypingUsers.forEach((entry) => {
        if (entry?.timer) {
            window.clearTimeout(entry.timer);
        }
    });
    activeTypingUsers.clear();
    typingIndicatorLabel.addClass('d-none').removeAttr('data-visible').empty();
}

function applySeenState(conversationKey, lastSeenMessageId)
{
    const safeConversationKey = String(conversationKey || '').trim();
    const safeLastSeenId = Number(lastSeenMessageId || 0);

    if (!safeConversationKey || safeConversationKey !== getConversationKey() || safeLastSeenId <= 0) {
        return;
    }

    messageBoxContainer.find('.message-card').each(function () {
        const messageId = Number($(this).data('id') || 0);

        if (messageId > 0 && messageId <= safeLastSeenId) {
            $(this)
                .find('.wsus__single_chat.chat_right .time.message-time--outgoing')
                .addClass('message-time--seen');
        }
    });
}

function hideSmartReplies()
{
    smartReplyChips.empty().addClass('d-none');
}

function loadSmartReplies(messageText = '')
{
    const text = String(messageText || '').trim();

    if (!text.length || !smartReplyChips.length) {
        hideSmartReplies();
        return;
    }

    $.ajax({
        method: 'POST',
        url: route('messenger.smart-reply'),
        data: {
            _token: csrf_token,
            text,
        },
        success: function ({ suggestions = [] }) {
            if (!Array.isArray(suggestions) || suggestions.length === 0) {
                hideSmartReplies();
                return;
            }

            smartReplyChips.html(suggestions.map((suggestion) => `
                <button type="button" class="smart-reply-chip">${escapeHtml(suggestion)}</button>
            `).join('')).removeClass('d-none');
        },
        error: function () {
            hideSmartReplies();
        }
    });
}

function setToneIndicator(tone = '')
{
    toneDot.attr('data-tone', tone || '');
}

function refreshMessageTone()
{
    const text = maybeApplyComposerEmojiShortcuts().trim();

    if (!text.length) {
        setToneIndicator('');
        return;
    }

    window.clearTimeout(refreshMessageTone.timer);
    refreshMessageTone.timer = window.setTimeout(() => {
        $.ajax({
            method: 'POST',
            url: route('messenger.message-tone'),
            data: {
                _token: csrf_token,
                text,
            },
            success: function ({ tone = '' }) {
                setToneIndicator(tone);
            },
            error: function () {
                setToneIndicator('');
            }
        });
    }, 320);
}

function setDisappearingState(value = 'off')
{
    const safeValue = ['off', '24h', '7d'].includes(value) ? value : 'off';

    conversationDisappearOptions.removeClass('active');
    conversationDisappearOptions.filter(`[data-disappear-after="${safeValue}"]`).addClass('active');
    $('.conversation-disappear-toggle').toggleClass('is-active', safeValue !== 'off');
}

function searchConversation(query = '')
{
    const safeQuery = String(query || '').trim();
    const conversationKey = getConversationKey();

    if (!safeQuery.length || !conversationKey) {
        conversationSearchResults.empty().addClass('d-none');
        return;
    }

    $.ajax({
        method: 'POST',
        url: route('messenger.conversation-search'),
        data: {
            _token: csrf_token,
            conversation_key: conversationKey,
            q: safeQuery,
        },
        success: function ({ results = [] }) {
            if (!Array.isArray(results) || results.length === 0) {
                conversationSearchResults.html("<p class='conversation-search-empty'>No matches yet.</p>").removeClass('d-none');
                return;
            }

            conversationSearchResults.html(results.map((result) => `
                <button type="button" class="conversation-search-result" data-message-id="${result.id}">
                    <span class="conversation-search-result__preview">${result.preview || ''}</span>
                    <span class="conversation-search-result__time">${escapeHtml(formatTimestampLabel(result.created_at))}</span>
                </button>
            `).join('')).removeClass('d-none');
        },
        error: function () {
            conversationSearchResults.html("<p class='conversation-search-empty'>Search is unavailable right now.</p>").removeClass('d-none');
        }
    });
}

function sendTypingState(active = true)
{
    const conversationKey = getConversationKey();

    if (!conversationKey) {
        return;
    }

    $.ajax({
        method: 'POST',
        url: route('messenger.typing'),
        data: {
            _token: csrf_token,
            conversation_key: conversationKey,
            typing: active ? 1 : 0,
        },
    });
}

function queueTypingIndicator()
{
    if (!getConversationKey()) {
        return;
    }

    const composerValue = getComposerText().trim();

    if (!composerValue.length) {
        window.clearTimeout(typingIndicatorTimer);
        window.clearTimeout(typingPingTimer);
        sendTypingState(false);
        return;
    }

    if (!typingPingTimer) {
        sendTypingState(true);
    }

    window.clearTimeout(typingPingTimer);
    typingPingTimer = window.setTimeout(() => {
        typingPingTimer = null;
    }, 1200);

    window.clearTimeout(typingIndicatorTimer);
    typingIndicatorTimer = window.setTimeout(() => {
        sendTypingState(false);
    }, 1600);
}

function getConversationPartnerLabel()
{
    return $('.messenger-header').find('h4').text().trim() || 'Reply';
}

function setComposerSendingState(active = false)
{
    messageSending = !!active;
    composerShell.toggleClass('is-sending', active);
    voiceRecordToggle.prop('disabled', active);
    attachmentInput.prop('disabled', active);
    messageForm.find('.message-send-button').prop('disabled', active);
    refreshComposerSurfaceState();
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

function renderVoiceRecordingStatusMarkup(elapsedSeconds = 0)
{
    const label = formatVoiceRecordingLabel(elapsedSeconds);

    return `
        <span class="voice-record-status__pulse" aria-hidden="true"></span>
        <span class="voice-record-status__label">Recording</span>
        <span class="voice-record-status__timer">${escapeHtml(label)}</span>
        <span class="voice-record-status__wave" aria-hidden="true">${renderVoiceWaveBars()}</span>
    `;
}

function normalizeReactionSummary(reactions, reactionMap = null)
{
    if (Array.isArray(reactions)) {
        return reactions.map((reaction) => ({
            emoji: reaction.emoji,
            count: Number(reaction.count || 0),
            reacted: !!reaction.reacted,
        })).filter((reaction) => reaction.emoji && reaction.count > 0);
    }

    const normalizedMap = reactionMap && typeof reactionMap === 'object'
        ? reactionMap
        : reactions && typeof reactions === 'object'
            ? reactions
            : {};

    return Object.entries(normalizedMap).map(([emoji, userIds]) => {
        const normalizedUserIds = Array.isArray(userIds)
            ? userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
            : [];

        return {
            emoji,
            count: normalizedUserIds.length,
            reacted: normalizedUserIds.includes(Number(auth_id)),
        };
    }).filter((reaction) => reaction.emoji && reaction.count > 0);
}

function resolveReplyAuthorLabel(replyPreview)
{
    if (!replyPreview) {
        return 'Reply';
    }

    if (replyPreview.sender_label) {
        return replyPreview.sender_label;
    }

    if (Number(replyPreview.from_id) === Number(auth_id)) {
        return 'You';
    }

    return replyPreview.sender_name || getConversationPartnerLabel();
}

function renderReplyPreviewMarkup(replyPreview)
{
    if (!replyPreview || !replyPreview.id) {
        return '';
    }

    return `
        <button type="button" class="message-reply-snippet" data-reply-jump="${replyPreview.id}">
            <span class="message-reply-snippet__label">${escapeHtml(resolveReplyAuthorLabel(replyPreview))}</span>
            <span class="message-reply-snippet__text">${escapeHtml(replyPreview.snippet || 'Message')}</span>
        </button>
    `;
}

function renderReactionSummaryMarkup(messageId, reactions = [])
{
    const normalizedReactions = normalizeReactionSummary(reactions);

    if (!normalizedReactions.length) {
        return '';
    }

    return `
        <div class="message-reactions" data-message-reactions data-message-id="${messageId}">
            ${normalizedReactions.map((reaction) => `
                <button
                    type="button"
                    class="message-reaction-chip ${reaction.reacted ? 'is-active' : ''}"
                    data-msgid="${messageId}"
                    data-reaction="${escapeHtml(reaction.emoji)}"
                >
                    <span>${escapeHtml(reaction.emoji)}</span>
                    <span>${reaction.count}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderLanguageBadgeMarkup(messageLike = {})
{
    const badge = detectLanguageBadge(messageLike);

    if (!badge) {
        return '';
    }

    return `<span class="message-language-badge" title="Detected language">${badge}</span>`;
}

function renderMessageActionsMarkup({ messageId, canDelete = false, canInteract = true } = {})
{
    if (!canDelete && !canInteract) {
        return '';
    }

    return `
        <div class="message-actions-stack">
            ${canInteract ? `
                <button type="button" class="message-action-button message-reply-trigger" data-msgid="${messageId}" aria-label="Reply to message">
                    <i class="fas fa-reply"></i>
                </button>
                <div class="message-reaction-picker-wrap">
                    <button type="button" class="message-action-button message-react-trigger" data-msgid="${messageId}" aria-label="React to message">
                        <i class="far fa-smile"></i>
                    </button>
                    <div class="message-reaction-picker" data-reaction-picker>
                        ${REACTION_OPTIONS.map((emoji) => `
                            <button type="button" class="message-reaction-option" data-msgid="${messageId}" data-reaction="${escapeHtml(emoji)}">
                                ${escapeHtml(emoji)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            ${canDelete ? `
                <button type="button" class="message-action-button dlt-message" data-msgid="${messageId}" aria-label="Delete message">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </div>
    `;
}

function renderCallHistoryCardMarkup(messageLike = {})
{
    const meta = messageLike?.meta || {};
    const callType = meta.call_type || 'video';
    const status = String(meta.status || 'ended');
    const isOutgoing = Number(messageLike?.from_id || 0) === Number(auth_id);
    const duration = callShowsDuration(meta)
        ? formatDurationSeconds(meta.duration_seconds || 0)
        : '';
    const callIcon = callType === 'audio' ? 'fas fa-phone' : 'fas fa-video';
    const badgeClass = resolveCallBadgeClass(status);
    const metaMarkup = duration
        ? `<span>${formatCallStatusLabel(status, isOutgoing)}</span><span>•</span><span>${duration}</span>`
        : `<span>${formatCallStatusLabel(status, isOutgoing)}</span>`;

    return `
        <div class="call_history_card ${badgeClass}">
            <div class="call_history_card__icon">
                <i class="${callIcon}"></i>
            </div>
            <div class="call_history_card__content">
                <div class="call_history_card__title">${escapeHtml(resolveCallTitle(messageLike))}</div>
                <div class="call_history_card__meta">
                    ${metaMarkup}
                </div>
            </div>
        </div>
    `;
}

function normalizeServerMessageMarkup(serverMarkup, composerSnapshot = {})
{
    const safeMarkup = String(serverMarkup || '').trim();

    if (!safeMarkup.length) {
        return '';
    }

    const parsedNodes = $.parseHTML(safeMarkup, document, true) || [];
    const wrapper = $('<div></div>').append(parsedNodes);
    const messageCard = wrapper.find('.message-card').first();

    if (!messageCard.length) {
        return safeMarkup;
    }

    const snapshotText = String(composerSnapshot?.text || '').trim();
    const hasSnapshotMedia = !!composerSnapshot?.hasAttachment || !!composerSnapshot?.hasVoiceMessage;
    const hasRenderedText = messageCard.find('.messages').filter(function () {
        return $(this).text().trim().length > 0;
    }).length > 0;
    const isCallMessage = String(messageCard.data('messageType') || '') === 'call';

    if (!hasRenderedText && snapshotText && !hasSnapshotMedia && !isCallMessage) {
        const textNode = $('<p class="messages"></p>').text(snapshotText);
        const insertionTarget = messageCard.find('.message-reactions, .message-actions-stack, .time').first();

        if (insertionTarget.length) {
            insertionTarget.before(textNode);
        } else {
            messageCard.find('.wsus__single_chat').first().append(textNode);
        }
    }

    return wrapper.html();
}

function buildCommittedTempMessageMarkup(tempMessageElement, composerSnapshot = {}, messageId = null)
{
    const tempCard = $(tempMessageElement).clone();
    const text = String(composerSnapshot?.text || '').trim();
    const chatBubble = tempCard.find('.wsus__single_chat').first();

    tempCard.attr('data-id', messageId || tempCard.data('id') || '');
    chatBubble.find('.pre_loader, .clock, .message-temp-chips').remove();

    if (text && !chatBubble.find('.messages').length) {
        chatBubble.append($('<p class="messages"></p>').text(text));
    }

    if (!chatBubble.find('.time').length) {
        chatBubble.append('<span class="time message-time--outgoing">Just now</span>');
    }

    return $('<div></div>').append(tempCard).html();
}

function renderVoicePlayerMarkup({
    source,
    mime = 'audio/webm',
    title = 'Voice note',
    subtitle = 'Tap play to listen',
    iconClass = 'fas fa-microphone',
    durationText = '',
    sizeText = '',
    variantClass = '',
} = {})
{
    const subtitleParts = [subtitle, durationText, sizeText].filter(Boolean);
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

function buildGalleryGroupId(messageId)
{
    return `gallery-${messageId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function clearAttachmentPreviewUrls()
{
    attachmentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    attachmentPreviewUrls = [];
}

function updateComposerVoiceStatus(content = '', active = false, warning = false)
{
    if (!voiceRecordStatus.length) {
        return;
    }

    if (composerRecordingRow.length) {
        const shouldShowRow = !!content || voiceRecordingActive || !!voiceRecordingBlob;
        composerRecordingRow.toggleClass('d-none', !shouldShowRow);
    }

    if (voiceRecordCancel.length) {
        voiceRecordCancel.toggleClass('d-none', !voiceRecordingActive && !voiceRecordingBlob);
    }

    voiceRecordStatus.html(content).toggleClass('d-none', !content);
    voiceRecordStatus.toggleClass('is-active', active);
    voiceRecordStatus.toggleClass('is-warning', warning);
}

function setComposerVoiceRecordingStatus(elapsedSeconds = 0)
{
    if (!voiceRecordStatus.length) {
        return;
    }

    const safeElapsed = Math.max(0, Math.min(Number(elapsedSeconds || 0), VOICE_RECORDING_MAX_SECONDS));
    const remainingSeconds = Math.max(0, VOICE_RECORDING_MAX_SECONDS - safeElapsed);

    updateComposerVoiceStatus(
        renderVoiceRecordingStatusMarkup(safeElapsed),
        true,
        remainingSeconds <= 10
    );
}

function clearVoiceRecordingTimer()
{
    if (voiceRecordingTimer) {
        window.clearInterval(voiceRecordingTimer);
        voiceRecordingTimer = null;
    }

    voiceRecordingStartedAt = null;
}

function getVoiceRecordingElapsedSeconds()
{
    if (!voiceRecordingStartedAt) {
        return 0;
    }

    return Math.max(0, Math.floor((Date.now() - voiceRecordingStartedAt) / 1000));
}

function refreshVoiceRecordingStatus()
{
    if (!voiceRecordingActive || !voiceRecordingStartedAt) {
        return;
    }

    const elapsedSeconds = Math.floor((Date.now() - voiceRecordingStartedAt) / 1000);
    setComposerVoiceRecordingStatus(elapsedSeconds);

    if (elapsedSeconds >= VOICE_RECORDING_MAX_SECONDS) {
        voiceRecordingLimitReached = true;
        stopVoiceRecording();
    }
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
    refreshComposerSurfaceState();
}

function clearComposerAttachments()
{
    clearAttachmentPreviewUrls();
    attachmentInput.val('');
    attachmentPreviewList.empty();
    attachmentPreviewBlock.addClass('d-none');
    toggleComposerState('has-attachments', false);
    refreshComposerSurfaceState();
}

function setComposerAttachmentFiles(files = [])
{
    if (!attachmentInput[0] || typeof DataTransfer === 'undefined') {
        return;
    }

    const transfer = new DataTransfer();

    files.forEach((file) => {
        if (file instanceof File) {
            transfer.items.add(file);
        }
    });

    attachmentInput[0].files = transfer.files;
    renderAttachmentPreview();
}

function clearVoiceRecordingPreview()
{
    if (voiceRecordingUrl) {
        URL.revokeObjectURL(voiceRecordingUrl);
        voiceRecordingUrl = null;
    }

    voiceRecordingBlob = null;
    voiceRecordingDurationSeconds = 0;
    voicePreview.addClass('d-none').empty();
    updateComposerVoiceStatus('', false);
    voiceRecordingDiscardRequested = false;
    toggleComposerState('has-voice-preview', false);
    refreshComposerSurfaceState();
}

function setComposerReplyTarget(replyPreview)
{
    if (!composerReplyPreview.length || !replyPreview?.id) {
        composerReplyTarget = null;
        return;
    }

    composerReplyTarget = {
        id: Number(replyPreview.id),
        sender_label: resolveReplyAuthorLabel(replyPreview),
        snippet: replyPreview.snippet || 'Message',
    };

    composerReplyLabel.text(`Replying to ${composerReplyTarget.sender_label}`);
    composerReplyText.text(composerReplyTarget.snippet);
    composerReplyPreview.removeClass('d-none');
    toggleComposerState('has-reply-preview', true);
    refreshComposerSurfaceState();
}

function clearComposerReplyTarget()
{
    composerReplyTarget = null;

    if (!composerReplyPreview.length) {
        return;
    }

    composerReplyLabel.text('Replying');
    composerReplyText.text('');
    composerReplyPreview.addClass('d-none');
    toggleComposerState('has-reply-preview', false);
    refreshComposerSurfaceState();
}

function resetVoiceRecordingState()
{
    clearVoiceRecordingTimer();

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
    voiceRecordingLimitReached = false;
    voiceRecordingDurationSeconds = 0;
    voiceRecordingDiscardRequested = false;
    toggleComposerState('is-recording', false);
    setVoiceRecordButtonState(false);
    updateComposerVoiceStatus('', false);
    refreshComposerSurfaceState();

    if (voiceRecordingStopResolver) {
        voiceRecordingStopResolver();
        voiceRecordingStopResolver = null;
    }
}

async function cancelVoiceRecording()
{
    if (voiceRecordingActive) {
        voiceRecordingDiscardRequested = true;
        await stopVoiceRecording();
    }

    clearVoiceRecordingPreview();
    resetVoiceRecordingState();
    updateComposerVoiceStatus('', false);
    focusComposer();
}

function finishComposerSend({ clearText = true } = {})
{
    clearComposerAttachments();
    clearVoiceRecordingPreview();
    clearComposerReplyTarget();
    hideSmartReplies();
    resetVoiceRecordingState();
    setComposerSendingState(false);

    if (clearText) {
        messageForm.trigger('reset');
        setComposerText('');
    }

    toggleComposerState('has-attachments', false);
    toggleComposerState('has-voice-preview', false);
    toggleComposerState('is-recording', false);
    setVoiceRecordButtonState(false);
    updateComposerVoiceStatus('', false);
    window.clearTimeout(typingIndicatorTimer);
    window.clearTimeout(typingPingTimer);
    sendTypingState(false);
    scrolllToBottom(messageBoxContainer);
    refreshComposerSurfaceState();
    focusComposer();
}

function stopVoiceRecording()
{
    return new Promise((resolve) => {
        if (!voiceRecorder || !voiceRecordingActive) {
            resolve();
            return;
        }

        clearVoiceRecordingTimer();
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
        clearVoiceRecordingTimer();
        voiceRecordingLimitReached = false;
        voiceRecordingDiscardRequested = false;
        setComposerVoiceRecordingStatus(0);
        voiceRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceRecordingChunks = [];
        voiceRecorder = new MediaRecorder(voiceRecordingStream);
        voiceRecordingActive = true;
        const recorder = voiceRecorder;
        toggleComposerState('is-recording', true);
        setVoiceRecordButtonState(true);
        voiceRecordingStartedAt = Date.now();

        voiceRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                voiceRecordingChunks.push(event.data);
            }
        };

        voiceRecorder.onstop = () => {
            const mimeType = recorder?.mimeType || 'audio/webm';
            const blob = new Blob(voiceRecordingChunks, { type: mimeType });
            const recordedSeconds = Math.max(1, getVoiceRecordingElapsedSeconds());

            if (voiceRecordingStream) {
                voiceRecordingStream.getTracks().forEach((track) => track.stop());
            }

            clearVoiceRecordingTimer();
            voiceRecordingDurationSeconds = recordedSeconds;
            voiceRecordingBlob = voiceRecordingDiscardRequested || blob.size <= 0 ? null : blob;
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
                    durationText: formatDurationSeconds(voiceRecordingDurationSeconds),
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
            voiceRecordingDiscardRequested = false;
            refreshComposerSurfaceState();

            if (voiceRecordingLimitReached) {
                notyf.info('Voice note reached the 2 minute limit and stopped automatically.');
            }
            voiceRecordingLimitReached = false;

            if (voiceRecordingStopResolver) {
                const resolver = voiceRecordingStopResolver;
                voiceRecordingStopResolver = null;
                resolver();
            }
        };

        voiceRecorder.start();
        voiceRecordingTimer = window.setInterval(refreshVoiceRecordingStatus, 1000);
        refreshVoiceRecordingStatus();
    } catch (error) {
        clearVoiceRecordingTimer();
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
    const isGroupMessage = Number(e.group_id || 0) > 0;
    const canDelete = isMine && messageType !== 'call';
    const canInteract = messageType !== 'call';
    const normalizedBodyText = normalizeDisplayEmojiShortcuts(typeof e.body === 'string' ? e.body.trim() : (e.body || ''));
    const bodyText = normalizedBodyText;
    const body = escapeHtml(bodyText);
    const messageTime = formatTimestampLabel(e.created_at);
    const replyPreview = e.reply_preview || null;
    const reactions = normalizeReactionSummary(e.reactions, e.reaction_map);
    const senderName = escapeHtml(e.from_name || 'Group member');
    const languageBadgeMarkup = renderLanguageBadgeMarkup({
        body: bodyText,
        meta: e.meta || {},
    });
    const replySnippetText = String(
        replyPreview?.snippet || bodyText || (messageType === 'voice' ? 'Voice note' : attachments.length ? 'Attachment' : 'Message')
    ).replace(/\s+/g, ' ').trim();
    const replyAttributes = canInteract
        ? `data-reply-id="${e.id}" data-reply-author="${escapeHtml(isMine ? 'You' : (isGroupMessage ? (e.from_name || 'Group member') : getConversationPartnerLabel()))}" data-reply-snippet="${escapeHtml(replySnippetText)}"`
        : '';
    const senderMarkup = isGroupMessage && !isMine && messageType !== 'call'
        ? `<span class="message-sender-label">${senderName}</span>`
        : '';

    if (messageType === 'call') {
        const duration = callShowsDuration(e?.meta || {})
            ? formatDurationSeconds(e?.meta?.duration_seconds || 0)
            : '';
        const timeSuffix = duration ? ` · ${duration}` : '';

        return `
            <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="call">
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    ${renderCallHistoryCardMarkup(e)}
                    <span class="time">${messageTime}${timeSuffix}</span>
                </div>
            </div>
        `;
    }

    const mediaMarkup = renderMessageMedia(attachments, messageType, e.id);
    const timeClasses = [
        isMine && !isGroupMessage ? 'message-time--outgoing' : '',
        isMine && !isGroupMessage && e.seen ? 'message-time--seen' : '',
    ].filter(Boolean).join(' ');

    if (messageType === 'voice') {
        const voiceAttachment = attachments[0] || null;
        const voiceUrl = voiceAttachment?.path ? resolveAssetUrl(voiceAttachment.path) : '';
        const voiceMime = voiceAttachment?.mime || 'audio/webm';
        const voiceDurationSeconds = Number(e?.meta?.duration_seconds || 0);
        const voiceDuration = voiceDurationSeconds > 0 ? formatDurationSeconds(voiceDurationSeconds) : '';
        const voiceSize = formatFileSize(voiceAttachment?.size);

        return `
            <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="voice" ${replyAttributes}>
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    ${senderMarkup}
                    ${renderReplyPreviewMarkup(replyPreview)}
                    ${languageBadgeMarkup}
                    ${renderVoicePlayerMarkup({
                        source: voiceUrl,
                        mime: voiceMime,
                        title: body || 'Voice note',
                        subtitle: 'Tap play to listen',
                        iconClass: 'fas fa-microphone',
                        durationText: voiceDuration,
                        sizeText: voiceSize || '',
                        variantClass: 'voice-note-card--message',
                    })}
                    ${renderReactionSummaryMarkup(e.id, reactions)}
                    ${renderMessageActionsMarkup({ messageId: e.id, canDelete, canInteract })}
                    <span class="time ${timeClasses}">${messageTime}</span>
                </div>
            </div>
        `;
    }

    if (attachments.length > 0) {
        return `
            <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="${messageType}" ${replyAttributes}>
                <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                    ${senderMarkup}
                    ${renderReplyPreviewMarkup(replyPreview)}
                    ${languageBadgeMarkup}
                    ${body ? `<p class="messages">${body}</p>` : ''}
                    ${mediaMarkup}
                    ${renderReactionSummaryMarkup(e.id, reactions)}
                    ${renderMessageActionsMarkup({ messageId: e.id, canDelete, canInteract })}
                    <span class="time ${timeClasses}">${messageTime}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="wsus__single_chat_area message-card" data-id="${e.id}" data-message-type="${messageType}" ${replyAttributes}>
            <div class="wsus__single_chat ${isMine ? 'chat_right' : ''}">
                ${senderMarkup}
                ${renderReplyPreviewMarkup(replyPreview)}
                ${languageBadgeMarkup}
                ${body ? `<p class="messages">${body}</p>` : ''}
                ${renderReactionSummaryMarkup(e.id, reactions)}
                ${renderMessageActionsMarkup({ messageId: e.id, canDelete, canInteract })}
                <span class="time ${timeClasses}">${messageTime}</span>
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
    if (messageSending) {
        return;
    }

    let inputValue = maybeApplyComposerEmojiShortcuts();
    let attachmentFiles = Array.from(attachmentInput[0]?.files || []);
    let hasAttachment = attachmentFiles.length > 0;
    const hasVoiceCandidate = !!voiceRecordingBlob || voiceRecordingActive;
    const conversationKey = getConversationKey();
    const directUserId = getMessengerId();

    if (inputValue.trim().length <= 0 && !hasAttachment && !hasVoiceCandidate) {
        return;
    }

    if (!conversationKey && !directUserId) {
        notyf.error('Select a conversation before sending a message.');
        return;
    }

    messageSending = true;

    try {
        if (voiceRecordingActive) {
            await stopVoiceRecording();
        }

        inputValue = maybeApplyComposerEmojiShortcuts();
        attachmentFiles = Array.from(attachmentInput[0]?.files || []);
        hasAttachment = attachmentFiles.length > 0;
        const hasVoiceMessage = !!voiceRecordingBlob;
        const composerSnapshot = {
            text: inputValue,
            hasAttachment,
            hasVoiceMessage,
        };

        if (inputValue.trim().length <= 0 && !hasAttachment && !hasVoiceMessage) {
            setComposerSendingState(false);
            messageSending = false;
            return;
        }

        temporaryMsgId += 1;
        let tempID = `temp_${temporaryMsgId}`; //temp_1, temp_2 ....
        const formData = new FormData(messageForm[0]);

        if (conversationKey) {
            formData.append('conversation_key', conversationKey);
        }

        if (directUserId) {
            formData.append("id", directUserId);
        }

        formData.set("message", inputValue);
        formData.append("temporaryMsgId", tempID);
        formData.append("_token", csrf_token);
        if (composerReplyTarget?.id) {
            formData.append('reply_to_id', String(composerReplyTarget.id));
        }

        if (hasVoiceMessage) {
            const voiceFile = new File(
                [voiceRecordingBlob],
                `voice-note-${Date.now()}.webm`,
                { type: voiceRecordingBlob.type || 'audio/webm' }
            );

            formData.append('voice_message', voiceFile, voiceFile.name);
            formData.append('voice_duration_seconds', String(Math.max(1, Number(voiceRecordingDurationSeconds || 0))));
        }

        $.ajax({
            method: "POST",
            url: route('messenger.send-message'),
            data: formData,
            dataType: "JSON",
            processData: false,
            contentType: false,
            beforeSend: function () {
                setComposerSendingState(true);
                //Add temp message on dom
                messageBoxContainer.append(sendTempMessageCard({
                    text: inputValue,
                    tempId: tempID,
                    attachments: attachmentFiles,
                    hasVoiceMessage,
                    voiceDurationSeconds: Number(voiceRecordingDurationSeconds || 0),
                }));

                $('.no_messages').addClass('d-none');

                scrolllToBottom(messageBoxContainer);
            },
            success: function (data) {
                makeSeen(true);
                //Update conatcts lists...
                updateContactItem(getConversationKey());
                const tempMsgCardElement = messageBoxContainer.find(`.message-card[data-id="${data.tempID}"]`);
                const serverMarkup = normalizeServerMessageMarkup(data.message, composerSnapshot);
                const fallbackMarkup = tempMsgCardElement.length
                    ? buildCommittedTempMessageMarkup(tempMsgCardElement, composerSnapshot, data.message_id)
                    : '';
                const finalMarkup = serverMarkup || fallbackMarkup;

                if (tempMsgCardElement.length && finalMarkup) {
                    tempMsgCardElement.before(finalMarkup);
                    tempMsgCardElement.remove();
                } else if (finalMarkup) {
                    messageBoxContainer.append(finalMarkup);
                }
                initVenobox();
                initializeVoicePlayers(messageBoxContainer[0]);
                const shouldClearText = getComposerText() === composerSnapshot.text;

                finishComposerSend({ clearText: shouldClearText });
                updateSelectedContent(getConversationKey());
                messageSending = false;
            },
            error: function (xhr, status, error) {
                const tempMsgCardElement = messageBoxContainer.find(`.message-card[data-id="${tempID}"]`);

                if (tempMsgCardElement.length) {
                    tempMsgCardElement.remove();
                }

                setComposerSendingState(false);
                updateComposerVoiceStatus('', false);
                messageSending = false;
                focusComposer();
                notyf.error('Unable to send message. Please try again.');
            }
        });
    } catch (error) {
        messageSending = false;
        setComposerSendingState(false);
        focusComposer();
        notyf.error('Unable to send message. Please try again.');
    }

}//End Method

function closeReactionPickers()
{
    $('[data-reaction-picker]').removeClass('is-open');
}

function applyReactionState(messageId, reactions)
{
    const reactionMarkup = renderReactionSummaryMarkup(messageId, reactions);
    const messageCard = messageBoxContainer.find(`.message-card[data-id="${messageId}"]`);

    if (!messageCard.length) {
        return;
    }

    const currentReactionRow = messageCard.find('[data-message-reactions]').first();

    if (reactionMarkup) {
        if (currentReactionRow.length) {
            currentReactionRow.replaceWith(reactionMarkup);
        } else {
            const actionStack = messageCard.find('.message-actions-stack').first();

            if (actionStack.length) {
                actionStack.before(reactionMarkup);
            } else {
                messageCard.find('.time').first().before(reactionMarkup);
            }
        }
    } else {
        currentReactionRow.remove();
    }
}

function toggleMessageReaction(messageId, emoji)
{
    if (!messageId || !emoji) {
        return;
    }

    $.ajax({
        method: 'POST',
        url: route('messenger.messages.react', { message: messageId }),
        data: {
            _token: csrf_token,
            emoji,
        },
        success: function (data) {
            applyReactionState(messageId, data.reactions || []);
            closeReactionPickers();
        },
        error: function () {
            notyf.error('Unable to update the reaction right now.');
        }
    });
}

function jumpToMessage(messageId)
{
    const target = messageBoxContainer.find(`.message-card[data-id="${messageId}"]`).first();

    if (!target.length) {
        return;
    }

    const nextTop = target.position().top + messageBoxContainer.scrollTop() - 24;

    messageBoxContainer.stop().animate({
        scrollTop: Math.max(0, nextTop),
    }, 220);

    messageBoxContainer.find('.message-card').removeClass('is-jumped-to');
    target.addClass('is-jumped-to');

    window.setTimeout(() => {
        target.removeClass('is-jumped-to');
    }, 1600);
}

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
                success: function(data)
                {
                    $(`.message-card[data-id="${message_id}"]`).remove();

                    if (Number(composerReplyTarget?.id || 0) === Number(message_id)) {
                        clearComposerReplyTarget();
                    }

                    notyf.success(data.message);
                    //Update conatcts lists...
                    updateContactItem(getConversationKey());
                },
                error: function(xhr, status, error){
                    notyf.error(xhr?.responseJSON?.message || 'Unable to delete this message.');
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
function sendTempMessageCard(payload, legacyTempId = '', legacyAttachment = false) 
{
    const normalizedPayload = typeof payload === 'object' && payload !== null
        ? payload
        : {
            text: payload,
            tempId: legacyTempId,
            attachments: legacyAttachment ? Array.from(attachmentInput[0]?.files || []) : [],
            hasVoiceMessage: false,
            voiceDurationSeconds: 0,
        };

    const safeMessage = escapeHtml(String(normalizedPayload.text || '').trim());
    const tempId = String(normalizedPayload.tempId || legacyTempId || `temp_${Date.now()}`);
    const attachments = Array.isArray(normalizedPayload.attachments) ? normalizedPayload.attachments : [];
    const hasVoiceMessage = !!normalizedPayload.hasVoiceMessage;
    const attachmentCount = attachments.length;
    const attachmentSummary = attachmentCount > 0
        ? `${attachmentCount} ${attachmentCount === 1 ? formatAttachmentTypeLabel(guessAttachmentTypeFromFile(attachments[0])) : 'attachments'}`
        : '';
    const voiceSummary = hasVoiceMessage
        ? `Voice note${normalizedPayload.voiceDurationSeconds ? ` · ${formatDurationSeconds(normalizedPayload.voiceDurationSeconds)}` : ''}`
        : '';
    const summaryChips = [voiceSummary, attachmentSummary].filter(Boolean).map((label) => `
        <span class="message-temp-chip">${escapeHtml(label)}</span>
    `).join('');

    return `
        <div class="wsus__single_chat_area message-card" data-id="${tempId}">
            <div class="wsus__single_chat chat_right">
                <div class="pre_loader">
                    <div class="spinner-border text-light" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
                ${safeMessage ? `<p class="messages">${safeMessage}</p>` : ''}
                ${summaryChips ? `<div class="message-temp-chips">${summaryChips}</div>` : ''}
                <span class="clock"><i class="fas fa-clock"></i> sending</span>
            </div>
        </div>
    `;

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
    clearComposerReplyTarget();
    hideSmartReplies();
    resetVoiceRecordingState();
    toggleComposerState('has-attachments', false);
    toggleComposerState('has-voice-preview', false);
    toggleComposerState('is-recording', false);
    setVoiceRecordButtonState(false);
    updateComposerVoiceStatus('', false);
    window.clearTimeout(typingIndicatorTimer);
    window.clearTimeout(typingPingTimer);
    sendTypingState(false);
    messageForm.trigger("reset");
    setComposerText('');
    toggleComposerEmojiPopover(false);
    setToneIndicator('');
    refreshComposerSurfaceState();

}//End Method

function setHeaderConversationActions(type = 'user')
{
    const hasConversation = !!getConversationKey();
    const isDirect = type === 'user';
    const isSelfConversation = isDirect && Number(getMessengerId()) === Number(auth_id);
    const directConversationId = isDirect ? Number(getMessengerId()) : 0;
    const canCallDirectRecipient = !isDirect || isSelfConversation || activeUsersMap.has(directConversationId);

    $('.favourite').toggleClass('d-none', !hasConversation || !isDirect || isSelfConversation);
    $('.start-call').toggleClass('d-none', !hasConversation || isSelfConversation);
    $('.start-call').toggleClass('is-disabled', hasConversation && isDirect && !isSelfConversation && !canCallDirectRecipient);
    $('.start-call').attr('aria-disabled', hasConversation && isDirect && !isSelfConversation && !canCallDirectRecipient ? 'true' : 'false');

    $('.start-call[data-call-type="audio"]').attr('title', hasConversation && isDirect && !isSelfConversation && !canCallDirectRecipient ? 'This person is offline right now' : (type === 'group' ? 'Group audio call' : 'Audio call'));
    $('.start-call[data-call-type="video"]').attr('title', hasConversation && isDirect && !isSelfConversation && !canCallDirectRecipient ? 'This person is offline right now' : (type === 'group' ? 'Group video call' : 'Video call'));
}

function renderConversationMembers(members = [])
{
    const memberList = $('.conversation-member-list');
    const memberPanel = $('.conversation-member-panel');

    if (!memberList.length || !memberPanel.length) {
        return;
    }

    if (!Array.isArray(members) || members.length === 0) {
        memberList.empty();
        memberPanel.addClass('d-none');
        return;
    }

    memberList.html(
        members.map((member) => `
            <li class="conversation-member-list__item">
                <span class="conversation-member-list__avatar">
                    <img src="${resolveAssetUrl(member.avatar || 'default/avatar.png')}" alt="${escapeHtml(member.name)}">
                </span>
                <span class="conversation-member-list__copy">
                    <strong>${escapeHtml(member.name)}</strong>
                    <span>${escapeHtml(member.user_name || '')}</span>
                </span>
            </li>
        `).join('')
    );

    memberPanel.removeClass('d-none');
}

function setActiveConversation(conversationKey, options = {})
{
    const type = options.type || (conversationKey.startsWith('group:') ? 'group' : 'user');
    const userId = type === 'user'
        ? Number(options.userId || conversationKey.split(':')[1] || 0)
        : 0;

    setConversationKey(conversationKey);
    setMessengerId(userId || '');
    persistActiveConversation(conversationKey, {
        type,
        userId,
        groupId: type === 'group' ? Number(options.groupId || conversationKey.split(':')[1] || 0) : 0,
    });
    applyThemeForConversation(conversationKey);
    switchMessengerTab(type === 'group' ? 'groups' : 'dms');
    updateSelectedContent(conversationKey);
    setHeaderConversationActions(type);
}

function openConversationFromQuery()
{
    const params = new URLSearchParams(window.location.search);
    const conversationKey = String(params.get('conversation') || '').trim();

    if (!/^(user|group):\d+$/.test(conversationKey)) {
        return;
    }

    const conversationType = conversationKey.startsWith('group:') ? 'group' : 'user';
    const userId = conversationType === 'user'
        ? Number(conversationKey.split(':')[1] || 0)
        : 0;

    setActiveConversation(conversationKey, {
        type: conversationType,
        userId,
    });
    hideTypingIndicator();
    Idinfo(conversationKey);
    messageFormReset();
}

function restoreLastConversationSelection()
{
    const params = new URLSearchParams(window.location.search);

    if (params.get('conversation')) {
        return;
    }

    const storedConversation = readStoredConversation();

    if (!storedConversation?.key) {
        return;
    }

    setActiveConversation(storedConversation.key, {
        type: storedConversation.type,
        userId: storedConversation.userId,
        groupId: storedConversation.groupId,
    });
    hideTypingIndicator();
    Idinfo(storedConversation.key);
    messageFormReset();
}

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
    const requestData = typeof id === 'string'
        ? buildConversationPayload(id)
        : buildConversationPayload();

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
                ...requestData,
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

                    const lastMessage = data?.last_message || null;
                    if (lastMessage && Number(lastMessage.from_id || 0) !== Number(auth_id) && String(lastMessage.body || '').trim().length) {
                        loadSmartReplies(lastMessage.body);
                    } else {
                        hideSmartReplies();
                    }
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
                messengerGroupBox.find(".contact-loader").remove();

                if(contactsPage < 2)
                {
                    messengerContactBox.html(data.direct_contacts || '');
                    messengerGroupBox.html(data.group_contacts || '');

                }else
                {
                    messengerContactBox.append(data.direct_contacts || '');
                    messengerGroupBox.append(data.group_contacts || '');
                }
                
                noMoreContacts =  contactsPage >= data?.last_page;
                
                if(!noMoreContacts) contactsPage ++;

                //Cheks either the user is activate on pagination or not and set active class.
                updateUserActiveList();
                updateSidebarBadges({
                    groupUnread: Number(data?.counts?.group_unread || 0),
                });
                refreshGroupOnlineState();
                refreshSidebarBadgeCountsFromDom();

                if (getConversationKey()) {
                    updateSelectedContent(getConversationKey());
                }

            },
            error: function(xhr, status, error){
                contactLoading = false;
                messengerContactBox.find(".contact-loader").remove();
                messengerGroupBox.find(".contact-loader").remove();
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
    const requestData = typeof id === 'string'
        ? buildConversationPayload(id)
        : buildConversationPayload();

    $.ajax({
        method: 'GET',
        url: route('messenger.id-info'),
        data: requestData,
        beforeSend: function () {
            NProgress.start();
            enableChatBoxLoader();
        },
        success: function (data) {
            //Fetch Messages
            fetchMessages(data.conversation_key || id, true);

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
            applyConversationThemePayload(data.conversation_key || getConversationKey(), data.theme || {}, {
                apply: true,
            });

            //Fetch Favourites and handles the favorite button
            data.favorite > 0 ? $(".favourite").addClass("active") : $(".favourite").removeClass("active");
            setHeaderConversationActions(data.type || 'user');
            setDisappearingState(String(data.disappear_after || 'off'));

            if (data.type === 'group') {
                const group = data.group || {};

                $(".messenger-header").find("img").attr("src", resolveAssetUrl(group.avatar));
                $(".messenger-header").find("h4").text(group.name || 'Group');

                $(".messenger-info-title").text('Group Details');
                $(".messenger-info-view .user_photo").find("img").attr("src", resolveAssetUrl(group.avatar));
                $(".messenger-info-view").find(".user_name").text(group.name || 'Group');
                $(".messenger-info-view").find(".user_unique_name").text(group.user_name || '');
                renderConversationMembers(data.members || []);
            } else {
                $(".messenger-header").find("img").attr("src", resolveAssetUrl(data.fetch.avatar));
                $(".messenger-header").find("h4").text(data.fetch.name);

                $(".messenger-info-title").text('User Details');
                $(".messenger-info-view .user_photo").find("img").attr("src", resolveAssetUrl(data.fetch.avatar));
                $(".messenger-info-view").find(".user_name").text(data.fetch.name);
                $(".messenger-info-view").find(".user_unique_name").text(data.fetch.user_name);
                renderConversationMembers([]);
            }
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
    const conversationPayload = typeof user_id === 'string'
        ? buildConversationPayload(user_id)
        : buildConversationPayload();

    $.ajax({
        method: 'GET',
        url : route('messenger.update-contact-item'),
        data: conversationPayload,
        success: function(data){
            messengerContactBox.find('.no_contact').remove();
            messengerGroupBox.find('.no_group_contact').remove();
            const conversationKey = data.conversation_key || conversationPayload.conversation_key || `user:${user_id}`;
            const targetBox = conversationKey.startsWith('group:') ? messengerGroupBox : messengerContactBox;
            targetBox.find(`.messenger-list-item[data-conversation-key="${conversationKey}"]`).remove();
            targetBox.prepend(data.contact_item);
            const activeUserId = Number(conversationPayload.id || 0);
            if(activeUserId > 0) {
                if(activeUsersIds.includes(activeUserId)){
                   userActive(activeUserId);
                }else{
                    userInactive(activeUserId);
                }
            }

            refreshGroupOnlineState();
            refreshSidebarBadgeCountsFromDom();

            if(conversationKey == getConversationKey()) updateSelectedContent(conversationKey);

        },
        error: function(xhr, status, error){}

    });

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
    const activeItem = $(`.messenger-list-item[data-conversation-key="${user_id}"]`);
    activeItem.addClass('active');

    const activeElement = activeItem.get(0);

    if (activeElement && typeof activeElement.scrollIntoView === 'function') {
        activeElement.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
        });
    }

}//End Method

/**
 *  ----------------------------------
 * | saves users to favoruite lists.   |
 *  ----------------------------------
*/
function star(user_id)
{
    if (getConversationType() !== 'user') {
        return;
    }

    $(".favourite").toggleClass('active');

    $.ajax({
        method: "POST",
        url: route("messenger.favorite"),
        data: {  
            _token: csrf_token,
            conversation_key: getConversationKey(),
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
    $(`.messenger-list-item[data-conversation-key="${getConversationKey()}"]`).find('.unseen_count, .group-card__badge').remove();
    refreshSidebarBadgeCountsFromDom();
    $.ajax({
        method: 'POST',
        url: route('messenger.make-seen'),
        data: {  
            _token: csrf_token,
            ...buildConversationPayload()
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
    const playPromise = sound.play();

    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
    }
}

function adjustMessengerLayout()
{
    const windowHeight = $(window).height();
    const chatAreaHeight = $('.wsus__chat_area').innerHeight() || windowHeight;
    const headerHeight = $('.wsus__chat_area_header:visible').outerHeight(true) || 0;
    const searchPanelHeight = $('.conversation-search-panel:visible').outerHeight(true) || 0;
    const footerHeight = $('.wsus__chat_area_footer:visible').outerHeight(true) || 0;
    const chatBodyHeight = Math.max(220, chatAreaHeight - headerHeight - searchPanelHeight - footerHeight);

    $('.wsus__chat_area_body').css('height', `${chatBodyHeight}px`);
    $('.messenger-contacts').css('max-height', `${Math.max(180, windowHeight - 393)}px`);
    $('.messenger-groups').css('max-height', `${Math.max(180, windowHeight - 260)}px`);
    $('.messenger-active-users').css('max-height', `${Math.max(180, windowHeight - 260)}px`);
    $('.wsus__chat_info_gallery').css('height', `${Math.max(160, windowHeight - 400)}px`);
    $('.user_search_list_result').css({
        'height': `${Math.max(220, windowHeight - 130)}px`,
    });
}

/**
 *  --------------------------------
 * | Boradcasting Listener that,    |
 * | listens to the Message channel.|
 *  --------------------------------
*/
window.Echo.private('message.' + auth_id)
    .listen("Message", (e) => {
        const conversationKey = e.conversation_key || `user:${e.from_id}`;

        if(getConversationKey() != conversationKey)
        {
            updateContactItem(conversationKey);
            playNotficationSound();
        }
    
        let message = receiveMessageCard(e);
        if(getConversationKey() == conversationKey)
        {
            messageBoxContainer.append(message);
            initializeVoicePlayers(messageBoxContainer[0]);
            scrolllToBottom(messageBoxContainer);
            makeSeen(true);
            hideTypingIndicator();
            if (Number(e.from_id || 0) !== Number(auth_id)) {
                loadSmartReplies(e.body || '');
            }
        }

});//End Method

window.Echo.private('message.' + auth_id)
    .listen("MessageReactionUpdated", (event) => {
        const reactions = normalizeReactionSummary([], event.reaction_map || {});

        applyReactionState(event.message_id, reactions);
    })
    .listen('.conversation.theme-updated', (event) => {
        const conversationKey = String(event?.conversation_key || '').trim();

        if (!conversationKey) {
            return;
        }

        applyConversationThemePayload(conversationKey, event?.theme || {}, {
            apply: conversationKey === getConversationKey(),
        });
    })
    .listen('.typing.indicator', (event) => {
        if (event.conversation_key !== getConversationKey() || Number(event.from_id) === Number(auth_id)) {
            return;
        }

        if (event.typing) {
            showTypingIndicator(event.from_name || 'Someone', event.from_id);
        } else {
            hideTypingIndicator(event.from_id);
        }
    })
    .listen('.message.seen', (event) => {
        applySeenState(event.conversation_key, event.last_seen_message_id);
    });

/** 
 *  ---------------------------------------
 *  | Listens to the User Presence Channel.|
 *  ---------------------------------------
*/
window.Echo.join('online')
    .here((users) => {
        //Set Active Users Ids
        activeUsersIds = [];
        activeUsersMap = new Map();
        setActiveUsersIds(users);
        $.each(users, function(index, user){
            let contactItem = $(`.messenger-list-item[data-user-id="${user.id}"]`).find('.img').find('span');
            contactItem.removeClass('inactive');
            contactItem.addClass('active');
            upsertActiveUser(user);

        });
        syncPresenceGlobals();
        setHeaderConversationActions(getConversationType());

}).joining((user) => {
    //Adding new user to the active users array
    addNewUserId(user.id);
    userActive(user.id);
    upsertActiveUser(user);
    syncPresenceGlobals();
    setHeaderConversationActions(getConversationType());

}).leaving((user) => {
    //Removing user from the active users array
    removeUserId(user.id);
    userInactive(user.id);
    removeActiveUser(user.id);
    syncPresenceGlobals();
    setHeaderConversationActions(getConversationType());

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
        let id = $(this).data('userId');

        if(id && !isCurrentUser(id) && activeUsersIds.includes(+id)) userActive(id);

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
    if (isCurrentUser(id)) {
        return;
    }

    let contactItem = $(`.messenger-list-item[data-user-id="${id}"]`).find('.img').find('span');
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
    if (isCurrentUser(id)) {
        return;
    }

    let contactItem = $(`.messenger-list-item[data-user-id="${id}"]`).find('.img').find('span');
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
        const numericId = Number(user.id);

        if (!isCurrentUser(numericId) && !activeUsersIds.includes(numericId)) {
            activeUsersIds.push(numericId);
        }
    });

}//End Method


/**
 *  -------------------------------
 * | Add New User id to an array   |
 *  -------------------------------
*/
function addNewUserId(id)
{
    const numericId = Number(id);

    if (!isCurrentUser(numericId) && !activeUsersIds.includes(numericId)) {
        activeUsersIds.push(numericId);
    }

}


/**
 *  -------------------------------
 * | Remove User id to an array.   |
 *  -------------------------------
*/
function removeUserId(id)
{
    if (isCurrentUser(id)) {
        return;
    }

    let index = activeUsersIds.indexOf(Number(id));

    if(index !== -1){
        activeUsersIds.splice(index, 1);
    }

}

window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) {
        return;
    }

    if (event.data?.type !== 'call_ended' || !event.data?.conversationKey) {
        return;
    }

    const conversationKey = String(event.data.conversationKey);
    const isGroup = !!event.data.isGroup;
    const conversationId = Number(event.data.conversationId || 0);

    setActiveConversation(conversationKey, {
        type: isGroup ? 'group' : 'user',
        userId: isGroup ? 0 : conversationId,
        groupId: isGroup ? conversationId : 0,
    });
    hideTypingIndicator();
    Idinfo(conversationKey);
});


/**
 *  ---------------
 * | On DOM Load   |
 *  ---------------
*/
$(document).ready(function () 
{   
    loadDarkModePreference();
    loadStoredChatTheme();
    restoreMessengerTab();
    restoreInfoPanelState();
    getContacts();;
    initializeCallManager();
    setHeaderConversationActions('group');
    hideTypingIndicator();
    openConversationFromQuery();
    restoreLastConversationSelection();
    refreshComposerSurfaceState();

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

    messengerTabButtons.on('click', function () {
        switchMessengerTab(String($(this).data('tab') || 'dms'));
    });

    darkModeToggle.on('click', function (e) {
        e.preventDefault();
        setDarkMode(!$('body').hasClass('dark-mode'));
    });

    $('.info').on('click', function () {
        window.setTimeout(() => {
            setInfoPanelState(messengerApp.hasClass('show_info'));
        }, 0);
    });

    $('.user_info_close').on('click', function () {
        window.setTimeout(() => {
            setInfoPanelState(messengerApp.hasClass('show_info'));
        }, 0);
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
        const conversationKey = String($(this).data('conversationKey') || '');
        const conversationType = String($(this).data('conversationType') || 'user');
        const userId = Number($(this).data('userId') || $(this).data('id') || 0);
        const groupId = Number($(this).data('groupId') || 0);

        setActiveConversation(conversationKey, {
            type: conversationType,
            userId,
            groupId,
        });
        hideTypingIndicator();
        Idinfo(conversationKey);
        messageFormReset();
        switchMessengerTab(conversationType === 'group' ? 'groups' : 'dms');
    });

    $('body').on('click', '.group-card__actions button', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    $('body').on('click', '.group-open-chat', function (e) {
        e.preventDefault();
        const card = $(this).closest('.group-card');
        card.trigger('click');
    });

    $('body').on('click', '.group-voice-call, .group-video-call', async function (e) {
        e.preventDefault();
        const card = $(this).closest('.group-card');
        const conversationKey = String(card.data('conversationKey') || '');
        const groupId = Number(card.data('groupId') || 0);
        const callType = String($(this).data('callType') || 'audio');

        if (!conversationKey || !groupId) {
            notyf.error('Open the group first before starting a call.');
            return;
        }

        setActiveConversation(conversationKey, {
            type: 'group',
            groupId,
        });
        Idinfo(conversationKey);
        await window.__messengerCallManager?.startOutgoingCall?.(callType, {
            groupId,
            conversationKey,
        });
    });

    $('body').on('click', '.quick-chat', function (e) {
        e.preventDefault();
        const userId = Number($(this).data('userId') || 0);
        const conversationKey = `user:${userId}`;

        if (!userId) {
            return;
        }

        switchMessengerTab('dms');
        setActiveConversation(conversationKey, {
            type: 'user',
            userId,
        });
        hideTypingIndicator();
        Idinfo(conversationKey);
        messageFormReset();
    });

    $('body').on('click', '.quick-call, .quick-video', async function (e) {
        e.preventDefault();
        const userId = Number($(this).data('userId') || 0);
        const callType = String($(this).data('callType') || 'audio');

        if (!userId) {
            return;
        }

        const conversationKey = `user:${userId}`;
        switchMessengerTab('dms');
        setActiveConversation(conversationKey, {
            type: 'user',
            userId,
        });
        Idinfo(conversationKey);
        await window.__messengerCallManager?.startOutgoingCall?.(callType, {
            calleeId: userId,
            conversationKey,
        });
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
    messageInput.on('input', function () {
        queueTypingIndicator();
        refreshMessageTone();
        refreshComposerSurfaceState();
    });
    $('body').on('input keyup', '.emojionearea-editor', function () {
        queueTypingIndicator();
        refreshMessageTone();
        refreshComposerSurfaceState();
    });
    messageInput.on('keyup', maybeApplyComposerEmojiShortcuts);
    $('body').on('keyup', '.emojionearea-editor', maybeApplyComposerEmojiShortcuts);
    messageInput.on('focus', function () {
        setComposerFocusState(true);
    });
    messageInput.on('blur', function () {
        window.setTimeout(() => {
            if (!$('.emojionearea-editor:focus').length) {
                setComposerFocusState(false);
            }
        }, 0);
    });
    $('body').on('focus', '.emojionearea-editor', function () {
        setComposerFocusState(true);
    });
    $('body').on('blur', '.emojionearea-editor', function () {
        window.setTimeout(() => {
            if (!$('.emojionearea-editor:focus').length && document.activeElement !== messageInput.get(0)) {
                setComposerFocusState(false);
            }
        }, 0);
    });
    window.visualViewport?.addEventListener('resize', positionComposerEmojiPopover);
    $(window).on('resize', positionComposerEmojiPopover);

    /**
     *  -------------------------------
     * | Send Attachment From Message |
     *  -------------------------------
    */
    $(".attachment-input").change(function () {
        renderAttachmentPreview();
        refreshComposerSurfaceState();

    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        composerShell.on(eventName, function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleComposerState('is-dragover', true);
            setComposerFocusState(true);
        });
    });

    ['dragleave', 'dragend'].forEach((eventName) => {
        composerShell.on(eventName, function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (e.currentTarget === e.target) {
                toggleComposerState('is-dragover', false);
            }
        });
    });

    composerShell.on('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleComposerState('is-dragover', false);

        const droppedFiles = Array.from(e.originalEvent?.dataTransfer?.files || []);

        if (!droppedFiles.length) {
            return;
        }

        setComposerAttachmentFiles(droppedFiles);
        notyf.success(`${droppedFiles.length} ${droppedFiles.length === 1 ? 'file is' : 'files are'} ready to send.`);
    });

    voiceRecordToggle.on('click', function (e) {
        e.preventDefault();
        startVoiceRecording();
    });

    voiceRecordCancel.on('click', async function (e) {
        e.preventDefault();
        await cancelVoiceRecording();
    });

    emojiTriggerButton.on('click', function (e) {
        e.preventDefault();
        toggleComposerEmojiPopover();
        focusComposer();
    });

    $('body').on('click', '.composer-reply-clear', function (e) {
        e.preventDefault();
        clearComposerReplyTarget();
        focusComposer();
    });

    $('body').on('click', '.smart-reply-chip', function (e) {
        e.preventDefault();
        setComposerText($(this).text());
        hideSmartReplies();
        refreshMessageTone();
        focusComposer();
    });

    $('body').on('click', '.message-reply-trigger', function (e) {
        e.preventDefault();
        const messageCard = $(this).closest('.message-card');

        setComposerReplyTarget({
            id: Number(messageCard.data('replyId')),
            sender_label: messageCard.data('replyAuthor'),
            snippet: messageCard.data('replySnippet'),
        });

        closeReactionPickers();
        focusComposer();
    });

    $('body').on('click', '.message-reply-snippet', function (e) {
        e.preventDefault();
        jumpToMessage($(this).data('replyJump'));
    });

    $('body').on('click', '.message-react-trigger', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const picker = $(this).siblings('[data-reaction-picker]');
        const shouldOpen = !picker.hasClass('is-open');

        closeReactionPickers();
        picker.toggleClass('is-open', shouldOpen);
    });

    $('body').on('click', '.message-reaction-option, .message-reaction-chip', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleMessageReaction($(this).data('msgid'), $(this).data('reaction'));
    });

    $('body').on('click', function (e) {
        if (!$(e.target).closest('.message-reaction-picker-wrap').length) {
            closeReactionPickers();
        }

        if (!$(e.target).closest('[data-composer-emoji-popover], .composer-emoji-trigger').length) {
            toggleComposerEmojiPopover(false);
        }
    });

    $('.conversation-search-toggle').on('click', function (e) {
        e.preventDefault();
        const shouldShow = conversationSearchPanel.hasClass('d-none');

        conversationSearchPanel.toggleClass('d-none', !shouldShow);
        conversationSearchResults.addClass('d-none').empty();
        window.requestAnimationFrame(() => {
            adjustMessengerLayout();
        });

        if (shouldShow) {
            conversationSearchInput.trigger('focus');
        }
    });

    $('.conversation-search-close').on('click', function (e) {
        e.preventDefault();
        conversationSearchPanel.addClass('d-none');
        conversationSearchInput.val('');
        conversationSearchResults.addClass('d-none').empty();
        window.requestAnimationFrame(() => {
            adjustMessengerLayout();
        });
    });

    conversationSearchInput.on('input', debounce(function () {
        searchConversation(conversationSearchInput.val());
    }, 280));

    $('body').on('click', '.conversation-search-result', function (e) {
        e.preventDefault();
        jumpToMessage($(this).data('messageId'));
    });

    conversationDisappearOptions.on('click', function (e) {
        e.preventDefault();
        const disappearAfter = String($(this).data('disappearAfter') || 'off');
        const conversationKey = getConversationKey();

        if (!conversationKey) {
            notyf.error('Select a conversation first.');
            return;
        }

        $.ajax({
            method: 'POST',
            url: route('messenger.conversation-disappearing'),
            data: {
                _token: csrf_token,
                conversation_key: conversationKey,
                disappear_after: disappearAfter,
            },
            success: function (data) {
                setDisappearingState(String(data.disappear_after || disappearAfter));
                notyf.success(disappearAfter === 'off'
                    ? 'Disappearing messages turned off.'
                    : `Messages will now disappear after ${disappearAfter}.`);
            },
            error: function () {
                notyf.error('Unable to update disappearing messages right now.');
            }
        });
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

    createGroupForm.on('submit', function (e) {
        e.preventDefault();

        $.ajax({
            method: 'POST',
            url: route('messenger.groups.store'),
            data: `${$(this).serialize()}&_token=${encodeURIComponent(csrf_token)}`,
            success: function (data) {
                messengerGroupBox.find('.no_group_contact').remove();
                messengerGroupBox.prepend(data.contact_item);
                createGroupForm[0].reset();
                bootstrap.Modal.getOrCreateInstance(document.getElementById('createGroupModal')).hide();

                const conversationKey = data.group?.conversation_key || '';
                if (conversationKey) {
                    switchMessengerTab('groups');
                    setActiveConversation(conversationKey, {
                        type: 'group',
                        groupId: Number(data.group?.id || 0),
                    });
                    Idinfo(conversationKey);
                    messageFormReset();
                }

                refreshGroupOnlineState();
                refreshSidebarBadgeCountsFromDom();
                notyf.success('Group created successfully.');
            },
            error: function (xhr) {
                notyf.error(xhr?.responseJSON?.message || 'Unable to create the group right now.');
            }
        });
    });

    themeSwatches.on('click', function (e) {
        e.preventDefault();
        const conversationKey = getConversationKey();
        const primaryColor = String($(this).data('chatThemeColor') || '#2180f3');
        const lightColor = String($(this).data('chatThemeLight') || '#ecf5ff');

        if (!conversationKey) {
            notyf.error('Select a conversation first.');
            return;
        }

        saveChatTheme(primaryColor, lightColor, conversationKey);

        $.ajax({
            method: 'POST',
            url: route('messenger.conversation-theme'),
            data: {
                _token: csrf_token,
                conversation_key: conversationKey,
                primary_color: primaryColor,
                light_color: lightColor,
            },
            success: function (data) {
                applyConversationThemePayload(conversationKey, data.theme || {
                    primary: primaryColor,
                    light: lightColor,
                }, { apply: conversationKey === getConversationKey() });
            },
            error: function () {
                notyf.error('Unable to sync the theme right now.');
            }
        });
    });

    /** 
     *   ----------------------------
     *  | Message Pagination method  |
     *   ----------------------------
    */
    actionOnScroll(".wsus__chat_area_body", function () {

        fetchMessages(getConversationKey());

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
     *  -----------------------------
     * | Window load event listener. |
     *  -----------------------------
    */
    adjustMessengerLayout();

    /** 
     *  --------------------------------
     * | Window resize event listener.  |
     *  --------------------------------
    */
    $(window).resize(function () {
        adjustMessengerLayout();
    });

});//End Method
