import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { authenticateWebSocket, AuthenticatedWebSocket } from '../middleware/websocket.middleware';
import Message from '../models/Message.model';
import Chat from '../models/Chat.model';
import User from '../models/User.model';

class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });
  }

  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Токен не предоставлен');
      return;
    }

    const authenticated = await authenticateWebSocket(ws as AuthenticatedWebSocket, token);

    if (!authenticated) {
      ws.close(1008, 'Недействительный токен');
      return;
    }

    const authWs = ws as AuthenticatedWebSocket;
    const userId = authWs.userId!;

    this.clients.set(userId, authWs);

    await User.findByIdAndUpdate(userId, {
      status: 'online',
      lastSeen: new Date()
    });

    this.broadcastUserStatus(userId, 'online');

    authWs.send(JSON.stringify({
      type: 'connection:established',
      data: { userId }
    }));

    authWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(authWs, message);
      } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
      }
    });

    authWs.on('close', async () => {
      this.clients.delete(userId);
      this.typingUsers.delete(userId);

      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastSeen: new Date()
      });

      this.broadcastUserStatus(userId, 'offline');
    });

    authWs.on('error', (error) => {
      console.error('WebSocket ошибка:', error);
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: any): Promise<void> {
    const userId = ws.userId!;

    switch (message.type) {
      case 'message:send':
        await this.handleSendMessage(userId, message.data);
        break;

      case 'typing:start':
        this.handleTypingStart(userId, message.data.chatId);
        break;

      case 'typing:stop':
        this.handleTypingStop(userId, message.data.chatId);
        break;

      case 'message:read':
        await this.handleMessageRead(userId, message.data.messageId);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Неизвестный тип сообщения' }
        }));
    }
  }

  private async handleSendMessage(userId: string, data: any): Promise<void> {
    const { chatId, content, type = 'text', fileUrl } = data;

    try {
      const chat = await Chat.findById(chatId);

      if (!chat || !chat.participants.includes(userId as any)) {
        return;
      }

      const message = new Message({
        chatId,
        senderId: userId,
        content,
        type,
        fileUrl: fileUrl || ''
      });

      await message.save();
      await message.populate('senderId', 'username avatar');

      chat.lastMessage = message._id;
      await chat.save();

      // Преобразуем _id в id для senderId
      const messageObj = message.toObject();
      if (messageObj.senderId && typeof messageObj.senderId === 'object') {
        messageObj.senderId = {
          id: messageObj.senderId._id.toString(),
          username: messageObj.senderId.username,
          avatar: messageObj.senderId.avatar
        };
      }

      const messageData = {
        type: 'message:new',
        data: messageObj
      };

      chat.participants.forEach((participantId: any) => {
        const client = this.clients.get(participantId.toString());
        if (client) {
          client.send(JSON.stringify(messageData));
        }
      });
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
    }
  }

  private handleTypingStart(userId: string, chatId: string): void {
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }

    this.typingUsers.get(chatId)!.add(userId);

    this.broadcastTyping(chatId, userId, true);
  }

  private handleTypingStop(userId: string, chatId: string): void {
    const typingSet = this.typingUsers.get(chatId);
    if (typingSet) {
      typingSet.delete(userId);
      this.broadcastTyping(chatId, userId, false);
    }
  }

  private broadcastTyping(chatId: string, userId: string, isTyping: boolean): void {
    const typingData = {
      type: 'typing:update',
      data: { chatId, userId, isTyping }
    };

    this.clients.forEach((client, clientUserId) => {
      if (clientUserId !== userId) {
        client.send(JSON.stringify(typingData));
      }
    });
  }

  private async handleMessageRead(userId: string, messageId: string): Promise<void> {
    try {
      const message = await Message.findById(messageId);

      if (!message || !message.readBy.includes(userId as any)) {
        message?.readBy.push(userId as any);
        await message?.save();

        const chat = await Chat.findById(message?.chatId);
        if (chat) {
          const readData = {
            type: 'message:read',
            data: { messageId, userId }
          };

          chat.participants.forEach((participantId: any) => {
            const client = this.clients.get(participantId.toString());
            if (client) {
              client.send(JSON.stringify(readData));
            }
          });
        }
      }
    } catch (error) {
      console.error('Ошибка обработки прочтения сообщения:', error);
    }
  }

  private broadcastUserStatus(userId: string, status: string): void {
    const statusData = {
      type: 'user:status',
      data: { userId, status }
    };

    this.clients.forEach((client) => {
      if (client.userId !== userId) {
        client.send(JSON.stringify(statusData));
      }
    });
  }

  public sendToUser(userId: string, data: any): void {
    const client = this.clients.get(userId);
    if (client) {
      client.send(JSON.stringify(data));
    }
  }
}

export default WebSocketService;
