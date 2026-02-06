<template>
  <div class="user-profile" @click.self="$emit('close')">
    <div class="user-profile__container">
      <div class="user-profile__header">
        <h2>Профиль</h2>
        <button @click="$emit('close')" class="user-profile__close">×</button>
      </div>

      <div class="user-profile__content">
        <div class="user-profile__avatar">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="user?.username" />
          <div v-else class="user-profile__avatar-placeholder">
            {{ user?.username?.charAt(0).toUpperCase() }}
          </div>
        </div>

        <div class="user-profile__info">
          <h3>{{ user?.username }}</h3>
          <p class="user-profile__email">{{ user?.email }}</p>
          <p class="user-profile__status">
            <span :class="['user-profile__status-dot', `user-profile__status-dot--${getComputedStatus(user)}`]"></span>
            {{ isUserOnline(user) ? 'в сети' : 'не в сети' }}
          </p>
        </div>

        <div class="user-profile__actions">
          <button @click="showSettings = true" class="user-profile__settings">Настройки</button>
          <button @click="handleLogout" class="user-profile__logout">Выйти</button>
        </div>
      </div>
    </div>

    <ProfileSettings v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import { useAuth } from '../composables/useAuth';
import { useConfirm } from '../composables/useConfirm';
import ProfileSettings from './ProfileSettings.vue';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const { logout } = useAuth();
const { confirm } = useConfirm();
const showSettings = ref(false);

const user = computed(() => authStore.user);

import { getImageUrl } from '../utils/image';
import { isUserOnline, getComputedStatus } from '../utils/status';

const avatarUrl = computed(() => {
  return getImageUrl(user.value?.avatar) || null;
});

const handleLogout = async (): Promise<void> => {
  const confirmed = await confirm('Вы уверены, что хотите выйти из аккаунта?');
  if (!confirmed) return;
  logout();
};
</script>

<style scoped lang="scss">
.user-profile {
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
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

    @media (max-width: 768px) {
      width: 95%;
      max-width: none;
      border-radius: 8px;
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

      @media (max-width: 768px) {
        font-size: 1.25rem;
      }
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
    align-items: center;
    gap: 1.5rem;

    @media (max-width: 768px) {
      padding: 1rem;
      gap: 1rem;
    }
  }

  &__avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    overflow: hidden;

    @media (max-width: 768px) {
      width: 200px;
      height: 200px;
    }

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

  &__info {
    text-align: center;

    h3 {
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
      font-size: 1.25rem;
    }
  }

  &__email {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin: 0 0 0.5rem 0;
  }

  &__status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin: 0;
  }

  &__status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--text-secondary);

    &--online {
      background: #34c759;
    }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  &__settings {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }

  &__logout {
    padding: 0.75rem 1.5rem;
    background: #ff3b30;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }
}
</style>
