<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, watch,
} from 'vue';
import { User } from '../types';
import { getImageUrl } from '../utils/image';
import { getComputedStatus } from '../utils/status';

const props = defineProps<{
  isOpen: boolean;
  user: User | null;
}>();

const emit = defineEmits<{(e: 'close'): void;
  (e: 'send-message', userId: string): void;
}>();

const avatarUrl = computed(() => getImageUrl(props.user?.avatar));

const getStatusText = (status?: string): string => {
  switch (status) {
    case 'online':
      return 'в сети';
    case 'away':
      return 'отошёл';
    case 'offline':
    default:
      return 'не в сети';
  }
};

const handleSendMessage = (): void => {
  if (!props.user?.id) {
    console.error('UserInfoModal: ID пользователя не найден');
    return;
  }

  // Проверяем, что это не текущий пользователь (должно быть проверено в родительском компоненте, но на всякий случай)
  emit('send-message', props.user.id);
  emit('close');
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close');
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="isOpen" class="user-info-modal" @click.self="$emit('close')">
    <div class="user-info-modal__container">
      <div class="user-info-modal__header">
        <h2>Информация о пользователе</h2>
        <button @click="$emit('close')" class="user-info-modal__close">×</button>
      </div>

      <div v-if="user" class="user-info-modal__content">
        <div class="user-info-modal__avatar">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="user.username" />
          <div v-else class="user-info-modal__avatar-placeholder">
            {{ user.username?.charAt(0).toUpperCase() }}
          </div>
          <span
            :class="['user-info-modal__status-indicator', `user-info-modal__status-indicator--${getComputedStatus(user)}`]"
          ></span>
        </div>

        <div class="user-info-modal__info">
          <h3>{{ user.username }}</h3>
          <p class="user-info-modal__email">{{ user.email }}</p>
          <div class="user-info-modal__status">
            <span :class="['user-info-modal__status-dot', `user-info-modal__status-dot--${getComputedStatus(user)}`]"></span>
            <span>{{ getStatusText(getComputedStatus(user)) }}</span>
          </div>
        </div>

        <div class="user-info-modal__actions">
          <button @click="handleSendMessage" class="user-info-modal__send-button">
            Написать сообщение
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-info-modal {
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

  @media (max-width: 768px) {
    align-items: stretch;
    justify-content: stretch;
    background: var(--bg-secondary);
  }

  &__container {
    background: var(--bg-secondary);
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

    @media (max-width: 768px) {
      width: 100%;
      max-width: none;
      height: 100%;
      min-height: 100dvh;
      border-radius: 0;
      box-shadow: none;
      display: flex;
      flex-direction: column;
    }
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;

    @media (max-width: 768px) {
      padding: 1rem 1.25rem;
      padding-top: max(1rem, env(safe-area-inset-top));
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
    align-items: center;
    gap: 1.5rem;

    @media (max-width: 768px) {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem 1.25rem;
      padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
    }
  }

  &__avatar {
    width: 300px;
    height: 300px;
    border-radius: 50%;
    overflow: visible;
    position: relative;

    @media (max-width: 768px) {
      width: 200px;
      height: 200px;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__status-indicator {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid var(--bg-secondary);
    z-index: 1;

    &--online {
      background: #52c41a;
    }

    &--offline {
      background: #ff4d4f;
    }

    &--away {
      background: #faad14;
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
    font-size: 3rem;
    border-radius: 50%;
  }

  &__info {
    text-align: center;
    width: 100%;

    h3 {
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
      font-size: 1.5rem;
    }
  }

  &__email {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
  }

  &__status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--text-secondary);

    &--online {
      background: #34c759;
    }

    &--away {
      background: #ff9500;
    }
  }

  &__actions {
    width: 100%;
    margin-top: 0.5rem;
  }

  &__send-button {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }
}
</style>
