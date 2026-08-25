<script setup lang="ts">
import { computed } from 'vue';
import type { Message } from '../types';
import { useChatStore } from '../stores/chat.store';
import { getReplyToSenderName, getReplyToText } from '../utils/messageDisplay';

defineProps<{
  message: Message;
}>();

defineEmits<{
  (e: 'go'): void;
  (e: 'unpin'): void;
}>();

const chatStore = useChatStore();
const currentUserId = computed(() => chatStore.user?.id);
</script>

<template>
  <div class="chat-window__pinned-bar">
    <div class="chat-window__pinned-content" @click="$emit('go')">
      <span class="chat-window__pinned-label">Закреплено</span>
      <span class="chat-window__pinned-sender">{{ getReplyToSenderName(message, currentUserId) }}</span>
      <span class="chat-window__pinned-text">{{ getReplyToText(message) || 'Сообщение' }}</span>
    </div>
    <div class="chat-window__pinned-actions">
      <button type="button" class="chat-window__pinned-btn" @click.stop="$emit('go')">Перейти</button>
      <button
        type="button"
        class="chat-window__pinned-btn chat-window__pinned-btn--unpin"
        @click.stop="$emit('unpin')"
        aria-label="Открепить"
      >
        Открепить
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-window {
  &__pinned-bar {
    position: absolute;
    top: 73px;
    left: 6px;
    right: 10px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 1rem 0.75rem;
    background: var(--surface, var(--bg-primary));
    border-radius: 0 0 var(--radius-sm, 8px) var(--radius-sm, 8px);
    border-left: 3px solid var(--accent-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    flex-shrink: 0;
  }

  &__pinned-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    cursor: pointer;
  }

  &__pinned-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  &__pinned-sender {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__pinned-text {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__pinned-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  &__pinned-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    &:hover {
      background: var(--bg-secondary, rgba(0, 0, 0, 0.05));
    }
    &--unpin {
      border-color: transparent;
      color: var(--text-secondary);
    }
  }
}
</style>
