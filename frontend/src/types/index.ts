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
  };
}

export interface Chat {
  _id: string;
  type: 'private' | 'group';
  participants: User[];
  groupName?: string;
  groupAvatar?: string;
  admin?: User;
  lastMessage?: Message;
  pinnedMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
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

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface AuthResponse {
  token: string;
  user: User;
}
