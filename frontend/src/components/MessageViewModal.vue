<template>
  <Transition name="message-view">
    <div v-if="isOpen" class="message-view-modal" @click.self="close">
      <div class="message-view-modal__container">
        <div class="message-view-modal__header">
          <h3 class="message-view-modal__title">{{ message?.type === 'image' ? 'Изображение' : 'Сообщение' }}</h3>
          <button @click="close" class="message-view-modal__close" type="button">×</button>
        </div>
        <div class="message-view-modal__body">
          <div v-if="message" class="message-view-modal__content">
            <div v-if="message.replyTo" class="message-view-modal__reply">
              <div class="message-view-modal__reply-line"></div>
              <div class="message-view-modal__reply-content">
                <span class="message-view-modal__reply-sender">
                  {{ getReplyToSenderName(message.replyTo) }}
                </span>
                <span class="message-view-modal__reply-text">
                  {{ getReplyToText(message.replyTo) }}
                </span>
              </div>
            </div>
            <div v-if="message.type === 'image' && message.fileUrl" class="message-view-modal__image">
              <img :src="imageUrl" :alt="message.content || 'Изображение'" />
            </div>
            <div v-else class="message-view-modal__text">{{ message.content }}</div>
            <div v-if="message.type === 'image' && message.content" class="message-view-modal__caption">{{ message.content }}</div>
            <div class="message-view-modal__footer">
              <span class="message-view-modal__time">{{ formatMessageTime(message.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import type { Message } from '../types';
import { getImageUrl } from '../utils/image';

const props = defineProps<{
  isOpen: boolean;
  message: Message | null;
}>();

const imageUrl = computed(() =>
  props.message?.fileUrl ? (getImageUrl(props.message.fileUrl) || props.message.fileUrl) : ''
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const close = (): void => {
  emit('close');
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && props.isOpen) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

const formatMessageTime = (date: string | Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;

  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const getReplyToSenderName = (replyTo: any): string => {
  if (!replyTo || typeof replyTo === 'string') {
    return 'Пользователь';
  }
  if (typeof replyTo.senderId === 'string') {
    return 'Пользователь';
  }
  if (!replyTo.senderId) {
    return 'Пользователь';
  }
  return replyTo.senderId?.username || 'Пользователь';
};

const getReplyToText = (replyTo: any): string => {
  if (!replyTo || typeof replyTo === 'string') {
    return '';
  }
  if (replyTo.type === 'image') {
    return '📷 Фото';
  }
  if (replyTo.type === 'file') {
    return '📎 Файл';
  }
  return replyTo.content || '';
};
</script>

<style scoped lang="scss">
.message-view-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 1rem;

  @media (max-width: 768px) {
    padding: 0;
    align-items: stretch;
  }
}

.message-view-modal__container {
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 768px) {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
    height: 100vh;
    height: 100dvh;
  }
}

.message-view-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    padding-top: calc(1rem + env(safe-area-inset-top, 0px));
  }
}

.message-view-modal__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.message-view-modal__close {
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
  padding: 0;
  line-height: 1;

  &:hover {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
}

.message-view-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;

  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  }
}

.message-view-modal__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-view-modal__reply {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  border-left: 3px solid var(--accent-color);
}

.message-view-modal__reply-line {
  width: 2px;
  background: var(--accent-color);
  flex-shrink: 0;
}

.message-view-modal__reply-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.message-view-modal__reply-sender {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent-color);
}

.message-view-modal__reply-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-view-modal__image {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;

  img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
  }
}

.message-view-modal__caption {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

.message-view-modal__text {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-view-modal__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.message-view-modal__time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

// Анимации
.message-view-enter-active,
.message-view-leave-active {
  transition: opacity 0.2s ease;
}

.message-view-enter-active .message-view-modal__container,
.message-view-leave-active .message-view-modal__container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.message-view-enter-from,
.message-view-leave-to {
  opacity: 0;
}

.message-view-enter-from .message-view-modal__container,
.message-view-leave-to .message-view-modal__container {
  transform: scale(0.95);
  opacity: 0;
}

@media (max-width: 768px) {
  .message-view-enter-from .message-view-modal__container,
  .message-view-leave-to .message-view-modal__container {
    transform: translateY(100%);
  }
}
</style>
