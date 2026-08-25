export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
  contacts?: string[];
  pinnedChats?: string[];
  params?: {
    messageTextSize?: number;
    theme?: string;
    /** Включён ли раздел «Задачи» в нижней навигации. По умолчанию false. */
    tasks?: boolean;
    /** Идентификаторы чатов с отключёнными уведомлениями (звук и т.п.). */
    mutedChats?: string[];
  };
}

export interface Chat {
  id: string;
  /** тот же идентификатор, что и id — для совместимости */
  _id: string;
  type: 'private' | 'group';
  participants: User[];
  groupName?: string;
  groupAvatar?: string;
  admin?: User;
  lastMessage?: Message;
  pinnedMessage?: Message;
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  /** тот же идентификатор, что и id — для совместимости */
  _id: string;
  chatId: string;
  senderId: User | string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  fileUrl?: string;
  replyTo?: Message | string;
  readBy: string[];
  reactions?: { [emoji: string]: string[] };
  createdAt: Date;
  updatedAt: Date;
}

export type WebSocketEventType =
  | 'connection:established'
  | 'message:new'
  | 'message:read'
  | 'message:reaction'
  | 'message:deleted'
  | 'message:edited'
  | 'typing:update'
  | 'user:status'
  | 'user:updated'
  | 'chat:created'
  | 'chat:updated'
  | 'chat:deleted'
  | 'chat:removed-from-group'
  | 'call:incoming'
  | 'call:accepted'
  | 'call:rejected'
  | 'call:ended'
  | 'call:signal'
  | 'call:unavailable'
  | 'call:started'
  | 'call:joined'
  | 'call:participant_joined'
  | 'call:participant_left'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketEventType | string;
  data: unknown;
}

export interface AuthResponse {
  token: string;
  user: User;
}
