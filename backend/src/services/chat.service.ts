import mongoose from 'mongoose';
import Chat, { IChat } from '../models/Chat.model';
import { serializeChat, ChatDto, participantId } from '../serializers/chat.serializer';
import { HttpError } from '../utils/errors';

export const CHAT_POPULATE = [
  { path: 'participants', select: 'username avatar status lastSeen' },
  {
    path: 'lastMessage',
    populate: { path: 'senderId', select: 'username avatar status lastSeen' },
  },
  {
    path: 'pinnedMessage',
    populate: { path: 'senderId', select: 'username avatar status lastSeen' },
  },
  { path: 'admin', select: 'username avatar' },
];

export const parseObjectId = (id: unknown, label = 'ID'): mongoose.Types.ObjectId => {
  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, `Невалидный ${label}`);
  }
  return new mongoose.Types.ObjectId(id);
};

export const parseObjectIds = (ids: unknown[], label = 'ID участника'): mongoose.Types.ObjectId[] => (
  ids.map((id) => parseObjectId(id, label))
);

export const isChatMember = (chat: { participants: unknown[] }, userId: string): boolean => (
  chat.participants.some((p) => participantId(p) === userId)
);

export const getParticipantIds = (chat: { participants: unknown[] }): string[] => (
  chat.participants.map((p) => participantId(p)).filter(Boolean)
);

export const assertChatMember = <T extends { participants: unknown[] }>(
  chat: T | null | undefined,
  userId: string | undefined,
): T => {
  if (!chat) {
    throw new HttpError(404, 'Чат не найден');
  }
  if (!userId || !isChatMember(chat, userId)) {
    throw new HttpError(403, 'Нет доступа к этому чату');
  }
  return chat;
};

export const findChatForUser = async (chatId: string, userId: string): Promise<IChat> => {
  parseObjectId(chatId, 'ID чата');
  const chat = await Chat.findById(chatId);
  return assertChatMember(chat, userId);
};

export const populateChat = async (chatId: string) => Chat.findById(chatId).populate(CHAT_POPULATE);

export const toChatDto = (chat: unknown, unreadCount = 0): ChatDto => {
  const dto = serializeChat(chat, { unreadCount });
  if (!dto) {
    throw new Error('Не удалось сериализовать чат');
  }
  return dto;
};
