<template>
  <div class="profile-settings">
    <div class="profile-settings__container">
      <div v-if="showHeader !== false" class="profile-settings__header">
        <h2>Настройки профиля</h2>
        <button @click="$emit('close')" class="profile-settings__close">×</button>
      </div>

      <div class="profile-settings__content">
        <!-- Секция аватара -->
        <div class="profile-settings__section">
          <div class="profile-settings__avatar-section">
            <div class="profile-settings__avatar-wrap">
              <div class="profile-settings__avatar">
                <img v-if="getAvatarUrl()" :src="getAvatarUrl()" :alt="user?.username" />
                <div v-else class="profile-settings__avatar-placeholder">
                  {{ user?.username?.charAt(0).toUpperCase() }}
                </div>
              </div>
            </div>
            <p class="profile-settings__avatar-hint">JPG или PNG, до 200 КБ</p>
            <div class="profile-settings__avatar-controls">
              <input
                ref="avatarInput"
                type="file"
                accept="image/*"
                @change="handleAvatarSelect"
                class="profile-settings__avatar-input"
              />
              <button @click="triggerAvatarSelect" class="profile-settings__upload-button" :disabled="uploadingAvatar">
                <svg v-if="!uploadingAvatar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span v-else>...</span>
              </button>
              <button v-if="user?.avatar" @click="removeAvatar" class="profile-settings__remove-avatar">
                Удалить фото
              </button>
            </div>
          </div>
        </div>

        <!-- Секция персональных данных -->
        <div class="profile-settings__section">
          <h3>Персональные данные</h3>
          <div class="profile-settings__form">
            <div class="profile-settings__field">
              <label>Логин пользователя</label>
              <input
                v-model="formData.username"
                type="text"
                placeholder="Введите username"
                :disabled="loading"
              />
            </div>
            <div class="profile-settings__field">
              <label>Email</label>
              <input
                v-model="formData.email"
                type="email"
                placeholder="Введите email"
                :disabled="loading"
              />
            </div>
            <button @click="updateProfile" :disabled="loading || !hasChanges" class="profile-settings__save">
              {{ loading ? 'Сохранение...' : 'Сохранить изменения' }}
            </button>
          </div>
        </div>

        <!-- Секция настроек -->
        <div class="profile-settings__section">
          <h3>Оформление</h3>
          <div class="profile-settings__form">
            <div class="profile-settings__field">
              <label>Размер текста</label>
              <div class="profile-settings__slider-wrapper">
                <input
                  v-model.number="tempMessageTextSize"
                  type="range"
                  min="12"
                  max="20"
                  step="1"
                  class="profile-settings__slider"
                />
                <div class="profile-settings__slider-labels">
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
            <div class="profile-settings__field">
              <label>Тема</label>
              <div class="profile-settings__theme-options">
                <button
                  v-for="themeOption in themeOptions"
                  :key="themeOption.value"
                  type="button"
                  @click="tempTheme = themeOption.value"
                  :class="['profile-settings__theme-option', { 'profile-settings__theme-option--active': tempTheme === themeOption.value }]"
                >
                  <span class="profile-settings__theme-option-icon">
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
                  <span class="profile-settings__theme-option-label">{{ themeOption.label }}</span>
                </button>
              </div>
            </div>
            <button
              type="button"
              @click="saveAppearance"
              :disabled="!hasAppearanceChanges"
              class="profile-settings__save profile-settings__save--appearance"
            >
              Сохранить
            </button>
          </div>
        </div>

        <!-- Устройства для звонков -->
        <div class="profile-settings__section">
          <h3>Устройства для звонков</h3>
          <div class="profile-settings__form">
            <div class="profile-settings__field">
              <label>Микрофон</label>
              <select
                :value="callStore.selectedMicId ?? ''"
                @change="callStore.setSelectedMic(($event.target as HTMLSelectElement).value || null)"
                class="profile-settings__select"
              >
                <option value="">По умолчанию</option>
                <option
                  v-for="dev in callStore.audioDevices"
                  :key="dev.deviceId"
                  :value="dev.deviceId"
                >
                  {{ dev.label || `Микрофон ${dev.deviceId.slice(0, 8)}` }}
                </option>
              </select>
            </div>
            <div class="profile-settings__field">
              <label>Камера</label>
              <select
                :value="callStore.selectedCameraId ?? ''"
                @change="callStore.setSelectedCamera(($event.target as HTMLSelectElement).value || null)"
                class="profile-settings__select"
              >
                <option value="">По умолчанию</option>
                <option
                  v-for="dev in callStore.videoDevices"
                  :key="dev.deviceId"
                  :value="dev.deviceId"
                >
                  {{ dev.label || `Камера ${dev.deviceId.slice(0, 8)}` }}
                </option>
              </select>
            </div>
            <p class="profile-settings__devices-hint">Выбор применяется к следующим звонкам. Разрешите доступ к микрофону и камере, чтобы видеть названия устройств.</p>
          </div>
        </div>

        <!-- Выход -->
        <div class="profile-settings__section">
          <button type="button" class="profile-settings__logout" @click="handleLogout">
            Выход
          </button>
        </div>

        <!-- Секция смены пароля -->
        <div v-if="false" class="profile-settings__section">
          <h3>Смена пароля</h3>
          <div class="profile-settings__form">
            <div class="profile-settings__field">
              <label>Текущий пароль</label>
              <input
                v-model="passwordData.currentPassword"
                type="password"
                placeholder="Введите текущий пароль"
                :disabled="changingPassword"
              />
            </div>
            <div class="profile-settings__field">
              <label>Новый пароль</label>
              <input
                v-model="passwordData.newPassword"
                type="password"
                placeholder="Введите новый пароль"
                :disabled="changingPassword"
              />
            </div>
            <div class="profile-settings__field">
              <label>Подтвердите новый пароль</label>
              <input
                v-model="passwordData.confirmPassword"
                type="password"
                placeholder="Подтвердите новый пароль"
                :disabled="changingPassword"
              />
            </div>
            <button @click="changePassword" :disabled="changingPassword || !isPasswordFormValid" class="profile-settings__save">
              {{ changingPassword ? 'Изменение...' : 'Изменить пароль' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import { useCallStore } from '../stores/call.store';
import { profileService } from '../services/profile.service';
import { useNotifications } from '../composables/useNotifications';
import { useSettings } from '../composables/useSettings';
import { useConfirm } from '../composables/useConfirm';
import { getImageUrl } from '../utils/image';

const router = useRouter();
const callStore = useCallStore();

const { confirm } = useConfirm();

const handleLogout = async (): Promise<void> => {
  const confirmed = await confirm('Вы уверены, что хотите выйти из аккаунта?');
  if (!confirmed) return;
  authStore.logout();
  emit('close');
  router.push('/login');
};

const props = defineProps<{
  showHeader?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const { success: notifySuccess, error: notifyError } = useNotifications();
const { messageTextSize, theme, setMessageTextSize, setTheme } = useSettings();

// Временное значение для размера текста (до сохранения)
const tempMessageTextSize = ref(messageTextSize.value);
const tempTheme = ref(theme.value);

// Опции тем
const themeOptions = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Темная' }
];

// Синхронизируем временное значение при изменении сохраненного значения
watch(messageTextSize, (newSize) => {
  tempMessageTextSize.value = newSize;
}, { immediate: true });

watch(theme, (newTheme) => {
  tempTheme.value = newTheme;
}, { immediate: true });

onMounted(() => {
  callStore.loadDevices();
});

const hasAppearanceChanges = computed(() =>
  tempMessageTextSize.value !== messageTextSize.value || tempTheme.value !== theme.value
);

const saveAppearance = async (): Promise<void> => {
  await setMessageTextSize(tempMessageTextSize.value);
  await setTheme(tempTheme.value);
  notifySuccess('Настройки оформления сохранены');
};

const user = computed(() => authStore.user);
const loading = ref(false);
const changingPassword = ref(false);
const avatarPreview = ref<string | null>(null);
const uploadingAvatar = ref(false);
const avatarInput = ref<HTMLInputElement | null>(null);

const formData = ref({
  username: '',
  email: ''
});

const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const getAvatarUrl = (): string | undefined => {
  if (avatarPreview.value) {
    return getImageUrl(avatarPreview.value);
  }
  return getImageUrl(user.value?.avatar);
};

const hasChanges = computed(() => {
  return formData.value.username !== user.value?.username || 
         formData.value.email !== user.value?.email ||
         avatarPreview.value !== null;
});

const isPasswordFormValid = computed(() => {
  return passwordData.value.currentPassword.length > 0 &&
         passwordData.value.newPassword.length >= 6 &&
         passwordData.value.newPassword === passwordData.value.confirmPassword;
});

watch(user, (newUser) => {
  if (newUser) {
    formData.value.username = newUser.username;
    formData.value.email = newUser.email;
  }
}, { immediate: true });

const triggerAvatarSelect = (): void => {
  avatarInput.value?.click();
};

const handleAvatarSelect = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  // Проверка размера файла (максимум 200 КБ)
  const maxSize = 200 * 1024; // 200 КБ в байтах
  if (file.size > maxSize) {
    notifyError('Размер файла не должен превышать 200 КБ');
    if (avatarInput.value) {
      avatarInput.value.value = '';
    }
    return;
  }

  // Проверка типа файла
  if (!file.type.startsWith('image/')) {
    notifyError('Выберите изображение');
    if (avatarInput.value) {
      avatarInput.value.value = '';
    }
    return;
  }

  uploadingAvatar.value = true;

  try {
    // Конвертируем файл в Base64
    const base64String = await fileToBase64(file);
    avatarPreview.value = base64String;

    // Сохраняем Base64 строку в профиль
    await profileService.updateProfile({ avatar: base64String });
    await authStore.loadUser();
    notifySuccess('Фотография профиля обновлена');
    avatarPreview.value = null; // Сбрасываем preview после успешного сохранения
  } catch (error: any) {
    notifyError(error.response?.data?.error || 'Ошибка обновления фотографии');
    avatarPreview.value = null;
  } finally {
    uploadingAvatar.value = false;
    if (avatarInput.value) {
      avatarInput.value.value = '';
    }
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Ошибка чтения файла'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };
    reader.readAsDataURL(file);
  });
};

const removeAvatar = async (): Promise<void> => {
  const confirmed = await confirm('Удалить фотографию профиля?');
  if (!confirmed) return;
  try {
    await profileService.updateProfile({ avatar: '' });
    avatarPreview.value = null;
    await authStore.loadUser();
    notifySuccess('Фотография удалена');
  } catch (error: any) {
    notifyError(error.response?.data?.error || 'Ошибка удаления фотографии');
  }
};

const updateProfile = async (): Promise<void> => {
  if (!hasChanges.value) return;

  loading.value = true;
  try {
    const updateData: any = {};
    if (formData.value.username !== user.value?.username) {
      updateData.username = formData.value.username;
    }
    if (formData.value.email !== user.value?.email) {
      updateData.email = formData.value.email;
    }

    await profileService.updateProfile(updateData);
    await authStore.loadUser();
    avatarPreview.value = null;
    notifySuccess('Профиль успешно обновлен');
  } catch (error: any) {
    notifyError(error.response?.data?.error || 'Ошибка обновления профиля');
  } finally {
    loading.value = false;
  }
};

const changePassword = async (): Promise<void> => {
  if (!isPasswordFormValid.value) return;

  changingPassword.value = true;
  try {
    await profileService.changePassword({
      currentPassword: passwordData.value.currentPassword,
      newPassword: passwordData.value.newPassword
    });
    passwordData.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    notifySuccess('Пароль успешно изменен');
  } catch (error: any) {
    notifyError(error.response?.data?.error || 'Ошибка изменения пароля');
  } finally {
    changingPassword.value = false;
  }
};
</script>

<style scoped lang="scss">
.profile-settings {
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
      padding: 0.75rem;
    }
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);

    @media (max-width: 768px) {
      padding: 1rem;
    }

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.5rem;
    }
  }

  &__close {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 2rem;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-primary);
    }
  }

  &__content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (max-width: 768px) {
      padding: 1rem;
      gap: 1rem;
    }
  }

  &__section {
    margin-bottom: 0;

    @media (min-width: 769px) {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
    }

    &:last-child {
      margin-bottom: 0;
    }

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
  }

  &__avatar-section {
    display: flex;
    align-items: center;
    gap: 1.5rem;

    @media (min-width: 769px) {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    @media (max-width: 575px) {
      flex-direction: column;
      width: 100%;
    }
  }

  &__avatar-wrap {
    flex-shrink: 0;
  }

  &__avatar {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid var(--border-color);
    transition: box-shadow 0.2s, border-color 0.2s;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 2.5rem;

    @media (min-width: 769px) {
      font-size: 4rem;
    }
  }

  &__avatar-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary);

    @media (max-width: 768px) {
      display: none;
    }
  }

  &__avatar-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    @media (min-width: 769px) {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      width: 100%;
    }

    @media (max-width: 575px) {
      width: 100%;
      align-items: stretch;
    }
  }

  &__avatar-input {
    display: none;
  }

  &__upload-button {
    width: 40px;
    height: 40px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    padding: 0;

    @media (max-width: 575px) {
      width: 100%;
      height: auto;
      padding: 0.75rem 1rem;
      border-radius: 8px;
    }

    &:hover:not(:disabled) {
      background: var(--bg-primary);
      border-color: var(--accent-color);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__remove-avatar {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;

    @media (max-width: 575px) {
      width: 100%;
    }

    &:hover {
      border-color: #ff3b30;
      color: #ff3b30;
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

    input {
      padding: 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 1rem;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    select.profile-settings__select {
      padding: 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 1rem;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }
    }
  }

  &__devices-hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
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

  &__logout {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: #dc3545;
    border: 1px solid #dc3545;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;

    &:hover {
      background: #c82333;
      border-color: #c82333;
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

  &__slider-value {
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-primary);
    font-weight: 500;
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
}
</style>
