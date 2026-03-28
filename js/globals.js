// ============================================================
<<<<<<< HEAD
//  Файл: globals.js
//  Расположение: js/globals.js
//  Описание: Глобальные переменные состояния приложения.
//  Загружается ПЕРВЫМ до всех остальных скриптов для доступности 
//  базовых переменных и инициализации Socket.io (БАГ 1 исправлен).
=======
//  globals.js — все общие переменные состояния
//  Загружается ПЕРВЫМ — до всех остальных скриптов
//  Исправления:
//    - добавлен var socket = io() (БАГ 1 — критический)
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ============================================================

// ─── БАГ 1: socket нигде не создавался — всё падало с ReferenceError
//  socket.io клиент подключается здесь, первым делом
var socket = io();

// ─── Сессия / комната ────────────────────────────────────────
var myName       = '';
var myRoom       = '';
var mySessionId  = null;
var isHost       = false;
var membersN     = 1;
var msgN         = 0;
var roomType     = 'closed';
var selectedType = 'open';
<<<<<<< HEAD
var _hostId = null;
=======

>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ─── Плеер ───────────────────────────────────────────────────
var currentPlatform = 'rutube';
var hls             = null;
var isSeeking       = false;
var ytPlayer        = null;
var ytReady_flag    = false;

// ─── Очередь ─────────────────────────────────────────────────
var queueItems     = [];
var queuePanelOpen = false;

// ─── Автоплейлист ────────────────────────────────────────────
var autoPlaylistEnabled      = true;
var autoPlaylistSearched     = false;
var autoPlaylistBannerActive = false;

// ─── Чат / UI ────────────────────────────────────────────────
var selectedPlatform    = 'rutube';
var sidebarHidden       = false;
var fsChatOpen          = false;
var chatExpanded        = false;
var mentionDropdownOpen = false;
var emojiPickerOpen     = false;

// ─── Звук ────────────────────────────────────────────────────
var audioCtx = null;

// ─── Микрофон / WebRTC ───────────────────────────────────────
var micStream     = null;
var peerConns     = {};
var memberIds     = [];
var micActive     = false;
var micHoldTimer  = null;
var holdActivated = false;
var remoteAudios  = {};
var DUCK_VOL      = 0.15;

// ─── Синхронизация ───────────────────────────────────────────
var SYNC_THRESHOLD     = 0.5;
var lastSyncCorrection = 0;

// ─── Участники ───────────────────────────────────────────────
var roomMembers = {};

// ─── Константы ───────────────────────────────────────────────
var SWIPE_THRESHOLD = 50;

var EMOJIS = [
  '😀','😂','🥹','😍','🥰','😎','🤩','😭','😡','🤔',
  '👍','👎','❤️','🔥','💯','✨','🎉','🎬','🍿','👀',
  '😴','🤣','😱','🥳','😏','🤗','😶','🫡','💀','🗿',
  '👋','🙌','🤝','💪','🫶','🙏','👏','🤌','😤','🫠',
];

var PLATFORM_INFO = {
  rutube:  { label:'Rutube',   hint:'Вставь ссылку: https://rutube.ru/video/...',      placeholder:'https://rutube.ru/video/...' },
  youtube: { label:'YouTube',  hint:'Вставь ссылку: https://youtube.com/watch?v=...',  placeholder:'https://youtube.com/watch?v=...' },
  vk:      { label:'VK Видео', hint:'Вставь ссылку: https://vkvideo.ru/video-123_456', placeholder:'https://vkvideo.ru/video-123_456' },
};