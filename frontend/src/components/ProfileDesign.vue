<script setup lang="ts">
import {
  ref, computed, watch,
} from 'vue';
import { useSettings } from '../composables/useSettings';
import { useNotifications } from '../composables/useNotifications';

const { success: notifySuccess } = useNotifications();
const {
  messageTextSize, theme, setMessageTextSize, setTheme,
} = useSettings();

// Временное значение для размера текста (до сохранения)
const tempMessageTextSize = ref(messageTextSize.value);
const tempTheme = ref(theme.value);

// Опции тем
const themeOptions = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Темная' },
];

// Синхронизируем временное значение при изменении сохраненного значения
watch(messageTextSize, (newSize) => {
  tempMessageTextSize.value = newSize;
}, { immediate: true });

watch(theme, (newTheme) => {
  tempTheme.value = newTheme;
}, { immediate: true });

const hasAppearanceChanges = computed(() => tempMessageTextSize.value !== messageTextSize.value || tempTheme.value !== theme.value);

const saveAppearance = async (): Promise<void> => {
  await setMessageTextSize(tempMessageTextSize.value);
  await setTheme(tempTheme.value);
  notifySuccess('Настройки оформления сохранены');
};
</script>

<template>
  <div class="profile-design">
    <div class="profile-design__container">
      <div class="profile-design__content">
        <h2>Оформление</h2>
        <!-- Секция настроек оформления -->
        <div class="profile-design__section">
          <h3>Размер текста</h3>
          <div class="profile-design__form">
            <div class="profile-design__field">
              <div class="profile-design__slider-wrapper">
                <input
                  v-model.number="tempMessageTextSize"
                  type="range"
                  min="12"
                  max="20"
                  step="1"
                  class="profile-design__slider"
                />
                <div class="profile-design__slider-labels">
                  <span>12px</span>
                  <span>13px</span>
                  <span>14px</span>
                  <span>15px</span>
                  <span>16px</span>
                  <span>17px</span>
                  <span>18px</span>
                  <span>19px</span>
                  <span>20px</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-design__section">
          <h3>Тема</h3>

          <div class="profile-design__field">
              <div class="profile-design__theme-options">
                <button
                  v-for="themeOption in themeOptions"
                  :key="themeOption.value"
                  type="button"
                  @click="tempTheme = themeOption.value"
                  :class="['profile-design__theme-option', { 'profile-design__theme-option--active': tempTheme === themeOption.value }]"
                >
                  <span class="profile-design__theme-option-icon">
                    <svg v-if="themeOption.value === 'system'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <svg v-else-if="themeOption.value === 'light'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="5"></circle>
                      <line x1="12" y1="1" x2="12" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="23"></line>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                      <line x1="1" y1="12" x2="3" y2="12"></line>
                      <line x1="21" y1="12" x2="23" y2="12"></line>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                  </span>
                  <span class="profile-design__theme-option-label">{{ themeOption.label }}</span>
                </button>
              </div>
            </div>
        </div>

        <button
              type="button"
              @click="saveAppearance"
              :disabled="!hasAppearanceChanges"
              class="profile-design__save"
            >
              Сохранить
            </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-design {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);

  &__container {
    background: var(--bg-primary);
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    overflow-y: auto;

    @media (max-width: 768px) {
      padding: 0;
    }
  }

  &__content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (max-width: 768px) {
			padding: 4px 0 0;
      gap: 1rem;
    }
  }

  &__section {
    margin-bottom: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.25rem 1.5rem;

    h3 {
      margin: 0 0 1rem 0;
      color: var(--text-primary);
      font-size: 1.1rem;
      font-weight: 600;

      @media (min-width: 769px) {
        margin-bottom: 1.25rem;
        font-size: 1.15rem;
      }
    }

		@media (max-width: 768px) {
			margin-top: 24px;
			padding: 1rem;
		}
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      color: var(--text-primary);
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  &__slider-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__slider {
    width: 100%;
    height: 6px;
    background: var(--bg-primary);
    border-radius: 3px;
    outline: none;
    appearance: none;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 18px;
      height: 18px;
      background: var(--accent-color);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.2);
      }
    }

    &::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: var(--accent-color);
      border-radius: 50%;
      cursor: pointer;
      border: none;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.2);
      }
    }
  }

  &__slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  &__theme-options {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    flex-wrap: wrap;

    @media (max-width: 768px) {
      flex-direction: column;
      gap: 0.5rem;
    }
  }

  &__theme-option {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
    min-width: 0;

    @media (max-width: 768px) {
      width: 100%;
      justify-content: flex-start;
      text-align: left;
    }

    &:hover {
      background: var(--bg-secondary);
      border-color: var(--accent-color);
    }

    &--active {
      background: rgba(82, 136, 193, 0.1);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }
  }

  &__theme-option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: inherit;
  }

  &__theme-option-label {
    flex: 1;
    font-weight: 500;
  }

  &__save {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    margin-top: 0.5rem;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}
</style>
