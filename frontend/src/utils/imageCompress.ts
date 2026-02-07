/**
 * Сжимает изображение до заданного максимального размера в байтах, возвращает Data URL (Base64).
 */

const MAX_SIZE_BYTES = 500 * 1024; // 500 КБ
const MAX_DIMENSION = 1600;
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.2;

function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  const paddingMatch = base64.match(/=+$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function compressImageToBase64(file: File, maxBytes = MAX_SIZE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Файл не является изображением'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Не удалось создать canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      let quality = INITIAL_QUALITY;
      const tryEncode = (): void => {
        const dataUrl = canvas.toDataURL(mime, quality);
        if (dataUrlByteLength(dataUrl) <= maxBytes || quality <= MIN_QUALITY) {
          resolve(dataUrl);
          return;
        }
        quality = Math.max(MIN_QUALITY, quality - 0.15);
        tryEncode();
      };
      tryEncode();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };
    img.src = url;
  });
}
