import mongoose from 'mongoose';
import Message from '../models/Message.model';
import Chat from '../models/Chat.model';
import { serializeMessage, MessageDto } from '../serializers/message.serializer';
import { getWebSocketService } from './wsRegistry';
import { sanitizeFileUrl, sanitizeMessageType } from '../utils/sanitize';
import { HttpError } from '../utils/errors';
import { isChatMember, getParticipantIds } from './chat.service';

export const MESSAGE_POPULATE = [
  { path: 'senderId', select: 'username avatar status lastSeen' },
  {
    path: 'replyTo',
    select: 'content senderId type',
    populate: { path: 'senderId', select: 'username' },
  },
] as const;

export const createMessage = async (params: {
  chatId: string;
  senderId: string;
  content: string;
  type?: string;
  fileUrl?: string;
  replyTo?: string;
  isSystem?: boolean;
  readBy?: mongoose.Types.ObjectId[];
}): Promise<{ dto: MessageDto; chatParticipantIds: string[] }> => {
  const chat = await Chat.findById(params.chatId);
  if (!chat) {
    throw new HttpError(404, 'Чат не найден');
  }

  const participantIds = getParticipantIds(chat);
  if (!params.isSystem && !isChatMember(chat, params.senderId)) {
    throw new HttpError(403, 'Нет доступа к этому чату');
  }

  let replyToId: string | null = null;
  if (params.replyTo && !params.isSystem) {
    const replyMessage = await Message.findById(params.replyTo);
    if (replyMessage && replyMessage.chatId.toString() === params.chatId) {
      replyToId = params.replyTo;
    }
  }

  const type = params.isSystem ? 'system' : sanitizeMessageType(params.type);
  const fileUrl = params.isSystem ? '' : sanitizeFileUrl(params.fileUrl);

  const message = new Message({
    chatId: params.chatId,
    senderId: params.senderId,
    content: params.content,
    type,
    fileUrl,
    replyTo: replyToId,
    readBy: params.readBy,
  });

  await message.save();
  await message.populate([
    { path: 'senderId', select: 'username avatar status lastSeen' },
    {
      path: 'replyTo',
      select: 'content senderId type',
      populate: { path: 'senderId', select: 'username' },
    },
  ]);

  chat.lastMessage = message._id;
  await chat.save();

  const dto = serializeMessage(message);
  if (!dto) {
    throw new Error('Не удалось сериализовать сообщение');
  }

  return { dto, chatParticipantIds: participantIds };
};

export const createAndBroadcastMessage = async (params: {
  chatId: string;
  senderId: string;
  content: string;
  type?: string;
  fileUrl?: string;
  replyTo?: string;
  isSystem?: boolean;
  readBy?: mongoose.Types.ObjectId[];
}): Promise<MessageDto> => {
  const { dto, chatParticipantIds } = await createMessage(params);
  getWebSocketService()?.broadcastMessage(dto, chatParticipantIds);
  return dto;
};

export const getUnreadCounts = async (
  userId: string,
  chatIds: string[],
): Promise<Map<string, number>> => {
  const result = new Map<string, number>();
  if (chatIds.length === 0) return result;

  const objectIds = chatIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const rows = await Message.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    {
      $match: {
        chatId: { $in: objectIds },
        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        type: { $ne: 'system' },
        readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
    },
    { $group: { _id: '$chatId', count: { $sum: 1 } } },
  ]);

  rows.forEach((row) => {
    result.set(row._id.toString(), row.count);
  });

  return result;
};
