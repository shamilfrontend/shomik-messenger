import http from 'http';

import app from './app';
import WebSocketService from './services/websocket.service';
import { setWebSocketService } from './services/wsRegistry';

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

const wsService = new WebSocketService(server);
setWebSocketService(wsService);

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

export default server;
