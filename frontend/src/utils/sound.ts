/**
 * Утилита для воспроизведения звука уведомления о новом сообщении.
 * Использует MP3 из public/notification.mp3, при ошибке — генерация через Web Audio API.
 */

const NOTIFICATION_SOUND_URL = '/notification.mp3';

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const playFallbackBeep = async (): Promise<void> => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.frequency.value = 800;
  gainNode.gain.value = 0.1;
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.1);
};

/**
 * Воспроизводит звук уведомления о новом сообщении.
 * @param forGroup — если true, играет только beep (Web Audio API); иначе — MP3 из public/notification.mp3 с fallback на beep.
 */
export const playNotificationSound = async (forGroup = false): Promise<void> => {
  if (forGroup) {
    try {
      await playFallbackBeep();
    } catch (e) {
      console.error('Ошибка воспроизведения звука:', e);
    }
    return;
  }
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    await audio.play();
  } catch {
    try {
      await playFallbackBeep();
    } catch (e) {
      console.error('Ошибка воспроизведения звука:', e);
    }
  }
};
