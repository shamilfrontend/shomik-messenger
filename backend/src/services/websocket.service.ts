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

  /** Групповые созвоны: chatId -> Set участников (userId) */
  private activeGroupCalls: Map<string, Set<string>> = new Map();

  /** Групповой созвон с видео: chatId -> isVideo */
  private activeGroupCallVideo: Map<string, boolean> = new Map();

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

    // Отправляем информацию об активных групповых звонках в чатах пользователя
    // Задержка, чтобы убедиться, что обработчики событий на фронтенде подписаны
    setTimeout(() => {
      void this.notifyActiveGroupCalls(userId);
    }, 500);

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
      this.leaveGroupCall(userId);

      const now = new Date();
      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastSeen: now,
      });

      this.broadcastUserStatus(userId, 'offline', now);
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

      case 'call:start':
        await this.handleCallStart(userId, message.data);
        break;

      case 'call:accept':
        this.handleCallAccept(userId, message.data);
        break;

      case 'call:reject':
        this.handleCallReject(userId, message.data);
        break;

      case 'call:hangup':
        this.handleCallHangup(userId, message.data);
        break;

      case 'call:signal':
        this.handleCallSignal(userId, message.data);
        break;

      case 'call:join':
        await this.handleCallJoin(userId, message.data);
        break;

      case 'call:leave':
        void this.handleCallLeave(userId, message.data);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Неизвестный тип сообщения' },
        }));
    }
  }

  private async handleSendMessage(userId: string, data: any): Promise<void> {
    const {
      chatId, content, type = 'text', fileUrl, replyTo,
    } = data;

    try {
      const chat = await Chat.findById(chatId);

      if (!chat || !chat.participants.includes(userId as any)) {
        return;
      }

      // Проверяем, что replyTo существует и принадлежит этому чату
      let replyToId = null;
      if (replyTo) {
        const replyMessage = await Message.findById(replyTo);
        if (replyMessage && replyMessage.chatId.toString() === chatId) {
          replyToId = replyTo;
        }
      }

      const message = new Message({
        chatId,
        senderId: userId,
        content,
        type,
        fileUrl: fileUrl || '',
        replyTo: replyToId,
      });

      await message.save();
      await message.populate('senderId', 'username avatar status lastSeen');
      if (message.replyTo) {
        await message.populate({
          path: 'replyTo',
          select: 'content senderId type',
          populate: {
            path: 'senderId',
            select: 'username',
          },
        });
      }

      chat.lastMessage = message._id;
      await chat.save();

      // Преобразуем _id в id для senderId и replyTo
      const messageObj = message.toObject() as any;
      if (messageObj.senderId && typeof messageObj.senderId === 'object') {
        messageObj.senderId = {
          id: messageObj.senderId._id.toString(),
          username: messageObj.senderId.username,
          avatar: messageObj.senderId.avatar,
          status: messageObj.senderId.status,
          lastSeen: messageObj.senderId.lastSeen,
        };
      }
      if (messageObj.replyTo && typeof messageObj.replyTo === 'object') {
        const replyToObj: any = {
          _id: messageObj.replyTo._id.toString(),
          content: messageObj.replyTo.content,
          type: messageObj.replyTo.type,
        };
        if (messageObj.replyTo.senderId && typeof messageObj.replyTo.senderId === 'object') {
          replyToObj.senderId = {
            id: messageObj.replyTo.senderId._id.toString(),
            username: messageObj.replyTo.senderId.username,
          };
        }
        messageObj.replyTo = replyToObj;
      }
      // Преобразуем Map reactions в объект
      if (messageObj.reactions && messageObj.reactions instanceof Map) {
        const reactionsObj: { [key: string]: string[] } = {};
        messageObj.reactions.forEach((userIds: any[], emoji: string) => {
          reactionsObj[emoji] = userIds.map((id: any) => id.toString());
        });
        messageObj.reactions = reactionsObj;
      } else if (!messageObj.reactions) {
        messageObj.reactions = {};
      }

      const messageData = {
        type: 'message:new',
        data: messageObj,
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
      data: { chatId, userId, isTyping },
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
            data: { messageId, userId },
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

  private async handleCallStart(callerId: string, data: { chatId: string; targetUserId?: string; isVideo?: boolean }): Promise<void> {
    try {
      const { chatId, targetUserId } = data;
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      const participantIds = chat.participants.map((p: any) => p.toString());
      if (!participantIds.includes(callerId)) return;

      if (chat.type === 'group' && !targetUserId) {
        const isVideo = Boolean(data.isVideo);
        if (!this.activeGroupCalls.has(chatId)) {
          this.activeGroupCalls.set(chatId, new Set());
        }
        this.activeGroupCalls.get(chatId)!.add(callerId);
        this.activeGroupCallVideo.set(chatId, isVideo);
        const participants = Array.from(this.activeGroupCalls.get(chatId)!);
        this.sendToUser(callerId, {
          type: 'call:joined',
          data: {
            chatId, participants, initiatorId: callerId, isVideo,
          },
        });
        participantIds.forEach((pid: string) => {
          if (pid !== callerId) {
            const client = this.clients.get(pid);
            if (client) {
              client.send(JSON.stringify({
                type: 'call:started',
                data: {
                  chatId, participants, initiatorId: callerId, isVideo,
                },
              }));
            }
          }
        });
        return;
      }

      if (chat.type === 'private' && targetUserId) {
        if (!participantIds.includes(targetUserId)) return;
        const targetClient = this.clients.get(targetUserId);
        if (!targetClient) {
          this.sendToUser(callerId, { type: 'call:unavailable', data: { chatId } });
          return;
        }
        const caller = await User.findById(callerId).select('username avatar').lean();
        const isVideo = Boolean(data.isVideo);
        targetClient.send(JSON.stringify({
          type: 'call:incoming',
          data: {
            fromUserId: callerId,
            chatId,
            isVideo,
            caller: caller ? { id: caller._id.toString(), username: caller.username, avatar: caller.avatar } : null,
          },
        }));
      }
    } catch (error) {
      console.error('Ошибка call:start:', error);
    }
  }

  private async handleCallJoin(userId: string, data: { chatId: string }): Promise<void> {
    try {
      const { chatId } = data;
      const chat = await Chat.findById(chatId);
      if (!chat || chat.type !== 'group') return;
      const participantIds = chat.participants.map((p: any) => p.toString());
      if (!participantIds.includes(userId)) return;
      const callSet = this.activeGroupCalls.get(chatId);
      if (!callSet) return;
      callSet.add(userId);
      const participants = Array.from(callSet);
      const others = participants.filter((id: string) => id !== userId);
      const isVideo = this.activeGroupCallVideo.get(chatId) ?? false;
      this.sendToUser(userId, {
        type: 'call:joined',
        data: { chatId, participants: others, isVideo },
      });
      others.forEach((pid: string) => {
        const client = this.clients.get(pid);
        if (client) {
          client.send(JSON.stringify({
            type: 'call:participant_joined',
            data: { chatId, userId },
          }));
        }
      });
    } catch (error) {
      console.error('Ошибка call:join:', error);
    }
  }

  private leaveGroupCall(userId: string): void {
    this.activeGroupCalls.forEach((callSet, chatId) => {
      if (callSet.has(userId)) {
        callSet.delete(userId);
        const participants = Array.from(callSet);
        participants.forEach((pid: string) => {
          const client = this.clients.get(pid);
          if (client) {
            client.send(JSON.stringify({
              type: 'call:participant_left',
              data: { chatId, userId },
            }));
          }
        });
        if (callSet.size === 0) {
          this.activeGroupCalls.delete(chatId);
          this.activeGroupCallVideo.delete(chatId);
        }
      }
    });
  }

  private async notifyActiveGroupCalls(userId: string): Promise<void> {
    try {
      // Находим все групповые чаты, где пользователь является участником
      const userChats = await Chat.find({
        participants: userId,
        type: 'group',
      }).select('_id participants');

      // Проверяем каждый чат на наличие активного звонка
      for (const chat of userChats) {
        const chatId = chat._id.toString();
        const callSet = this.activeGroupCalls.get(chatId);
        if (callSet && callSet.size > 0) {
          const participants = Array.from(callSet).map((pid: string) => pid.toString());
          const isVideo = this.activeGroupCallVideo.get(chatId) ?? false;
          // Отправляем событие о существующем звонке
          const client = this.clients.get(userId);
          if (client) {
            client.send(JSON.stringify({
              type: 'call:started',
              data: { chatId, participants, isVideo },
            }));
          }
        }
      }
    } catch (err) {
      console.error('notifyActiveGroupCalls error:', err);
    }
  }

  private async notifyGroupCallEnded(chatId: string): Promise<void> {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      const participantIds = chat.participants.map((p: any) => p.toString());
      participantIds.forEach((pid: string) => {
        this.sendToUser(pid, { type: 'call:ended', data: {} });
      });
    } catch (err) {
      console.error('notifyGroupCallEnded error:', err);
    }
  }

  private async handleCallLeave(userId: string, data: { chatId: string }): Promise<void> {
    const { chatId } = data;
    const callSet = this.activeGroupCalls.get(chatId);
    if (!callSet || !callSet.has(userId)) return;
    const isVideo = this.activeGroupCallVideo.get(chatId) ?? false;
    callSet.delete(userId);
    const participants = Array.from(callSet);
    participants.forEach((pid: string) => {
      const client = this.clients.get(pid);
      if (client) {
        client.send(JSON.stringify({
          type: 'call:participant_left',
          data: { chatId, userId },
        }));
      }
    });
    if (callSet.size === 0) {
      await this.notifyGroupCallEnded(chatId);
      this.activeGroupCalls.delete(chatId);
      this.activeGroupCallVideo.delete(chatId);
    } else {
      if (participants.length === 1) {
        await this.notifyGroupCallEnded(chatId);
        this.activeGroupCalls.delete(chatId);
        this.activeGroupCallVideo.delete(chatId);
      }
      // Не отправляем call:started пользователю, который сам вышел из звонка
      // Он уже завершил звонок и не должен видеть возможность переподключиться
    }
  }

  private handleCallAccept(acceptorId: string, data: { chatId: string; fromUserId: string }): void {
    const { fromUserId } = data;
    const callerClient = this.clients.get(fromUserId);
    if (callerClient) {
      callerClient.send(JSON.stringify({
        type: 'call:accepted',
        data: { chatId: data.chatId, acceptedByUserId: acceptorId },
      }));
    }
  }

  private handleCallReject(rejectorId: string, data: { chatId: string; fromUserId: string }): void {
    const { fromUserId } = data;
    const callerClient = this.clients.get(fromUserId);
    if (callerClient) {
      callerClient.send(JSON.stringify({
        type: 'call:rejected',
        data: { chatId: data.chatId },
      }));
    }
  }

  private handleCallHangup(userId: string, data: { targetUserId: string }): void {
    const targetClient = this.clients.get(data.targetUserId);
    if (targetClient) {
      targetClient.send(JSON.stringify({ type: 'call:ended', data: { byUserId: userId } }));
    }
  }

  private handleCallSignal(userId: string, data: { targetUserId: string; signal: any }): void {
    const targetClient = this.clients.get(data.targetUserId);
    if (targetClient) {
      targetClient.send(JSON.stringify({
        type: 'call:signal',
        data: { fromUserId: userId, signal: data.signal },
      }));
    }
  }

  private broadcastUserStatus(userId: string, status: string, lastSeen?: Date): void {
    const statusData = {
      type: 'user:status',
      data: { userId, status, lastSeen: lastSeen || new Date() },
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

  public getActiveGroupCallsForChats(chatIds: string[]): Array<{ chatId: string; participants: string[]; isVideo: boolean }> {
    const result: Array<{ chatId: string; participants: string[]; isVideo: boolean }> = [];
    chatIds.forEach((chatId) => {
      const callSet = this.activeGroupCalls.get(chatId);
      if (callSet && callSet.size > 0) {
        const participants = Array.from(callSet).map((pid: string) => pid.toString());
        const isVideo = this.activeGroupCallVideo.get(chatId) ?? false;
        result.push({ chatId, participants, isVideo });
      }
    });
    return result;
  }

  public broadcastChatCreated(chat: any): void {
    const chatData = {
      type: 'chat:created',
      data: chat,
    };

    // Отправляем событие всем участникам чата
    chat.participants.forEach((participant: any) => {
      let participantId: string;

      if (typeof participant === 'string') {
        participantId = participant;
      } else if (participant.id) {
        participantId = participant.id;
      } else if (participant._id) {
        participantId = participant._id.toString();
      } else {
        return; // Пропускаем, если не можем определить ID
      }

      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(chatData));
          console.log(`Отправлено событие chat:created пользователю ${participantId}`);
        } catch (error) {
          console.error(`Ошибка отправки события пользователю ${participantId}:`, error);
        }
      } else {
        console.log(`Пользователь ${participantId} не подключен к WebSocket`);
      }
    });
  }

  public broadcastChatUpdated(chat: any): void {
    const chatData = {
      type: 'chat:updated',
      data: chat,
    };

    // Отправляем событие всем участникам чата
    chat.participants.forEach((participant: any) => {
      let participantId: string;

      if (typeof participant === 'string') {
        participantId = participant;
      } else if (participant.id) {
        participantId = participant.id;
      } else if (participant._id) {
        participantId = participant._id.toString();
      } else {
        return;
      }

      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(chatData));
        } catch (error) {
          console.error(`Ошибка отправки события chat:updated пользователю ${participantId}:`, error);
        }
      }
    });
  }

  public broadcastChatDeleted(chatId: string, participantIds: string[]): void {
    const chatData = {
      type: 'chat:deleted',
      data: { chatId },
    };

    participantIds.forEach((participantId: string) => {
      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(chatData));
        } catch (error) {
          console.error(`Ошибка отправки события chat:deleted пользователю ${participantId}:`, error);
        }
      }
    });
  }

  /** Отправка удалённым участникам группы: их исключили из группы (редирект + уведомление с названием). */
  public broadcastRemovedFromGroup(chatId: string, groupName: string, removedParticipantIds: string[]): void {
    const payload = {
      type: 'chat:removed-from-group',
      data: { chatId, groupName },
    };

    removedParticipantIds.forEach((participantId: string) => {
      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(payload));
        } catch (error) {
          console.error(`Ошибка отправки chat:removed-from-group пользователю ${participantId}:`, error);
        }
      }
    });
  }

  public broadcastUserUpdated(user: any): void {
    const userData = {
      type: 'user:updated',
      data: {
        id: user.id || user._id?.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        lastSeen: user.lastSeen,
      },
    };

    // Отправляем событие всем подключенным клиентам, включая самого пользователя
    // Это необходимо для обновления аватара в его собственных сообщениях
    this.clients.forEach((client, clientUserId) => {
      try {
        client.send(JSON.stringify(userData));
      } catch (error) {
        console.error(`Ошибка отправки события user:updated пользователю ${clientUserId}:`, error);
      }
    });
  }

  public broadcastReaction(messageId: string, reactions: { [emoji: string]: string[] }, participantIds: string[]): void {
    const reactionData = {
      type: 'message:reaction',
      data: {
        messageId,
        reactions,
      },
    };

    participantIds.forEach((participantId) => {
      const client = this.clients.get(participantId);
      if (client && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(reactionData));
        } catch (error) {
          console.error(`Ошибка отправки события message:reaction пользователю ${participantId}:`, error);
        }
      }
    });
  }

  public broadcastMessage(message: any, participantIds: string[]): void {
    const messageData = {
      type: 'message:new',
      data: message,
    };

    participantIds.forEach((participantId: string) => {
      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(messageData));
        } catch (error) {
          console.error(`Ошибка отправки сообщения пользователю ${participantId}:`, error);
        }
      }
    });
  }

  public broadcastMessageDeleted(chatId: string, messageId: string, participantIds: string[]): void {
    const messageData = {
      type: 'message:deleted',
      data: {
        chatId,
        messageId,
      },
    };

    participantIds.forEach((participantId: string) => {
      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(messageData));
        } catch (error) {
          console.error(`Ошибка отправки события удаления сообщения пользователю ${participantId}:`, error);
        }
      }
    });
  }

  public broadcastMessageEdited(chatId: string, message: any, participantIds: string[]): void {
    const messageData = {
      type: 'message:edited',
      data: {
        chatId,
        message,
      },
    };

    participantIds.forEach((participantId: string) => {
      const client = this.clients.get(participantId);
      if (client) {
        try {
          client.send(JSON.stringify(messageData));
        } catch (error) {
          console.error(`Ошибка отправки события редактирования сообщения пользователю ${participantId}:`, error);
        }
      }
    });
  }
}

export default WebSocketService;
