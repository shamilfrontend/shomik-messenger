import { User } from '../types';

/**
 * Проверяет, является ли пользователь онлайн с учетом последней активности
 * Пользователь считается онлайн, если:
 * - его статус 'online', ИЛИ
 * - его lastSeen был менее 5 минут назад
 */
export const isUserOnline = (user: User | null | undefined): boolean => {
  if (!user) return false;

  // Если статус явно онлайн
  if (user.status === 'online') {
    return true;
  }

  // Если есть lastSeen, проверяем, был ли он менее 5 минут назад
  if (user.lastSeen) {
    const lastSeenDate = typeof user.lastSeen === 'string'
      ? new Date(user.lastSeen)
      : user.lastSeen;

    const now = new Date();
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);

    // Если прошло менее 5 минут, считаем пользователя онлайн
    return diffInMinutes < 5;
  }

  // Если lastSeen нет, используем только статус
  return user.status === 'online';
};

/**
 * Возвращает вычисленный статус пользователя с учетом lastSeen
 */
export const getComputedStatus = (user: User | null | undefined): 'online' | 'offline' | 'away' => {
  if (!user) return 'offline';

  if (isUserOnline(user)) {
    return 'online';
  }

  return user.status || 'offline';
};
