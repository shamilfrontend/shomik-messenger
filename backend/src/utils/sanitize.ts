const ALLOWED_MESSAGE_TYPES = ['text', 'image', 'file'] as const;

export type ClientMessageType = (typeof ALLOWED_MESSAGE_TYPES)[number];

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isAllowedFileUrl = (url: unknown): boolean => {
  if (url == null || url === '') return true;
  if (typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return true;

  if (trimmed.startsWith('data:image/')) {
    return trimmed.length < 700_000 && !trimmed.includes('..');
  }

  if (trimmed.startsWith('/uploads/')) {
    if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes('\0')) {
      return false;
    }
    return /^\/uploads\/[A-Za-z0-9._-]+$/.test(trimmed);
  }

  return false;
};

export const sanitizeFileUrl = (url: unknown): string => {
  if (!isAllowedFileUrl(url) || typeof url !== 'string') return '';
  return url.trim();
};

export const sanitizeMessageType = (type: unknown): ClientMessageType => {
  if (typeof type === 'string' && (ALLOWED_MESSAGE_TYPES as readonly string[]).includes(type)) {
    return type as ClientMessageType;
  }
  return 'text';
};
