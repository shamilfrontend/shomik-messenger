import { WebSocketMessage } from '../types';

function getWsBaseUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return 'wss://shomik-messenger.ru';
}

class WebSocketService {
  private ws: WebSocket | null = null;

  private intentionalDisconnect = false;

  private reconnectAttempts = 0;

  private maxReconnectAttempts = 5;

  private reconnectDelay = 3000;

  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(token: string): Promise<void> {
    this.intentionalDisconnect = false;

    return new Promise((resolve, reject) => {
      let settled = false;
      const succeed = (): void => {
        if (settled) return;
        settled = true;
        this.reconnectAttempts = 0;
        resolve();
      };
      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        this.ws = new WebSocket(`${getWsBaseUrl()}/ws`);

        this.ws.onopen = () => {
          this.ws?.send(JSON.stringify({ type: 'auth', data: { token } }));
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            if (message.type === 'connection:established') {
              succeed();
            }
            this.handleMessage(message);
          } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket ошибка:', error);
          fail(error);
        };

        this.ws.onclose = (event: CloseEvent) => {
          if (!settled) {
            fail(new Error(event.reason || `WebSocket closed (${event.code})`));
          }
          if (event.code === 1006) {
            console.warn('WebSocket: код 1006 — соединение закрыто без frame');
          }
          if (!this.intentionalDisconnect) {
            this.attemptReconnect(token);
          }
        };
      } catch (error) {
        fail(error);
      }
    });
  }

  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      setTimeout(() => {
        this.connect(token).catch(() => {});
      }, this.reconnectDelay);
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach((listener) => listener(message.data));
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  send(type: string, data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.error('WebSocket не подключен');
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}

export default new WebSocketService();
