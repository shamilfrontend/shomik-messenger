import { ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import { profileService } from '../services/profile.service';

const DEFAULT_MESSAGE_TEXT_SIZE = 14;
const DEFAULT_THEME = 'system';

// Инициализируем значение из пользователя или используем значения по умолчанию
const getInitialTextSize = (): number => {
  const authStore = useAuthStore();
  return authStore.user?.params?.messageTextSize || DEFAULT_MESSAGE_TEXT_SIZE;
};

const getInitialTheme = (): string => {
  const authStore = useAuthStore();
  return authStore.user?.params?.theme || DEFAULT_THEME;
};

const messageTextSize = ref<number>(getInitialTextSize());
const theme = ref<string>(getInitialTheme());

// Применяем размер текста к CSS переменной
const applyTextSize = (size: number): void => {
  document.documentElement.style.setProperty('--message-text-size', `${size}px`);
};

// Определяем системную тему
const getSystemTheme = (): 'light' | 'dark' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

// Применяем тему
const applyTheme = (themeValue: string): void => {
  // Удаляем предыдущий слушатель, если он был
  if (systemThemeListener) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.removeEventListener('change', systemThemeListener);
    systemThemeListener = null;
  }
  
  let actualTheme: 'light' | 'dark' = 'dark';
  
  if (themeValue === 'system') {
    actualTheme = getSystemTheme();
    
    // Отслеживаем изменения системной темы для режима 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeListener = (): void => {
      const newSystemTheme = getSystemTheme();
      document.documentElement.setAttribute('data-theme', newSystemTheme);
    };
    mediaQuery.addEventListener('change', systemThemeListener);
  } else if (themeValue === 'light') {
    actualTheme = 'light';
  } else {
    actualTheme = 'dark';
  }
  
  document.documentElement.setAttribute('data-theme', actualTheme);
};

// Инициализируем настройки при загрузке
applyTextSize(messageTextSize.value);
applyTheme(theme.value);

// Отслеживаем изменения пользователя и обновляем настройки
const authStore = useAuthStore();
watch(() => authStore.user, (user) => {
  if (user?.params) {
    if (user.params.messageTextSize !== undefined) {
      messageTextSize.value = user.params.messageTextSize;
      applyTextSize(messageTextSize.value);
    }
    if (user.params.theme !== undefined) {
      theme.value = user.params.theme;
      applyTheme(theme.value);
    }
  }
}, { immediate: true });

// Отслеживаем изменения размера текста и применяем их
watch(messageTextSize, (newSize) => {
  applyTextSize(newSize);
});

// Отслеживаем изменения темы и применяем их
watch(theme, (newTheme) => {
  applyTheme(newTheme);
});

export const useSettings = () => {
  const setMessageTextSize = async (size: number): Promise<void> => {
    messageTextSize.value = size;
    const authStore = useAuthStore();
    if (authStore.user) {
      try {
        await profileService.updateProfile({
          params: {
            messageTextSize: size,
            theme: theme.value
          }
        });
        await authStore.loadUser();
      } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
      }
    }
  };

  const setTheme = async (themeValue: string): Promise<void> => {
    theme.value = themeValue;
    const authStore = useAuthStore();
    if (authStore.user) {
      try {
        await profileService.updateProfile({
          params: {
            messageTextSize: messageTextSize.value,
            theme: themeValue
          }
        });
        await authStore.loadUser();
      } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
      }
    }
  };

  return {
    messageTextSize,
    theme,
    setMessageTextSize,
    setTheme
  };
};
