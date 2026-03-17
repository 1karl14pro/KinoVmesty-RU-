# КиноВместе 🎬

Смотри видео с друзьями в реальном времени. Поддерживает Rutube, YouTube и VK Видео.

## Возможности

- 🎬 Синхронизированный просмотр видео
- 💬 Чат с эмодзи и упоминаниями
- 🎤 Голосовое общение (WebRTC Push-to-Talk)
- 🌐 Открытые и закрытые комнаты
- 🔗 Быстрые ссылки-приглашения
- 📱 PWA — устанавливается на iPhone

## Поддерживаемые платформы

- [Rutube](https://rutube.ru)
- [YouTube](https://youtube.com)
- [VK Видео](https://vkvideo.ru)

## Стек

- **Backend:** Node.js, Express, Socket.io
- **Frontend:** Vanilla JS, HLS.js, WebRTC
- **Хостинг:** Railway + VDS (RU прокси для Rutube)

## Запуск локально
```bash
npm install
node server.js
```

Открой http://localhost:8080

## Деплой

Проект автоматически деплоится на Railway при пуше в `main`.
