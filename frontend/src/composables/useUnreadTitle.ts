import { watch } from 'vue';
import { useChatStore } from '../stores/chat.store';

const DEFAULT_TITLE = 'Shomik - простой мессенджер';

function pluralizeUnread(n: number): string {
  if (n === 1) return 'У вас новое сообщение';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `У вас ${n} новых сообщения`;
  }
  return `У вас ${n} новых сообщений`;
}

export function useUnreadTitle(): void {
  const chatStore = useChatStore();
  const savedTitle = typeof document !== 'undefined' ? (document.title || DEFAULT_TITLE) : DEFAULT_TITLE;

  watch(
    () => chatStore.totalUnreadCount,
    (count) => {
      if (count > 0) {
        document.title = pluralizeUnread(count);
      } else {
        document.title = savedTitle;
      }
    },
    { immediate: true },
  );
}
