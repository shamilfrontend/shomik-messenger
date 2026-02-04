/**
 * Утилита для воспроизведения звуков уведомлений
 * Генерирует звук похожий на классический ICQ "uh-oh"
 */

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Воспроизводит звук уведомления ICQ
 */
export const playNotificationSound = async (): Promise<void> => {
  try {
    const ctx = getAudioContext();
    
    // Восстанавливаем контекст, если он приостановлен (требуется для некоторых браузеров)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // Создаем осциллятор для генерации звука
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // Подключаем осциллятор к gain node, а gain node к выходу
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Настройки для звука похожего на ICQ "uh-oh"
    // Используем две ноты: сначала выше, потом ниже
    const frequency1 = 800; // Первая нота (выше)
    const frequency2 = 400; // Вторая нота (ниже)
    const duration = 0.15; // Длительность каждой ноты
    
    // Первая нота
    oscillator.frequency.setValueAtTime(frequency1, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    // Вторая нота
    oscillator.frequency.setValueAtTime(frequency2, ctx.currentTime + duration);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime + duration);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration * 2);
    
    // Запускаем осциллятор
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration * 2);
    
    // Очищаем после завершения
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch (error) {
    console.error('Ошибка воспроизведения звука:', error);
    // Fallback: используем простой beep через Web Audio API
    try {
      const ctx = getAudioContext();
      
      // Восстанавливаем контекст, если он приостановлен
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (fallbackError) {
      console.error('Ошибка fallback звука:', fallbackError);
    }
  }
};
