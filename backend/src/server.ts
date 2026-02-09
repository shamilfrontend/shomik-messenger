const fs = require('fs');
const https = require('https');
import http from 'http';

import app from './app';
import WebSocketService from './services/websocket.service';

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

const wsService = new WebSocketService(server);

// Экспортируем wsService для использования в контроллерах
export { wsService };

const options = {
  key: fs.readFileSync('/root/155.212.218.104-key.pem'),
  cert: fs.readFileSync('/root/155.212.218.104.pem')
};

// Запуск HTTPS сервера
https.createServer(options, app).listen(443, () => {
  console.log('HTTPS сервер запущен на порту 443');
  console.log('Откройте в браузере: https://123.123.123.123');
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

export default server;
