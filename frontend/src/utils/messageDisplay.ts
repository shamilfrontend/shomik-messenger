import type { Chat, Message, User } from '../types';
import { participantId } from './chatDisplay';
import { getImageUrl } from './image';
import { getComputedStatus } from './status';

export const MAX_MESSAGE_LENGTH = 500;

export const AVAILABLE_REACTIONS = ['👍', '😂', '🔥', '❤️', '👎', '👀', '💯'];

export const isSenderIdUser = (senderId: User | string): senderId is User => (
  typeof senderId === 'object' && senderId !== null && 'id' in senderId
);

export const getMessageSenderId = (message: Message): string => (
  isSenderIdUser(message.senderId) ? message.senderId.id : message.senderId
);

export const isMessageSenderUser = (message: Message): boolean => isSenderIdUser(message.senderId);

export const getMessageSender = (message: Message): string => {
  if (!isSenderIdUser(message.senderId)) {
    return 'Пользователь';
  }
  return message.senderId.username || 'Пользователь';
};

export const getMessageAvatar = (message: Message): string | undefined => {
  if (!isSenderIdUser(message.senderId)) {
    return undefined;
  }
  return getImageUrl(message.senderId.avatar);
};

export const getMessageSenderStatus = (message: Message): 'online' | 'offline' | 'away' => (
  isSenderIdUser(message.senderId) ? getComputedStatus(message.senderId) : 'offline'
);

export const isOwnMessage = (message: Message, currentUserId?: string): boolean => (
  getMessageSenderId(message) === currentUserId
);

export const isGroupAdmin = (chat: Chat | null | undefined, currentUserId?: string): boolean => {
  if (!chat || chat.type !== 'group' || !chat.admin || !currentUserId) {
    return false;
  }
  const admin = chat.admin as User | string;
  const adminId = typeof admin === 'string' ? admin : admin.id;
  return adminId === currentUserId;
};

export const canDeleteMessage = (
  message: Message,
  chat: Chat | null | undefined,
  currentUserId?: string,
): boolean => {
  if (message.type === 'system') {
    return false;
  }
  if (isOwnMessage(message, currentUserId)) {
    return true;
  }
  return chat?.type === 'group' && isGroupAdmin(chat, currentUserId);
};

export const canEditMessage = (message: Message, currentUserId?: string): boolean => (
  message.type === 'text' && isOwnMessage(message, currentUserId)
);

export const shouldTruncateMessage = (message: Message): boolean => {
  const { content } = message;
  if (typeof content !== 'string' || content.length <= MAX_MESSAGE_LENGTH) {
    return false;
  }
  if (message.type === 'image' || message.type === 'file' || message.type === 'system') {
    return false;
  }
  return true;
};

export const getTruncatedText = (content: string): string => {
  if (typeof content !== 'string') return String(content ?? '');
  if (content.length <= MAX_MESSAGE_LENGTH) return content;
  return `${content.slice(0, MAX_MESSAGE_LENGTH)}...`;
};

export const getReplyToSenderName = (
  replyTo: Message | string | null | undefined,
  currentUserId?: string,
): string => {
  if (!replyTo || typeof replyTo === 'string') {
    return 'Пользователь';
  }
  if (!replyTo.senderId) {
    return 'Пользователь';
  }
  if (!isSenderIdUser(replyTo.senderId)) {
    return 'Пользователь';
  }
  if (currentUserId && replyTo.senderId.id === currentUserId) {
    return 'Вы';
  }
  return replyTo.senderId.username || 'Пользователь';
};

export const getReplyToText = (replyTo: Message | string | null | undefined): string => {
  if (!replyTo || typeof replyTo === 'string') {
    return '';
  }
  if (replyTo.type === 'image') {
    return '📷 Фото';
  }
  if (replyTo.type === 'file') {
    return '📎 Файл';
  }
  return getTruncatedText(replyTo.content || '');
};

export const isOnlyEmojis = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false;

  const trimmedContent = content.trim();
  if (!trimmedContent) return false;

  let text = trimmedContent.replace(/\[icq:[^\]]+\.gif\]/g, '');
  text = text.replace(/\s+/g, '');

  if (!text) {
    return /\[icq:[^\]]+\.gif\]/.test(trimmedContent);
  }

  const hasRegularChars = /[a-zA-Z0-9\u0400-\u04FF\u0500-\u052F\uA640-\uA69F\u0021-\u007E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/u.test(text);

  if (hasRegularChars) {
    return false;
  }

  try {
    const emojiPattern = /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{FE0F}\u{200D}]+$/u;
    return emojiPattern.test(text);
  } catch {
    return !/[!-~]/.test(text);
  }
};

export const isSticker = (message: Message): boolean => {
  if (message.type !== 'image' || !message.fileUrl) return false;
  const url = typeof message.fileUrl === 'string' ? message.fileUrl : '';
  if (url.includes('/stickers/')) return true;
  if (url.startsWith('data:image')) {
    const trimmedContent = (message.content || '').trim();
    return /^\d+\.png$/.test(trimmedContent) || trimmedContent === 'sticker.png';
  }
  return false;
};

export const isOnlyStickerOrEmoji = (message: Message): boolean => {
  if (isSticker(message)) {
    const content = message.content || '';
    const url = typeof message.fileUrl === 'string' ? message.fileUrl : '';
    const filename = url.includes('/') && !url.startsWith('data:') ? url.split('/').pop() : '';
    const trimmedContent = content.trim();
    return !trimmedContent
      || trimmedContent === filename
      || trimmedContent === 'sticker.png'
      || /^\d+\.png$/.test(trimmedContent);
  }
  if (message.type === 'text') {
    return isOnlyEmojis(message.content || '');
  }
  return false;
};

export const getReadStatus = (
  message: Message,
  chat: Chat | null | undefined,
  currentUserId?: string,
): 'sent' | 'delivered' | 'read' => {
  if (!isOwnMessage(message, currentUserId) || !chat) {
    return 'sent';
  }

  if (chat.type === 'private') {
    const otherParticipant = chat.participants.find((p) => participantId(p) !== currentUserId);

    if (!otherParticipant) {
      return 'delivered';
    }

    if (message.readBy.includes(participantId(otherParticipant))) {
      return 'read';
    }

    return 'delivered';
  }

  if (chat.type === 'group') {
    const otherParticipants = chat.participants.filter((p) => participantId(p) !== currentUserId);

    if (otherParticipants.length === 0) {
      return 'delivered';
    }

    const allRead = otherParticipants.every((p) => message.readBy.includes(participantId(p)));
    return allRead ? 'read' : 'delivered';
  }

  return 'delivered';
};

export const hasUserReaction = (message: Message, emoji: string, currentUserId?: string): boolean => {
  if (!message.reactions || !currentUserId) {
    return false;
  }
  const userIds = message.reactions[emoji] || [];
  return userIds.includes(currentUserId);
};

export const getReactionsArray = (
  message: Message,
  currentUserId?: string,
): Array<{ emoji: string; count: number; hasUser: boolean }> => {
  if (!message.reactions) {
    return [];
  }
  return Object.entries(message.reactions)
    .map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      hasUser: hasUserReaction(message, emoji, currentUserId),
    }))
    .filter((reaction) => reaction.count > 0)
    .sort((a, b) => b.count - a.count);
};

export const getReactionUsers = (
  message: Message,
  emoji: string,
  chat: Chat | null | undefined,
): Array<{ id: string; username: string }> => {
  if (!chat) return [];
  const ids = message.reactions?.[emoji] ?? [];
  return ids.map((userId) => {
    const p = chat.participants.find((participant) => participantId(participant) === userId);
    const username = p && typeof p !== 'string' ? p.username : `${userId.slice(0, 8)}…`;
    return { id: userId, username };
  });
};
