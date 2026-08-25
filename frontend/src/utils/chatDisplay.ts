import type { Chat, User } from '../types';
import { getImageUrl } from './image';
import { isUserOnline } from './status';

export const participantId = (participant: User | string): string => (
  typeof participant === 'string' ? participant : participant.id
);

export const getOtherParticipant = (chat: Chat | null | undefined, currentUserId?: string): User | null => {
  if (!chat || chat.type === 'group' || !currentUserId) return null;
  const other = chat.participants.find((p) => participantId(p) !== currentUserId);
  if (!other || typeof other === 'string') return null;
  return other;
};

export const getChatName = (
  chat: Chat | null | undefined,
  currentUserId?: string,
  fallbackUser?: User | null,
): string => {
  if (fallbackUser) return fallbackUser.username || 'Пользователь';
  if (!chat) return '';
  if (chat.type === 'group') return chat.groupName || 'Группа';
  const other = getOtherParticipant(chat, currentUserId);
  return other?.username || 'Пользователь';
};

export const getChatAvatar = (
  chat: Chat | null | undefined,
  currentUserId?: string,
  fallbackUser?: User | null,
): string | undefined => {
  if (fallbackUser) return getImageUrl(fallbackUser.avatar);
  if (!chat) return undefined;
  if (chat.type === 'group') return getImageUrl(chat.groupAvatar);
  const other = getOtherParticipant(chat, currentUserId);
  return getImageUrl(other?.avatar);
};

export const getChatStatusLabel = (
  chat: Chat | null | undefined,
  currentUserId?: string,
  fallbackUser?: User | null,
): string => {
  if (fallbackUser) return isUserOnline(fallbackUser) ? 'в сети' : 'не в сети';
  if (!chat || chat.type === 'group') return '';
  const other = getOtherParticipant(chat, currentUserId);
  if (!other) return '';
  return isUserOnline(other) ? 'в сети' : 'не в сети';
};

export const entityId = (entity: { id?: string; _id?: string } | string | null | undefined): string => {
  if (!entity) return '';
  if (typeof entity === 'string') return entity;
  return entity.id || entity._id || '';
};

export const getChatNameById = (
  chats: Chat[],
  chatId: string,
  currentUserId?: string,
): string => {
  const chat = chats.find((c) => entityId(c) === chatId);
  return getChatName(chat, currentUserId) || 'Чат';
};

export const getParticipantUsername = (
  chats: Chat[],
  chatId: string,
  userId: string,
): string => {
  const chat = chats.find((c) => entityId(c) === chatId);
  if (!chat) return userId.slice(0, 8);
  const p = chat.participants.find((participant) => participantId(participant) === userId);
  return p && typeof p !== 'string' ? p.username : userId.slice(0, 8);
};
