import type WebSocketService from './websocket.service';

let instance: WebSocketService | null = null;

export const setWebSocketService = (service: WebSocketService): void => {
  instance = service;
};

export const getWebSocketService = (): WebSocketService | null => instance;
