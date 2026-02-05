<template>
  <div class="profile-settings">
    <div class="profile-settings__container">
      <div class="profile-settings__header">
        <h2>Настройки профиля</h2>
        <button @click="$emit('close')" class="profile-settings__close">×</button>
      </div>

      <div class="profile-settings__content">
        <!-- Секция аватара -->
        <div class="profile-settings__section">
          <h3>Фотография профиля</h3>
          <div class="profile-settings__avatar-section">
            <div class="profile-settings__avatar">
              <img v-if="getAvatarUrl()" :src="getAvatarUrl()" :alt="user?.username" />
              <div v-else class="profile-settings__avatar-placeholder">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </div>
            </div>
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
              <label>Username</label>
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
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import { profileService } from '../services/profile.service';
import { useNotifications } from '../composables/useNotifications';
import { getImageUrl } from '../utils/image';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const { success: notifySuccess, error: notifyError } = useNotifications();

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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  &__container {
    background: var(--bg-secondary);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);

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
  }

  &__section {
    margin-bottom: 2rem;

    &:last-child {
      margin-bottom: 0;
    }

    h3 {
      margin: 0 0 1rem 0;
      color: var(--text-primary);
      font-size: 1.1rem;
    }
  }

  &__avatar-section {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  &__avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;

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
  }

  &__avatar-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
