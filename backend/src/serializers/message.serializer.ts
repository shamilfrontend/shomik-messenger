import mongoose from 'mongoose';
import { serializeUser, toId } from './user.serializer';

export interface MessageDto {
  id: string;
  _id: string;
  chatId: string;
  senderId: ReturnType<typeof serializeUser> | string;
  content: string;
  type: string;
  fileUrl?: string;
  replyTo?: Partial<MessageDto> | string | null;
  readBy: string[];
  reactions: { [emoji: string]: string[] };
  createdAt?: Date;
  updatedAt?: Date;
}

const serializeReactions = (reactions: unknown): { [emoji: string]: string[] } => {
  const result: { [emoji: string]: string[] } = {};
  if (!reactions) return result;

  if (reactions instanceof Map) {
    reactions.forEach((userIds: unknown, emoji: unknown) => {
      if (typeof emoji !== 'string') return;
      const ids = Array.isArray(userIds) ? userIds : [];
      result[emoji] = ids.map((id) => toId(id));
    });
    return result;
  }

  if (typeof reactions === 'object') {
    Object.entries(reactions as Record<string, unknown>).forEach(([emoji, userIds]) => {
      const ids = Array.isArray(userIds) ? userIds : [];
      result[emoji] = ids.map((id) => toId(id));
    });
  }

  return result;
};

export const serializeMessage = (message: unknown): MessageDto | null => {
  if (!message || typeof message !== 'object') return null;

  const raw = typeof (message as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (message as { toObject: () => Record<string, unknown> }).toObject()
    : (message as Record<string, unknown>);

  const rawId = raw._id ?? raw.id;
  if (rawId == null) return null;

  const id = toId(rawId);
  const sender = raw.senderId;
  let senderId: MessageDto['senderId'] = '';
  if (sender && typeof sender === 'object') {
    senderId = serializeUser(sender as Record<string, unknown>, { includeEmail: false }) || toId(
      (sender as { _id?: unknown; id?: unknown })._id ?? (sender as { id?: unknown }).id,
    );
  } else {
    senderId = toId(sender);
  }

  let replyTo: MessageDto['replyTo'];
  if (raw.replyTo && typeof raw.replyTo === 'object') {
    const replyRaw = raw.replyTo as Record<string, unknown>;
    const replyId = toId(replyRaw._id ?? replyRaw.id);
    let replySender: ReturnType<typeof serializeUser> | string | undefined;
    if (replyRaw.senderId && typeof replyRaw.senderId === 'object') {
      replySender = serializeUser(replyRaw.senderId as Record<string, unknown>, { includeEmail: false }) || undefined;
    } else if (replyRaw.senderId) {
      replySender = toId(replyRaw.senderId);
    }
    replyTo = {
      id: replyId,
      _id: replyId,
      content: typeof replyRaw.content === 'string' ? replyRaw.content : '',
      type: typeof replyRaw.type === 'string' ? replyRaw.type : 'text',
      senderId: replySender,
    };
  } else if (raw.replyTo) {
    replyTo = toId(raw.replyTo);
  }

  return {
    id,
    _id: id,
    chatId: toId(raw.chatId),
    senderId,
    content: typeof raw.content === 'string' ? raw.content : '',
    type: typeof raw.type === 'string' ? raw.type : 'text',
    fileUrl: typeof raw.fileUrl === 'string' ? raw.fileUrl : '',
    replyTo,
    readBy: Array.isArray(raw.readBy) ? raw.readBy.map((item) => toId(item)) : [],
    reactions: serializeReactions(raw.reactions),
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : undefined,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : undefined,
  };
};

export const serializeReactionsMap = (
  reactions: Map<string, mongoose.Types.ObjectId[]> | Record<string, unknown> | undefined,
): { [emoji: string]: string[] } => serializeReactions(reactions);
