import { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { authenticateWebSocket, AuthenticatedWebSocket } from '../middleware/websocket.middleware';
import Chat from '../models/Chat.model';
import User from '../models/User.model';
import Message from '../models/Message.model';
import { createMessage } from './message.service';
import { ClientRegistry, extractParticipantId } from './websocket/clients';
import { GroupCallState } from './websocket/calls';

const AUTH_TIMEOUT_MS = 5000;
const HEARTBEAT_MS = 30000;

interface IncomingWsMessage {
  type?: string;
  data?: Record<string, unknown>;
}

class WebSocketService {
  private wss: WebSocketServer;

  private clients = new ClientRegistry();

  private typingUsers: Map<string, Set<string>> = new Map();

  private calls: GroupCallState;

  constructor(server: Server) {
    this.calls = new GroupCallState(this.clients);
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      void this.handleConnection(ws, req);
    });
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws as AuthenticatedWebSocket & { isAlive?: boolean };
        if (client.isAlive === false) {
          client.terminate();
          return;
        }
        client.isAlive = false;
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      });
    }, HEARTBEAT_MS);
  }

  private async authenticateSocket(ws: AuthenticatedWebSocket, token: string): Promise<boolean> {
    if (!token) return false;
    return authenticateWebSocket(ws, token);
  }

  private waitForAuth(ws: AuthenticatedWebSocket): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.off('message', onMessage);
        resolve(null);
      }, AUTH_TIMEOUT_MS);

      const onMessage = (data: Buffer) => {
        try {
          const parsed = JSON.parse(data.toString()) as IncomingWsMessage;
          if (parsed.type === 'auth') {
            const token = typeof parsed.data?.token === 'string' ? parsed.data.token : '';
            clearTimeout(timer);
            ws.off('message', onMessage);
            resolve(token || null);
            return;
          }
        } catch {
          // ignore malformed first frame
        }
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(null);
      };

      ws.on('message', onMessage);
    });
  }

  private async handleConnection(ws: WebSocket, _req: IncomingMessage): Promise<void> {
    const authWs = ws as AuthenticatedWebSocket & { isAlive?: boolean };
    authWs.isAlive = true;
    authWs.on('pong', () => {
      authWs.isAlive = true;
    });

    const token = await this.waitForAuth(authWs);
    const authenticated = token ? await this.authenticateSocket(authWs, token) : false;

    if (!authenticated) {
      console.warn('WebSocket: подключение отклонено — недействительный токен');
      authWs.close(1008, 'Недействительный токен');
      return;
    }

    const userId = authWs.userId!;
    this.clients.add(userId, authWs);

    const now = new Date();
    await User.findByIdAndUpdate(userId, {
      status: 'online',
      lastSeen: now,
    });
    this.broadcastUserStatus(userId, 'online', now);

    authWs.send(JSON.stringify({
      type: 'connection:established',
      data: { userId },
    }));

    setTimeout(() => {
      void this.calls.notifyActiveGroupCalls(userId);
    }, 500);

    authWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as IncomingWsMessage;
        void this.handleMessage(authWs, message);
      } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
      }
    });

    authWs.on('close', async () => {
      const wasLast = this.clients.remove(userId, authWs);
      this.typingUsers.forEach((set) => set.delete(userId));
      this.calls.leaveAll(userId);

      if (wasLast) {
        const seen = new Date();
        await User.findByIdAndUpdate(userId, {
          status: 'offline',
          lastSeen: seen,
        });
        this.broadcastUserStatus(userId, 'offline', seen);
      }
    });

    authWs.on('error', (error) => {
      console.error('WebSocket ошибка:', error);
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: IncomingWsMessage): Promise<void> {
    const userId = ws.userId!;
    const data = (message.data || {}) as Record<string, unknown>;

    switch (message.type) {
      case 'auth':
        break;
      case 'message:send':
        await this.handleSendMessage(userId, data);
        break;
      case 'typing:start':
        this.handleTypingStart(userId, String(data.chatId || ''));
        break;
      case 'typing:stop':
        this.handleTypingStop(userId, String(data.chatId || ''));
        break;
      case 'message:read':
        await this.handleMessageRead(userId, String(data.messageId || ''));
        break;
      case 'call:start':
        await this.calls.handleCallStart(userId, data as { chatId: string; targetUserId?: string; isVideo?: boolean });
        break;
      case 'call:accept':
        this.calls.handleCallAccept(userId, data as { chatId: string; fromUserId: string });
        break;
      case 'call:reject':
        this.calls.handleCallReject(userId, data as { chatId: string; fromUserId: string });
        break;
      case 'call:hangup':
        this.calls.handleCallHangup(userId, data as { targetUserId: string });
        break;
      case 'call:signal':
        this.calls.handleCallSignal(userId, data as { targetUserId: string; signal: unknown });
        break;
      case 'call:join':
        await this.calls.handleCallJoin(userId, data as { chatId: string });
        break;
      case 'call:leave':
        void this.calls.handleCallLeave(userId, data as { chatId: string });
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Неизвестный тип сообщения' },
        }));
    }
  }

  private async handleSendMessage(userId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const chatId = String(data.chatId || '');
      const content = String(data.content || '');
      if (!chatId || !content) {
        this.sendToUser(userId, { type: 'error', data: { message: 'Некорректное сообщение' } });
        return;
      }

      const { dto, chatParticipantIds } = await createMessage({
        chatId,
        senderId: userId,
        content,
        type: typeof data.type === 'string' ? data.type : 'text',
        fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : '',
        replyTo: typeof data.replyTo === 'string' ? data.replyTo : undefined,
      });

      this.broadcastMessage(dto, chatParticipantIds);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      this.sendToUser(userId, { type: 'error', data: { message: 'Не удалось отправить сообщение' } });
    }
  }

  private async handleTypingStart(userId: string, chatId: string): Promise<void> {
    if (!chatId) return;
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }
    this.typingUsers.get(chatId)!.add(userId);
    await this.broadcastTyping(chatId, userId, true);
  }

  private async handleTypingStop(userId: string, chatId: string): Promise<void> {
    const typingSet = this.typingUsers.get(chatId);
    if (typingSet) {
      typingSet.delete(userId);
      await this.broadcastTyping(chatId, userId, false);
    }
  }

  private async broadcastTyping(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const chat = await Chat.findById(chatId).select('participants');
      if (!chat) return;
      const participantIds = chat.participants.map((p) => p.toString());
      this.clients.sendToUsers(participantIds, {
        type: 'typing:update',
        data: { chatId, userId, isTyping },
      }, userId);
    } catch (error) {
      console.error('Ошибка typing broadcast:', error);
    }
  }

  private async handleMessageRead(userId: string, messageId: string): Promise<void> {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const alreadyRead = message.readBy.some((id) => id.toString() === userId);
      if (!alreadyRead) {
        message.readBy.push(userId as unknown as typeof message.readBy[number]);
        await message.save();
      }

      const chat = await Chat.findById(message.chatId);
      if (chat) {
        this.clients.sendToUsers(
          chat.participants.map((p) => p.toString()),
          { type: 'message:read', data: { messageId, userId } },
        );
      }
    } catch (error) {
      console.error('Ошибка обработки прочтения сообщения:', error);
    }
  }

  private broadcastUserStatus(userId: string, status: string, lastSeen?: Date): void {
    this.clients.forEachUser((clientUserId) => {
      if (clientUserId === userId) return;
      this.clients.sendToUser(clientUserId, {
        type: 'user:status',
        data: { userId, status, lastSeen: lastSeen || new Date() },
      });
    });
  }

  public sendToUser(userId: string, data: unknown): void {
    this.clients.sendToUser(userId, data);
  }

  public getActiveGroupCallsForChats(
    chatIds: string[],
  ): Array<{ chatId: string; participants: string[]; isVideo: boolean }> {
    return this.calls.getActiveGroupCallsForChats(chatIds);
  }

  public broadcastChatCreated(chat: { participants?: unknown[] }): void {
    const ids = (chat.participants || [])
      .map((p) => extractParticipantId(p))
      .filter((id): id is string => Boolean(id));
    this.clients.sendToUsers(ids, { type: 'chat:created', data: chat });
  }

  public broadcastChatUpdated(chat: { participants?: unknown[] }): void {
    const ids = (chat.participants || [])
      .map((p) => extractParticipantId(p))
      .filter((id): id is string => Boolean(id));
    this.clients.sendToUsers(ids, { type: 'chat:updated', data: chat });
  }

  public broadcastChatDeleted(chatId: string, participantIds: string[]): void {
    this.clients.sendToUsers(participantIds, { type: 'chat:deleted', data: { chatId } });
  }

  public broadcastRemovedFromGroup(chatId: string, groupName: string, removedParticipantIds: string[]): void {
    this.clients.sendToUsers(removedParticipantIds, {
      type: 'chat:removed-from-group',
      data: { chatId, groupName },
    });
  }

  public broadcastUserUpdated(user: Record<string, unknown>): void {
    const userData = {
      type: 'user:updated',
      data: {
        id: user.id || (user._id != null ? String(user._id) : undefined),
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        lastSeen: user.lastSeen,
      },
    };
    this.clients.forEachUser((userId) => this.clients.sendToUser(userId, userData));
  }

  public broadcastReaction(
    messageId: string,
    reactions: { [emoji: string]: string[] },
    participantIds: string[],
  ): void {
    this.clients.sendToUsers(participantIds, {
      type: 'message:reaction',
      data: { messageId, reactions },
    });
  }

  public broadcastMessage(message: unknown, participantIds: string[]): void {
    this.clients.sendToUsers(participantIds, { type: 'message:new', data: message });
  }

  public broadcastMessageDeleted(chatId: string, messageId: string, participantIds: string[]): void {
    this.clients.sendToUsers(participantIds, {
      type: 'message:deleted',
      data: { chatId, messageId },
    });
  }

  public broadcastMessageEdited(chatId: string, message: unknown, participantIds: string[]): void {
    this.clients.sendToUsers(participantIds, {
      type: 'message:edited',
      data: { chatId, message },
    });
  }
}

export default WebSocketService;
