export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
  contacts?: string[];
}

export interface Chat {
  _id: string;
  type: 'private' | 'group';
  participants: User[];
  groupName?: string;
  groupAvatar?: string;
  admin?: User;
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  _id: string;
  chatId: string;
  senderId: User | string;
  content: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  readBy: string[];
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
