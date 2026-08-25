import Chat from '../../models/Chat.model';
import User from '../../models/User.model';
import { ClientRegistry } from './clients';

export class GroupCallState {
  private activeGroupCalls: Map<string, Set<string>> = new Map();

  private activeGroupCallVideo: Map<string, boolean> = new Map();

  constructor(private clients: ClientRegistry) {}

  getActiveGroupCallsForChats(
    chatIds: string[],
  ): Array<{ chatId: string; participants: string[]; isVideo: boolean }> {
    const result: Array<{ chatId: string; participants: string[]; isVideo: boolean }> = [];
    chatIds.forEach((chatId) => {
      const callSet = this.activeGroupCalls.get(chatId);
      if (callSet && callSet.size > 0) {
        result.push({
          chatId,
          participants: Array.from(callSet),
          isVideo: this.activeGroupCallVideo.get(chatId) ?? false,
        });
      }
    });
    return result;
  }

  leaveAll(userId: string): void {
    this.activeGroupCalls.forEach((callSet, chatId) => {
      if (callSet.has(userId)) {
        callSet.delete(userId);
        const participants = Array.from(callSet);
        this.clients.sendToUsers(participants, {
          type: 'call:participant_left',
          data: { chatId, userId },
        });
        if (callSet.size === 0) {
          this.activeGroupCalls.delete(chatId);
          this.activeGroupCallVideo.delete(chatId);
        }
      }
    });
  }

  async notifyActiveGroupCalls(userId: string): Promise<void> {
    try {
      const userChats = await Chat.find({
        participants: userId,
        type: 'group',
      }).select('_id');

      userChats.forEach((chat) => {
        const chatId = chat._id.toString();
        const callSet = this.activeGroupCalls.get(chatId);
        if (callSet && callSet.size > 0) {
          const isVideo = this.activeGroupCallVideo.get(chatId) ?? false;
          this.clients.sendToUser(userId, {
            type: 'call:started',
            data: { chatId, participants: Array.from(callSet), isVideo },
          });
        }
      });
    } catch (err) {
      console.error('notifyActiveGroupCalls error:', err);
    }
  }

  private async notifyGroupCallEnded(chatId: string): Promise<void> {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      const participantIds = chat.participants.map((p) => p.toString());
      this.clients.sendToUsers(participantIds, { type: 'call:ended', data: {} });
    } catch (err) {
      console.error('notifyGroupCallEnded error:', err);
    }
  }

  async handleCallStart(
    callerId: string,
    data: { chatId: string; targetUserId?: string; isVideo?: boolean },
  ): Promise<void> {
    try {
      const { chatId, targetUserId } = data;
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      const participantIds = chat.participants.map((p) => p.toString());
      if (!participantIds.includes(callerId)) return;

      if (chat.type === 'group' && !targetUserId) {
        const isVideo = Boolean(data.isVideo);
        if (!this.activeGroupCalls.has(chatId)) {
          this.activeGroupCalls.set(chatId, new Set());
        }
        this.activeGroupCalls.get(chatId)!.add(callerId);
        this.activeGroupCallVideo.set(chatId, isVideo);
        const participants = Array.from(this.activeGroupCalls.get(chatId)!);
        this.clients.sendToUser(callerId, {
          type: 'call:joined',
          data: {
            chatId, participants, initiatorId: callerId, isVideo,
          },
        });
        this.clients.sendToUsers(participantIds, {
          type: 'call:started',
          data: {
            chatId, participants, initiatorId: callerId, isVideo,
          },
        }, callerId);
        return;
      }

      if (chat.type === 'private' && targetUserId) {
        if (!participantIds.includes(targetUserId)) return;
        if (!this.clients.isOnline(targetUserId)) {
          this.clients.sendToUser(callerId, { type: 'call:unavailable', data: { chatId } });
          return;
        }
        const caller = await User.findById(callerId).select('username avatar').lean();
        const isVideo = Boolean(data.isVideo);
        this.clients.sendToUser(targetUserId, {
          type: 'call:incoming',
          data: {
            fromUserId: callerId,
            chatId,
            isVideo,
            caller: caller ? { id: caller._id.toString(), username: caller.username, avatar: caller.avatar } : null,
          },
        });
      }
    } catch (error) {
      console.error('Ошибка call:start:', error);
    }
  }

  async handleCallJoin(userId: string, data: { chatId: string }): Promise<void> {
    try {
      const { chatId } = data;
      const chat = await Chat.findById(chatId);
      if (!chat || chat.type !== 'group') return;
      const participantIds = chat.participants.map((p) => p.toString());
      if (!participantIds.includes(userId)) return;
      const callSet = this.activeGroupCalls.get(chatId);
      if (!callSet) return;
      callSet.add(userId);
      const participants = Array.from(callSet);
      const others = participants.filter((id) => id !== userId);
      const isVideo = this.activeGroupCallVideo.get(chatId) ?? false;
      this.clients.sendToUser(userId, {
        type: 'call:joined',
        data: { chatId, participants: others, isVideo },
      });
      this.clients.sendToUsers(others, {
        type: 'call:participant_joined',
        data: { chatId, userId },
      });
    } catch (error) {
      console.error('Ошибка call:join:', error);
    }
  }

  async handleCallLeave(userId: string, data: { chatId: string }): Promise<void> {
    const { chatId } = data;
    const callSet = this.activeGroupCalls.get(chatId);
    if (!callSet || !callSet.has(userId)) return;
    callSet.delete(userId);
    const participants = Array.from(callSet);
    this.clients.sendToUsers(participants, {
      type: 'call:participant_left',
      data: { chatId, userId },
    });
    if (callSet.size === 0 || participants.length === 1) {
      await this.notifyGroupCallEnded(chatId);
      this.activeGroupCalls.delete(chatId);
      this.activeGroupCallVideo.delete(chatId);
    }
  }

  handleCallAccept(acceptorId: string, data: { chatId: string; fromUserId: string }): void {
    this.clients.sendToUser(data.fromUserId, {
      type: 'call:accepted',
      data: { chatId: data.chatId, acceptedByUserId: acceptorId },
    });
  }

  handleCallReject(_rejectorId: string, data: { chatId: string; fromUserId: string }): void {
    this.clients.sendToUser(data.fromUserId, {
      type: 'call:rejected',
      data: { chatId: data.chatId },
    });
  }

  handleCallHangup(userId: string, data: { targetUserId: string }): void {
    this.clients.sendToUser(data.targetUserId, { type: 'call:ended', data: { byUserId: userId } });
  }

  handleCallSignal(userId: string, data: { targetUserId: string; signal: unknown }): void {
    this.clients.sendToUser(data.targetUserId, {
      type: 'call:signal',
      data: { fromUserId: userId, signal: data.signal },
    });
  }
}
