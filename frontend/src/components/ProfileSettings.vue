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
              <FileUpload
                accept="image/*"
                @uploaded="handleAvatarUploaded"
                @error="handleUploadError"
              />
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
        <div class="profile-settings__section">
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
import { useAuthStore } from '../stores/auth.store';
import { profileService } from '../services/profile.service';
import { uploadService } from '../services/upload.service';
import { useNotifications } from '../composables/useNotifications';
import FileUpload from './FileUpload.vue';
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

const handleAvatarUploaded = async (data: { url: string; filename: string; type: string }): Promise<void> => {
  avatarPreview.value = data.url;
  try {
    await profileService.updateProfile({ avatar: data.url });
    await authStore.loadUser();
    notifySuccess('Фотография профиля обновлена');
  } catch (error: any) {
    notifyError(error.response?.data?.error || 'Ошибка обновления фотографии');
    avatarPreview.value = null;
  }
};

const handleUploadError = (error: string): void => {
  notifyError(error);
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

    button {
      padding: 0.5rem 1rem;
      background: var(--accent-color);
      border: none;
      border-radius: 8px;
      color: white;
      cursor: pointer;
      font-size: 0.9rem;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.9;
      }
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
