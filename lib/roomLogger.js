// ============================================================
// Файл: roomLogger.js
// Расположение: lib/roomLogger.js
// Описание: Система логирования комнат. Сохраняет полную информацию
// о комнате в отдельную папку: JSON-лог и текстовый отчёт.
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOMS_DIR = path.join(__dirname, '..', 'rooms');

// Создаём папку если её нет
if (!fs.existsSync(ROOMS_DIR)) {
    fs.mkdirSync(ROOMS_DIR, { recursive: true });
    console.log('[LOGGER] Создана папка rooms/');
}

// ─── Проверка существования кода комнаты ─────────────────────

function isCodeUsed(code) {
    try {
        const entries = fs.readdirSync(ROOMS_DIR);
        return entries.some(name => name.startsWith(code + '_') || name === code);
    } catch {
        return false;
    }
}

// ─── Форматирование даты для имени папки ─────────────────────

function formatDateForFolder(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '_',
        pad(date.getHours()),
        '-',
        pad(date.getMinutes()),
        '-',
        pad(date.getSeconds())
    ].join('');
}

// ─── Класс логгера комнаты ───────────────────────────────────

class RoomLogger {
    constructor(roomCode) {
        this.roomCode = roomCode;
        this.createdAt = new Date();
        
        // Имя папки: ABC123_20250115_143000
        this.folderName = `${roomCode}_${formatDateForFolder(this.createdAt)}`;
        this.folderPath = path.join(ROOMS_DIR, this.folderName);
        
        // Создаём папку комнаты
        if (!fs.existsSync(this.folderPath)) {
            fs.mkdirSync(this.folderPath, { recursive: true });
        }
        
        this.logPath = path.join(this.folderPath, 'log.json');
        this.reportPath = path.join(this.folderPath, 'report.txt');
        
        this.data = {
            // ─── Основная информация ─────────────────────────
            code: roomCode,
            folderName: this.folderName,
            createdAt: this.createdAt.toISOString(),
            createdAtTimestamp: this.createdAt.getTime(),
            closedAt: null,
            closedAtTimestamp: null,
            isActive: true,
            
            // ─── Создатель ───────────────────────────────────
            creator: {
                socketId: null,
                sessionId: null,
                name: null,
                ip: null,
                userAgent: null,
                origin: null,
                language: null
            },
            
            // ─── Параметры комнаты ───────────────────────────
            title: null,
            type: null,
            
            // ─── Статистика ──────────────────────────────────
            stats: {
                maxMembers: 0,
                totalJoins: 0,
                totalMessages: 0,
                totalVideos: 0,
                totalDurationMs: 0,
                totalDurationFormatted: null
            },
            
            // ─── История видео ───────────────────────────────
            videos: [],
            
            // ─── Участники ───────────────────────────────────
            members: {},
            
            // ─── Чат ─────────────────────────────────────────
            chat: [],
            
            // ─── События ─────────────────────────────────────
            events: [],
            
            // ─── Очередь (история) ───────────────────────────
            queueHistory: []
        };
        
        this._saveQueued = false;
        this._saveTimeout = null;
        
        // Сохраняем начальное состояние
        this._save();
        
        console.log(`[LOGGER] Создана папка: ${this.folderName}`);
    }

    // ─── Получение IP из socket ──────────────────────────────
    static getClientInfo(socket) {
        const headers = socket.handshake?.headers || {};
        
        let ip = headers['x-forwarded-for'] || 
                 headers['x-real-ip'] || 
                 socket.handshake?.address ||
                 socket.request?.connection?.remoteAddress ||
                 'unknown';
        
        if (ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }
        
        if (ip.startsWith('::ffff:')) {
            ip = ip.slice(7);
        }
        
        return {
            ip,
            userAgent: headers['user-agent'] || 'unknown',
            origin: headers['origin'] || 'unknown',
            language: headers['accept-language']?.split(',')[0] || 'unknown'
        };
    }

    // ─── Установка создателя ─────────────────────────────────
    setCreator(socket, sessionId, name) {
        const clientInfo = RoomLogger.getClientInfo(socket);
        
        this.data.creator = {
            socketId: socket.id,
            sessionId: sessionId,
            name: name,
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            origin: clientInfo.origin,
            language: clientInfo.language
        };
        
        this.addEvent('room_created', {
            by: name,
            ip: clientInfo.ip
        });
        
        this._queueSave();
    }

    // ─── Установка информации о комнате ──────────────────────
    setRoomInfo(info) {
        if (info.title) this.data.title = info.title;
        if (info.type) this.data.type = info.type;
        if (info.videoUrl) {
            this.addVideo({
                videoId: info.videoId,
                videoUrl: info.videoUrl,
                platform: info.platform,
                isInitial: true
            });
        }
        this._queueSave();
    }

    // ─── Добавление участника ────────────────────────────────
    addMember(socket, sessionId, name) {
        const clientInfo = RoomLogger.getClientInfo(socket);
        const memberId = socket.id;
        
        if (!this.data.members[memberId]) {
            this.data.members[memberId] = {
                sessionId: sessionId,
                name: name,
                ip: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                firstJoin: new Date().toISOString(),
                sessions: [],
                messageCount: 0
            };
        }
        
        this.data.members[memberId].sessions.push({
            joinedAt: new Date().toISOString(),
            joinedAtTimestamp: Date.now(),
            leftAt: null,
            leftAtTimestamp: null,
            durationMs: null,
            ip: clientInfo.ip
        });
        
        this.data.stats.totalJoins++;
        
        const currentActive = this._countActiveMembers();
        if (currentActive > this.data.stats.maxMembers) {
            this.data.stats.maxMembers = currentActive;
        }
        
        this.addEvent('member_joined', {
            socketId: memberId,
            name: name,
            ip: clientInfo.ip,
            currentCount: currentActive
        });
        
        this._queueSave();
    }

    // ─── Подсчёт активных участников ─────────────────────────
    _countActiveMembers() {
        return Object.values(this.data.members).filter(m => {
            const lastSession = m.sessions[m.sessions.length - 1];
            return lastSession && !lastSession.leftAt;
        }).length;
    }

    // ─── Удаление участника ──────────────────────────────────
    removeMember(socketId, name) {
        if (this.data.members[socketId]) {
            const sessions = this.data.members[socketId].sessions;
            const lastSession = sessions[sessions.length - 1];
            
            if (lastSession && !lastSession.leftAt) {
                lastSession.leftAt = new Date().toISOString();
                lastSession.leftAtTimestamp = Date.now();
                lastSession.durationMs = lastSession.leftAtTimestamp - lastSession.joinedAtTimestamp;
            }
        }
        
        this.addEvent('member_left', {
            socketId: socketId,
            name: name,
            currentCount: this._countActiveMembers()
        });
        
        this._queueSave();
    }

    // ─── Добавление сообщения чата ───────────────────────────
    addChat(socket, name, text) {
        const clientInfo = RoomLogger.getClientInfo(socket);
        
        const message = {
            id: this.data.chat.length + 1,
            time: new Date().toISOString(),
            timestamp: Date.now(),
            socketId: socket.id,
            sessionId: socket.sessionId || null,
            name: name,
            text: text,
            ip: clientInfo.ip,
            textLength: text.length
        };
        
        this.data.chat.push(message);
        this.data.stats.totalMessages++;
        
        if (this.data.members[socket.id]) {
            this.data.members[socket.id].messageCount++;
        }
        
        this._queueSave();
        
        return message;
    }

    // ─── Добавление видео ────────────────────────────────────
    addVideo(videoInfo) {
        // Закрываем предыдущее видео
        if (this.data.videos.length > 0) {
            const prevVideo = this.data.videos[this.data.videos.length - 1];
            if (!prevVideo.endedAt) {
                prevVideo.endedAt = new Date().toISOString();
                prevVideo.endedAtTimestamp = Date.now();
                prevVideo.durationMs = prevVideo.endedAtTimestamp - prevVideo.startedAtTimestamp;
            }
        }
        
        const video = {
            index: this.data.videos.length + 1,
            videoId: videoInfo.videoId,
            videoUrl: videoInfo.videoUrl,
            platform: videoInfo.platform,
            title: videoInfo.title || null,
            startedAt: new Date().toISOString(),
            startedAtTimestamp: Date.now(),
            endedAt: null,
            endedAtTimestamp: null,
            durationMs: null,
            isInitial: videoInfo.isInitial || false,
            addedBy: videoInfo.addedBy || null,
            fromQueue: videoInfo.fromQueue || false
        };
        
        this.data.videos.push(video);
        this.data.stats.totalVideos++;
        
        this.addEvent('video_changed', {
            index: video.index,
            videoId: videoInfo.videoId,
            platform: videoInfo.platform,
            fromQueue: videoInfo.fromQueue || false
        });
        
        this._queueSave();
    }

    // ─── Добавление в историю очереди ────────────────────────
    addQueueItem(item, action, by) {
        this.data.queueHistory.push({
            time: new Date().toISOString(),
            timestamp: Date.now(),
            action: action,
            item: {
                id: item.id,
                videoId: item.videoId,
                videoUrl: item.videoUrl,
                platform: item.platform,
                title: item.title
            },
            by: by
        });
        
        this._queueSave();
    }

    // ─── Добавление события ──────────────────────────────────
    addEvent(type, data = {}) {
        this.data.events.push({
            time: new Date().toISOString(),
            timestamp: Date.now(),
            type: type,
            data: data
        });
    }

    // ─── Смена типа комнаты ──────────────────────────────────
    setRoomType(type, changedBy) {
        const oldType = this.data.type;
        this.data.type = type;
        
        this.addEvent('room_type_changed', {
            from: oldType,
            to: type,
            by: changedBy
        });
        
        this._queueSave();
    }

    // ─── Передача хоста ──────────────────────────────────────
    setNewHost(socketId, name) {
        this.addEvent('host_transferred', {
            newHostSocketId: socketId,
            newHostName: name
        });
        
        this._queueSave();
    }

    // ─── Действия плеера ─────────────────────────────────────
    addPlayerAction(action, time, name) {
        this.addEvent('player_action', {
            action: action,
            videoTime: time,
            by: name
        });
        
        this._queueSave();
    }

    // ─── Закрытие комнаты ────────────────────────────────────
    close() {
        const now = new Date();
        
        this.data.closedAt = now.toISOString();
        this.data.closedAtTimestamp = now.getTime();
        this.data.isActive = false;
        
        // Вычисляем общую длительность
        this.data.stats.totalDurationMs = 
            this.data.closedAtTimestamp - this.data.createdAtTimestamp;
        
        const totalMins = Math.floor(this.data.stats.totalDurationMs / 60000);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        this.data.stats.totalDurationFormatted = 
            hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
        
        // Закрываем последнее видео
        if (this.data.videos.length > 0) {
            const lastVideo = this.data.videos[this.data.videos.length - 1];
            if (!lastVideo.endedAt) {
                lastVideo.endedAt = this.data.closedAt;
                lastVideo.endedAtTimestamp = this.data.closedAtTimestamp;
                lastVideo.durationMs = lastVideo.endedAtTimestamp - lastVideo.startedAtTimestamp;
            }
        }
        
        // Закрываем все активные сессии участников
        for (const member of Object.values(this.data.members)) {
            const lastSession = member.sessions[member.sessions.length - 1];
            if (lastSession && !lastSession.leftAt) {
                lastSession.leftAt = this.data.closedAt;
                lastSession.leftAtTimestamp = this.data.closedAtTimestamp;
                lastSession.durationMs = lastSession.leftAtTimestamp - lastSession.joinedAtTimestamp;
                lastSession.closedWithRoom = true;
            }
        }
        
        this.addEvent('room_closed', {
            totalDurationMs: this.data.stats.totalDurationMs,
            totalDurationFormatted: this.data.stats.totalDurationFormatted,
            totalMessages: this.data.stats.totalMessages,
            totalJoins: this.data.stats.totalJoins,
            maxMembers: this.data.stats.maxMembers,
            totalVideos: this.data.stats.totalVideos
        });
        
        // Сохраняем немедленно при закрытии
        this._save();
        this._saveTextReport();
        
        console.log(`[LOGGER] Комната ${this.roomCode} закрыта → ${this.folderName}/`);
    }

    // ─── Отложенное сохранение (батчинг) ─────────────────────
    _queueSave() {
        if (this._saveQueued) return;
        this._saveQueued = true;
        
        this._saveTimeout = setTimeout(() => {
            this._save();
            this._saveQueued = false;
        }, 2000);
    }

    // ─── Немедленное сохранение JSON ─────────────────────────
    _save() {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }
        this._saveQueued = false;
        
        try {
            const json = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.logPath, json, 'utf8');
        } catch (e) {
            console.error(`[LOGGER] Ошибка записи ${this.roomCode}:`, e.message);
        }
    }

    // ─── Генерация текстового отчёта ─────────────────────────
    _generateTextReport() {
        const d = this.data;
        const lines = [];
        const divider = '═'.repeat(70);
        
        lines.push(divider);
        lines.push(`  ОТЧЁТ О КОМНАТЕ: ${d.code}`);
        lines.push(`  Папка: ${d.folderName}`);
        lines.push(divider);
        lines.push('');
        
        // ─── Основная информация ─────────────────────────────
        lines.push('┌─ ОСНОВНАЯ ИНФОРМАЦИЯ ─────────────────────────────────────────────┐');
        lines.push(`│  Код комнаты:   ${d.code}`);
        lines.push(`│  Название:      ${d.title || '—'}`);
        lines.push(`│  Тип:           ${d.type === 'open' ? '🌐 Открытая' : '🔒 Закрытая'}`);
        lines.push(`│  Создана:       ${this._formatDate(d.createdAt)}`);
        lines.push(`│  Закрыта:       ${d.closedAt ? this._formatDate(d.closedAt) : '⚡ Активна'}`);
        lines.push(`│  Длительность:  ${d.stats.totalDurationFormatted || '—'}`);
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // ─── Создатель ───────────────────────────────────────
        lines.push('┌─ СОЗДАТЕЛЬ ────────────────────────────────────────────────────────┐');
        lines.push(`│  Имя:         ${d.creator.name}`);
        lines.push(`│  IP:          ${d.creator.ip}`);
        lines.push(`│  User-Agent:  ${this._truncate(d.creator.userAgent, 50)}`);
        lines.push(`│  Origin:      ${d.creator.origin}`);
        lines.push(`│  Язык:        ${d.creator.language}`);
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // ─── Статистика ──────────────────────────────────────
        lines.push('┌─ СТАТИСТИКА ───────────────────────────────────────────────────────┐');
        lines.push(`│  👥 Макс. участников одновременно:  ${d.stats.maxMembers}`);
        lines.push(`│  🚪 Всего входов:                   ${d.stats.totalJoins}`);
        lines.push(`│  💬 Сообщений в чате:               ${d.stats.totalMessages}`);
        lines.push(`│  🎬 Видео просмотрено:              ${d.stats.totalVideos}`);
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // ─── Участники ───────────────────────────────────────
        lines.push('┌─ УЧАСТНИКИ ────────────────────────────────────────────────────────┐');
        const memberEntries = Object.entries(d.members);
        if (memberEntries.length === 0) {
            lines.push('│  (нет данных)');
        } else {
            memberEntries.forEach(([id, m], idx) => {
                const isCreator = id === d.creator.socketId ? ' 👑' : '';
                lines.push(`│  ${idx + 1}. ${m.name}${isCreator}`);
                lines.push(`│     IP: ${m.ip}`);
                lines.push(`│     Сообщений: ${m.messageCount}`);
                lines.push(`│     Первый вход: ${this._formatDate(m.firstJoin)}`);
                lines.push(`│     Сессии:`);
                m.sessions.forEach((s, si) => {
                    const dur = s.durationMs ? ` (${this._formatDuration(s.durationMs)})` : '';
                    const closed = s.closedWithRoom ? ' [закрыта с комнатой]' : '';
                    lines.push(`│       ${si + 1}) ${this._formatTime(s.joinedAt)} → ${s.leftAt ? this._formatTime(s.leftAt) : 'онлайн'}${dur}${closed}`);
                });
                if (idx < memberEntries.length - 1) lines.push('│');
            });
        }
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // ─── История видео ───────────────────────────────────
        lines.push('┌─ ИСТОРИЯ ВИДЕО ────────────────────────────────────────────────────┐');
        if (d.videos.length === 0) {
            lines.push('│  (нет данных)');
        } else {
            d.videos.forEach((v, idx) => {
                const platform = { rutube: '🔴 Rutube', youtube: '▶️ YouTube', vk: '💙 VK' }[v.platform] || v.platform;
                const fromQueue = v.fromQueue ? ' [из очереди]' : '';
                const initial = v.isInitial ? ' [начальное]' : '';
                lines.push(`│  ${v.index}. ${platform}${initial}${fromQueue}`);
                lines.push(`│     ID: ${v.videoId}`);
                lines.push(`│     URL: ${this._truncate(v.videoUrl, 55)}`);
                if (v.title) lines.push(`│     Название: ${this._truncate(v.title, 50)}`);
                lines.push(`│     Начало: ${this._formatDate(v.startedAt)}`);
                if (v.endedAt) {
                    lines.push(`│     Конец: ${this._formatDate(v.endedAt)} (${this._formatDuration(v.durationMs)})`);
                }
                if (idx < d.videos.length - 1) lines.push('│');
            });
        }
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // ─── Чат ─────────────────────────────────────────────
        lines.push('┌─ ЧАТ ──────────────────────────────────────────────────────────────┐');
        if (d.chat.length === 0) {
            lines.push('│  (пусто)');
        } else {
            d.chat.forEach(msg => {
                const time = this._formatTime(msg.time);
                const text = msg.text.replace(/\n/g, ' ').slice(0, 50);
                const truncated = msg.text.length > 50 ? '...' : '';
                lines.push(`│  [${time}] ${msg.name} (${msg.ip}):`);
                lines.push(`│    "${text}${truncated}"`);
            });
        }
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // ─── История очереди ─────────────────────────────────
        if (d.queueHistory.length > 0) {
            lines.push('┌─ ИСТОРИЯ ОЧЕРЕДИ ──────────────────────────────────────────────────┐');
            d.queueHistory.forEach(q => {
                const time = this._formatTime(q.time);
                const action = {
                    'added': '➕ добавил',
                    'added_playlist': '🤖 авто-добавлено',
                    'removed': '➖ удалил',
                    'played': '▶️ запустил',
                    'auto_played': '⏭ авто-переход'
                }[q.action] || q.action;
                lines.push(`│  [${time}] ${q.by} ${action}`);
                lines.push(`│    → ${this._truncate(q.item.title || q.item.videoId, 50)}`);
            });
            lines.push('└────────────────────────────────────────────────────────────────────┘');
            lines.push('');
        }
        
        // ─── События ─────────────────────────────────────────
        lines.push('┌─ ВСЕ СОБЫТИЯ ──────────────────────────────────────────────────────┐');
        d.events.forEach(e => {
            const time = this._formatTime(e.time);
            const type = this._formatEventType(e.type);
            const details = this._formatEventData(e.data);
            lines.push(`│  [${time}] ${type}`);
            if (details) lines.push(`│    ${details}`);
        });
        lines.push('└────────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        lines.push(divider);
        lines.push(`  Сгенерировано: ${this._formatDate(new Date().toISOString())}`);
        lines.push(divider);
        
        return lines.join('\n');
    }

    // ─── Вспомогательные форматтеры ──────────────────────────
    _formatDate(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleString('ru-RU', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    _formatTime(isoString) {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString('ru-RU', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    _formatDuration(ms) {
        if (!ms) return '—';
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const hours = Math.floor(mins / 60);
        if (hours > 0) return `${hours}ч ${mins % 60}м`;
        if (mins > 0) return `${mins}м ${secs % 60}с`;
        return `${secs}с`;
    }

    _truncate(str, max) {
        if (!str) return '—';
        return str.length > max ? str.slice(0, max) + '...' : str;
    }

    _formatEventType(type) {
        const map = {
            'room_created': '🎬 Комната создана',
            'room_closed': '🚪 Комната закрыта',
            'room_type_changed': '🔄 Тип изменён',
            'member_joined': '👋 Вход',
            'member_left': '👋 Выход',
            'host_transferred': '👑 Новый хост',
            'video_changed': '🎬 Смена видео',
            'player_action': '⏯ Плеер',
            'queue_cleared': '🗑 Очередь очищена',
            'mic_start': '🎤 Микрофон'
        };
        return map[type] || type;
    }

    _formatEventData(data) {
        if (!data || Object.keys(data).length === 0) return '';
        const parts = [];
        if (data.by) parts.push(`by: ${data.by}`);
        if (data.name) parts.push(`${data.name}`);
        if (data.action) parts.push(`${data.action}`);
        if (data.from && data.to) parts.push(`${data.from} → ${data.to}`);
        if (data.currentCount !== undefined) parts.push(`онлайн: ${data.currentCount}`);
        if (data.ip) parts.push(`IP: ${data.ip}`);
        return parts.join(' | ');
    }

    // ─── Сохранение текстового отчёта ────────────────────────
    _saveTextReport() {
        try {
            fs.writeFileSync(this.reportPath, this._generateTextReport(), 'utf8');
        } catch (e) {
            console.error(`[LOGGER] Ошибка записи отчёта:`, e.message);
        }
    }
}

// ─── Менеджер логгеров ───────────────────────────────────────

const loggers = new Map();

function getLogger(roomCode) {
    if (!loggers.has(roomCode)) {
        loggers.set(roomCode, new RoomLogger(roomCode));
    }
    return loggers.get(roomCode);
}

function closeLogger(roomCode) {
    const logger = loggers.get(roomCode);
    if (logger) {
        logger.close();
        loggers.delete(roomCode);
    }
}

function hasLogger(roomCode) {
    return loggers.has(roomCode);
}

// ─── REST-роуты для просмотра логов ──────────────────────────

function registerRoutes(app) {
    // Список всех комнат
    app.get('/api/admin/logs', (req, res) => {
        const validKey = process.env.ADMIN_KEY;
        if (!req.query.key || req.query.key !== validKey) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        try {
            const folders = fs.readdirSync(ROOMS_DIR)
                .filter(f => {
                    try {
                        return fs.statSync(path.join(ROOMS_DIR, f)).isDirectory();
                    } catch {
                        return false;
                    }
                })
                .map(folder => {
                    const logPath = path.join(ROOMS_DIR, folder, 'log.json');
                    if (!fs.existsSync(logPath)) return null;
                    
                    try {
                        const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
                        return {
                            folder: folder,
                            code: data.code,
                            title: data.title,
                            createdAt: data.createdAt,
                            closedAt: data.closedAt,
                            isActive: data.isActive,
                            stats: data.stats
                        };
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            res.json(folders);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // JSON лог конкретной комнаты
    app.get('/api/admin/logs/:folder', (req, res) => {
        const validKey = process.env.ADMIN_KEY;
        if (!req.query.key || req.query.key !== validKey) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const folder = req.params.folder.replace(/[^a-zA-Z0-9_-]/g, '');
        const logPath = path.join(ROOMS_DIR, folder, 'log.json');
        
        try {
            if (!fs.existsSync(logPath)) {
                return res.status(404).json({ error: 'Not found' });
            }
            
            const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Текстовый отчёт
    app.get('/api/admin/logs/:folder/report', (req, res) => {
        const validKey = process.env.ADMIN_KEY;
        if (!req.query.key || req.query.key !== validKey) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const folder = req.params.folder.replace(/[^a-zA-Z0-9_-]/g, '');
        const reportPath = path.join(ROOMS_DIR, folder, 'report.txt');
        const logPath = path.join(ROOMS_DIR, folder, 'log.json');
        
        try {
            res.type('text/plain; charset=utf-8');
            
            if (fs.existsSync(reportPath)) {
                return res.send(fs.readFileSync(reportPath, 'utf8'));
            }
            
            // Генерируем на лету из JSON
            if (fs.existsSync(logPath)) {
                const tempLogger = new RoomLogger('TEMP');
                tempLogger.data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
                return res.send(tempLogger._generateTextReport());
            }
            
            res.status(404).send('Not found');
        } catch (e) {
            res.status(500).send(e.message);
        }
    });
    // ─── ДОБАВЬ этот роут в функцию registerRoutes() в roomLogger.js ───────────
// Вставь ПЕРЕД закрывающей скобкой функции registerRoutes

    // Метрики
    app.get('/api/admin/metrics', (req, res) => {
        const validKey = process.env.ADMIN_KEY;
        if (!req.query.key || req.query.key !== validKey) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            const folders = fs.readdirSync(ROOMS_DIR).filter(f => {
                try { return fs.statSync(path.join(ROOMS_DIR, f)).isDirectory(); } catch { return false; }
            });

            let totalRooms    = 0;
            let todayRooms    = 0;
            let activeRooms   = 0;
            let totalMessages = 0;
            let totalVideos   = 0;
            let peakOnline    = 0;
            let totalDuration = 0;
            let durationCount = 0;

            // Для графика — последние 7 дней
            const dayMap = {};
            for (let i = 6; i >= 0; i--) {
                const d   = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                dayMap[key] = 0;
            }

            const todayStr = new Date().toISOString().slice(0, 10);

            for (const folder of folders) {
                const logPath = path.join(ROOMS_DIR, folder, 'log.json');
                if (!fs.existsSync(logPath)) continue;

                try {
                    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
                    totalRooms++;

                    if (data.isActive) activeRooms++;

                    const dayKey = (data.createdAt || '').slice(0, 10);
                    if (dayKey === todayStr) todayRooms++;
                    if (dayMap[dayKey] !== undefined) dayMap[dayKey]++;

                    totalMessages += data.stats?.totalMessages || 0;
                    totalVideos   += data.stats?.totalVideos   || 0;

                    if ((data.stats?.maxMembers || 0) > peakOnline) {
                        peakOnline = data.stats.maxMembers;
                    }

                    if (data.stats?.totalDurationMs) {
                        totalDuration += data.stats.totalDurationMs;
                        durationCount++;
                    }
                } catch { /* пропускаем битые файлы */ }
            }

            const avgDurationMs = durationCount > 0
                ? Math.floor(totalDuration / durationCount)
                : 0;

            // Форматируем дни для графика
            const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
            const dailyRooms = Object.entries(dayMap).map(([date, count]) => ({
                date,
                count,
                label: days[new Date(date).getDay()],
            }));

            res.json({
                totalRooms,
                todayRooms,
                activeRooms,
                totalMessages,
                totalVideos,
                peakOnline,
                avgDurationMs,
                dailyRooms,
            });

        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}

module.exports = { 
    RoomLogger, 
    getLogger, 
    closeLogger, 
    hasLogger,
    isCodeUsed,
    registerRoutes 
};