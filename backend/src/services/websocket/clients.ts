import { WebSocket } from 'ws';
import { AuthenticatedWebSocket } from '../../middleware/websocket.middleware';

export class ClientRegistry {
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  add(userId: string, ws: AuthenticatedWebSocket): void {
    const set = this.clients.get(userId) ?? new Set();
    set.add(ws);
    this.clients.set(userId, set);
  }

  remove(userId: string, ws: AuthenticatedWebSocket): boolean {
    const set = this.clients.get(userId);
    if (!set) return true;
    set.delete(ws);
    if (set.size === 0) {
      this.clients.delete(userId);
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return (this.clients.get(userId)?.size ?? 0) > 0;
  }

  sendToUser(userId: string, payload: unknown): void {
    const set = this.clients.get(userId);
    if (!set) return;
    const raw = JSON.stringify(payload);
    set.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch (error) {
          console.error(`Ошибка отправки пользователю ${userId}:`, error);
        }
      }
    });
  }

  sendToUsers(userIds: string[], payload: unknown, exceptUserId?: string): void {
    userIds.forEach((userId) => {
      if (exceptUserId && userId === exceptUserId) return;
      this.sendToUser(userId, payload);
    });
  }

  forEachUser(callback: (userId: string) => void): void {
    this.clients.forEach((_set, userId) => callback(userId));
  }
}

export const extractParticipantId = (participant: unknown): string | null => {
  if (typeof participant === 'string') return participant;
  if (participant && typeof participant === 'object') {
    const obj = participant as { id?: unknown; _id?: unknown };
    if (obj.id) return String(obj.id);
    if (obj._id) return String(obj._id);
  }
  return null;
};
