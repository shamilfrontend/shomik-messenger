import { serializeUser, toId } from './user.serializer';
import { serializeMessage, MessageDto } from './message.serializer';
import { sanitizeFileUrl } from '../utils/sanitize';

export interface ChatDto {
  id: string;
  _id: string;
  type: string;
  participants: NonNullable<ReturnType<typeof serializeUser>>[];
  groupName?: string;
  groupAvatar?: string;
  admin?: ReturnType<typeof serializeUser>;
  lastMessage?: MessageDto | null;
  pinnedMessage?: MessageDto | null;
  unreadCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const serializeChat = (
  chat: unknown,
  extras: { unreadCount?: number } = {},
): ChatDto | null => {
  if (!chat || typeof chat !== 'object') return null;

  const raw = typeof (chat as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (chat as { toObject: () => Record<string, unknown> }).toObject()
    : (chat as Record<string, unknown>);

  const rawId = raw._id ?? raw.id;
  if (rawId == null) return null;
  const id = toId(rawId);

  const participants = Array.isArray(raw.participants)
    ? raw.participants
      .map((p) => (typeof p === 'object' && p
        ? serializeUser(p as Record<string, unknown>, { includeEmail: false })
        : null))
      .filter((p): p is NonNullable<ReturnType<typeof serializeUser>> => p != null)
    : [];

  const admin = raw.admin && typeof raw.admin === 'object'
    ? serializeUser(raw.admin as Record<string, unknown>, { includeEmail: false })
    : undefined;

  return {
    id,
    _id: id,
    type: typeof raw.type === 'string' ? raw.type : 'private',
    participants,
    groupName: typeof raw.groupName === 'string' ? raw.groupName : undefined,
    groupAvatar: sanitizeFileUrl(raw.groupAvatar) || undefined,
    admin,
    lastMessage: serializeMessage(raw.lastMessage),
    pinnedMessage: serializeMessage(raw.pinnedMessage),
    unreadCount: extras.unreadCount ?? 0,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : undefined,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : undefined,
  };
};

export const participantId = (participant: unknown): string => {
  if (typeof participant === 'string') return participant;
  if (participant && typeof participant === 'object') {
    const obj = participant as { id?: unknown; _id?: unknown };
    return toId(obj.id ?? obj._id);
  }
  return '';
};
