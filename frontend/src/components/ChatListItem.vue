<script setup lang="ts">
import { computed } from 'vue';
import type { Chat } from '../types';
import { useChatStore } from '../stores/chat.store';
import { getChatName, getChatAvatar, getOtherParticipant, entityId } from '../utils/chatDisplay';
import { getComputedStatus } from '../utils/status';
import { formatChatListTime } from '../utils/formatTime';

const props = defineProps<{
  chat: Chat;
  isActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', chat: Chat): void;
  (e: 'contextmenu', chat: Chat, event: MouseEvent): void;
}>();

const chatStore = useChatStore();
const currentUserId = computed(() => chatStore.user?.id);
const chatName = computed(() => getChatName(props.chat, currentUserId.value));
const chatAvatar = computed(() => getChatAvatar(props.chat, currentUserId.value));
const otherParticipant = computed(() => getOtherParticipant(props.chat, currentUserId.value));
const unreadCount = computed(() => chatStore.getUnreadCount(entityId(props.chat)));
const isPinned = computed(() => chatStore.isChatPinned(entityId(props.chat)));

const getSenderName = (message: Chat['lastMessage']): string => {
  if (!message) return '';
  if (typeof message.senderId === 'string') return 'Пользователь';
  return message.senderId?.username || 'Пользователь';
};
</script>

<template>
  <div
    :class="['chat-list-item', { 'chat-list-item--active': isActive }]"
    @click="emit('select', chat)"
    @contextmenu.prevent="emit('contextmenu', chat, $event)"
  >
    <div class="chat-list-item__avatar">
      <img
        v-if="chatAvatar"
        :src="chatAvatar"
        :alt="chatName"
      />
      <div v-else class="chat-list-item__avatar-placeholder">
        {{ chatName.charAt(0).toUpperCase() }}
      </div>
      <span
        v-if="chat.type === 'private' && otherParticipant"
        :class="['chat-list-item__status', `chat-list-item__status--${getComputedStatus(otherParticipant)}`]"
      />
    </div>
    <div class="chat-list-item__content">
      <div class="chat-list-item__header">
        <span class="chat-list-item__name">
          {{ chatName }}
          <svg
            v-if="isPinned"
            class="chat-list-item__pin"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M16 12V4h1V2H7v2h1v8l-4 4v2h16v-2l-4-4z"/>
          </svg>
        </span>
        <div class="chat-list-item__meta">
          <span class="chat-list-item__time">{{ formatChatListTime(chat.lastMessage?.createdAt) }}</span>
          <span v-if="unreadCount > 0" class="chat-list-item__unread">
            {{ unreadCount }}
          </span>
        </div>
      </div>
      <div class="chat-list-item__preview">
        <span
          v-if="chat.lastMessage?.content"
          :class="['chat-list-item__message', { 'chat-list-item__message--unread': unreadCount > 0 }]"
        >
          {{ getSenderName(chat.lastMessage) }}: {{ chat.lastMessage.content }}
        </span>
        <span v-else class="chat-list-item__empty">Нет сообщений</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-list-item {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 10px;

  &:hover,
  &--active {
    background: var(--bg-secondary);
  }

  &__avatar {
    position: relative;
    width: 48px;
    height: 48px;
    flex-shrink: 0;

    img,
    &-placeholder {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
    }

    &-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
    }
  }

  &__status {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary);

    &--online { background: #34c759; }
    &--away { background: #ffcc00; }
    &--offline { background: #8e8e93; }
  }

  &__content {
    min-width: 0;
    flex: 1;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__pin {
    flex-shrink: 0;
    opacity: 0.6;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  &__time {
    font-size: 12px;
    color: var(--text-secondary);
  }

  &__unread {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--accent);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  &__preview {
    margin-top: 4px;
  }

  &__message,
  &__empty {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
    font-size: 13px;
  }

  &__message--unread {
    color: var(--text-primary);
    font-weight: 500;
  }
}
</style>
