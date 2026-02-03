<template>
  <div class="chat-list">
    <div class="chat-list__header">
      <h2>Чаты</h2>
      <div class="chat-list__header-buttons">
        <button @click="$emit('show-profile')" class="chat-list__profile-button" title="Профиль">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>
        <button @click="$emit('new-group')" class="chat-list__new-button" title="Создать группу">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </button>
        <button @click="$emit('new-chat')" class="chat-list__new-button" title="Новый чат">+</button>
      </div>
    </div>

    <div class="chat-list__tabs">
      <button
        @click="activeTab = 'private'"
        :class="['chat-list__tab', { 'chat-list__tab--active': activeTab === 'private' }]"
      >
        Чаты
      </button>
      <button
        @click="activeTab = 'group'"
        :class="['chat-list__tab', { 'chat-list__tab--active': activeTab === 'group' }]"
      >
        Группы
      </button>
    </div>

    <div class="chat-list__search">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Поиск чатов..."
      />
    </div>

    <div class="chat-list__items">
      <div
        v-for="chat in filteredChats"
        :key="chat._id"
        :class="['chat-list__item', { 'chat-list__item--active': currentChat?._id === chat._id }]"
        @click="selectChat(chat)"
      >
        <div class="chat-list__avatar">
          <img
            v-if="getAvatar(chat)"
            :src="getAvatar(chat)"
            :alt="getChatName(chat)"
          />
          <div v-else class="chat-list__avatar-placeholder">
            {{ getChatName(chat).charAt(0).toUpperCase() }}
          </div>
        </div>

        <div class="chat-list__content">
          <div class="chat-list__header-row">
            <span class="chat-list__name">{{ getChatName(chat) }}</span>
            <div class="chat-list__header-right">
              <span class="chat-list__time">{{ formatTime(chat.lastMessage?.createdAt) }}</span>
              <span v-if="getUnreadCount(chat._id) > 0" class="chat-list__unread-badge">
                {{ getUnreadCount(chat._id) }}
              </span>
            </div>
          </div>
          <div class="chat-list__preview">
            <span v-if="chat.lastMessage" :class="['chat-list__message', { 'chat-list__message--unread': getUnreadCount(chat._id) > 0 }]">
              {{ getSenderName(chat.lastMessage) }}: {{ chat.lastMessage.content }}
            </span>
            <span v-else class="chat-list__empty">Нет сообщений</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat.store';
import { Chat, Message } from '../types';

const emit = defineEmits<{
  (e: 'new-chat'): void;
  (e: 'new-group'): void;
  (e: 'show-profile'): void;
}>();

const chatStore = useChatStore();
const router = useRouter();
const route = useRoute();
const searchQuery = ref('');
const activeTab = ref<'private' | 'group'>('private');

const currentChat = computed(() => {
  const chatId = route.params.id as string;
  if (chatId) {
    return chatStore.chats.find(c => c._id === chatId) || chatStore.currentChat;
  }
  return chatStore.currentChat;
});
const chats = computed(() => chatStore.chats);

const filteredChats = computed(() => {
  // Сначала фильтруем по типу чата (таб)
  let result = chats.value.filter(chat => chat.type === activeTab.value);
  
  // Затем фильтруем по поисковому запросу
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(chat => {
      const name = getChatName(chat).toLowerCase();
      return name.includes(query);
    });
  }
  
  return result;
});

const getChatName = (chat: Chat): string => {
  if (chat.type === 'group') {
    return chat.groupName || 'Группа';
  }
  // Для приватных чатов находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => {
    const participantId = typeof p === 'string' ? p : p.id;
    return participantId !== chatStore.user?.id;
  });
  
  if (!otherParticipant) {
    return 'Пользователь';
  }
  
  return typeof otherParticipant === 'string' ? 'Пользователь' : (otherParticipant.username || 'Пользователь');
};

const getAvatar = (chat: Chat): string | undefined => {
  if (chat.type === 'group') {
    return chat.groupAvatar;
  }
  // Для приватных чатов находим аватар собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => {
    const participantId = typeof p === 'string' ? p : p.id;
    return participantId !== chatStore.user?.id;
  });
  
  if (!otherParticipant || typeof otherParticipant === 'string') {
    return undefined;
  }
  
  return otherParticipant.avatar;
};

const getSenderName = (message: Message): string => {
  if (typeof message.senderId === 'string') {
    return 'Пользователь';
  }
  return message.senderId.username;
};

const formatTime = (date?: Date | string): string => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Вчера';
  } else if (days < 7) {
    return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const getUnreadCount = (chatId: string): number => {
  return chatStore.getUnreadCount(chatId);
};

const selectChat = (chat: Chat): void => {
  router.push(`/chat/${chat._id}`);
};
</script>

<style scoped lang="scss">
.chat-list {
  width: 350px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.25rem;
    }
  }

  &__header-buttons {
    display: flex;
    gap: 0.5rem;
  }

  &__tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    padding: 0 1rem;
    background: var(--bg-secondary);
  }

  &__tab {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-primary);
    }

    &--active {
      color: var(--accent-color);
      border-bottom-color: var(--accent-color);
      font-weight: 600;
    }
  }

  &__profile-button,
  &__new-button {
    width: 32px;
    height: 32px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    transition: transform 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      transform: scale(1.1);
    }
  }

  &__search {
    padding: 0.75rem;

    input {
      width: 100%;
      padding: 0.5rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      color: var(--text-primary);
      font-size: 0.9rem;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }
    }
  }

  &__items {
    flex: 1;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid var(--border-color);

    &:hover {
      background: var(--bg-primary);
    }

    &--active {
      background: var(--bg-primary);
    }
  }

  &__avatar {
    width: 50px;
    height: 50px;
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
    font-size: 1.25rem;
  }

  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  &__time {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  &__unread-badge {
    background: #ff3b30;
    color: white;
    border-radius: 12px;
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
  }

  &__preview {
    display: flex;
    align-items: center;
  }

  &__message {
    color: var(--text-secondary);
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--unread {
      color: var(--text-primary);
      font-weight: 600;
    }
  }

  &__empty {
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-style: italic;
  }
}
</style>
