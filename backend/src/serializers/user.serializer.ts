import { sanitizeFileUrl } from '../utils/sanitize';

export interface UserDto {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  status?: string;
  lastSeen?: Date;
  params?: Record<string, unknown>;
  pinnedChats?: string[];
  contacts?: string[];
}

const toId = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return (value as { toString(): string }).toString();
  }
  return String(value);
};

export const serializeUser = (
  user: unknown,
  options: { includeEmail?: boolean } = {},
): UserDto | null => {
  if (!user || typeof user !== 'object') return null;
  const raw = user as Record<string, unknown>;
  const rawId = raw.id ?? raw._id;
  if (rawId == null) return null;

  const dto: UserDto = {
    id: toId(rawId),
    username: typeof raw.username === 'string' ? raw.username : 'Пользователь',
    avatar: sanitizeFileUrl(raw.avatar),
    status: typeof raw.status === 'string' ? raw.status : undefined,
    lastSeen: raw.lastSeen instanceof Date ? raw.lastSeen : undefined,
  };

  if (options.includeEmail !== false && typeof raw.email === 'string') {
    dto.email = raw.email;
  }

  return dto;
};

export const serializeUserId = (value: unknown): string => toId(value);

export { toId };
