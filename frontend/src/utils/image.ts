/**
 * Утилита для работы с изображениями и URL файлов
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Преобразует относительный путь файла в полный URL
 * @param url - Относительный путь (например, /uploads/file.jpg) или полный URL
 * @returns Полный URL для загрузки файла
 */
export const getImageUrl = (url: string | undefined | null): string | undefined => {
  if (!url || !url.trim()) {
    return undefined;
  }

  const trimmedUrl = url.trim();

  // Если это Base64 строка (начинается с data:), возвращаем её напрямую
  if (trimmedUrl.startsWith('data:')) {
    return trimmedUrl;
  }

  // Если URL уже полный (начинается с http:// или https://), возвращаем как есть
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // Если URL начинается с /uploads/, добавляем базовый URL API
  if (trimmedUrl.startsWith('/uploads/')) {
    return `${API_URL}${trimmedUrl}`;
  }

  // Если URL начинается с /, но не с /uploads/, добавляем базовый URL API
  if (trimmedUrl.startsWith('/')) {
    return `${API_URL}${trimmedUrl}`;
  }

  // Иначе считаем что это относительный путь и добавляем /uploads/
  return `${API_URL}/uploads/${trimmedUrl}`;
};
