<template>
  <div class="chat-list">
    <div class="chat-list__header">
      <h2>Чаты</h2>
      <div class="chat-list__header-buttons">
        <button @click="$emit('show-profile')" class="chat-list__profile-button" title="Профиль">
          <img
            v-if="userAvatar"
            :src="userAvatar"
            :alt="user?.username || 'Профиль'"
            class="chat-list__profile-avatar"
          />
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>
        <button @click="$emit('new-group')" class="chat-list__new-button" title="Создать группу">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </button>
        <button
					@click="$emit('new-chat')"
					class="chat-list__new-button"
					title="Новый чат"
				>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <line x1="9" y1="10" x2="15" y2="10"></line>
            <line x1="12" y1="7" x2="12" y2="13"></line>
          </svg>
				</button>
      </div>
    </div>

    <div class="chat-list__tabs">
      <button
        @click="activeTab = 'private'"
        :class="['chat-list__tab', { 'chat-list__tab--active': activeTab === 'private' }]"
      >
        Чаты
        <span v-if="unreadPrivateChatsCount > 0" class="chat-list__tab-badge">
          {{ unreadPrivateChatsCount }}
        </span>
      </button>
      <button
        @click="activeTab = 'group'"
        :class="['chat-list__tab', { 'chat-list__tab--active': activeTab === 'group' }]"
      >
        Группы
        <span v-if="unreadGroupChatsCount > 0" class="chat-list__tab-badge">
          {{ unreadGroupChatsCount }}
        </span>
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
          <span
            v-if="chat.type === 'private' && getOtherParticipant(chat)"
            :class="['chat-list__status-indicator', `chat-list__status-indicator--${getComputedStatus(getOtherParticipant(chat))}`]"
          ></span>
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
import { useAuthStore } from '../stores/auth.store';
import { Chat, Message } from '../types';
import { getImageUrl } from '../utils/image';
import { getComputedStatus } from '../utils/status';
import type { User } from '../types';

defineEmits<{
  (e: 'new-chat'): void;
  (e: 'new-group'): void;
  (e: 'show-profile'): void;
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const searchQuery = ref('');
const activeTab = ref<'private' | 'group'>('private');

const user = computed(() => authStore.user);
const userAvatar = computed(() => {
  return getImageUrl(user.value?.avatar);
});

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
    return getImageUrl(chat.groupAvatar);
  }
  // Для приватных чатов находим аватар собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => {
    const participantId = typeof p === 'string' ? p : p.id;
    return participantId !== chatStore.user?.id;
  });
  
  if (!otherParticipant || typeof otherParticipant === 'string') {
    return undefined;
  }
  
  return getImageUrl(otherParticipant.avatar);
};

const getOtherParticipant = (chat: Chat): User | null => {
  if (chat.type === 'group') {
    return null;
  }
  const otherParticipant = chat.participants.find(p => {
    const participantId = typeof p === 'string' ? p : p.id;
    return participantId !== chatStore.user?.id;
  });
  
  if (!otherParticipant || typeof otherParticipant === 'string') {
    return null;
  }
  
  return otherParticipant;
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

const unreadPrivateChatsCount = computed((): number => {
  return chats.value.filter(chat => {
    if (chat.type !== 'private') return false;
    return chatStore.getUnreadCount(chat._id) > 0;
  }).length;
});

const unreadGroupChatsCount = computed((): number => {
  return chats.value.filter(chat => {
    if (chat.type !== 'group') return false;
    return chatStore.getUnreadCount(chat._id) > 0;
  }).length;
});

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

  @media (max-width: 768px) {
    width: 100%;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 5;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);

    @media (max-width: 768px) {
      padding: 0.75rem;
    }

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.25rem;

      @media (max-width: 768px) {
        font-size: 1.1rem;
      }
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    position: relative;

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

  &__tab-badge {
    background: #ff3b30;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
    min-width: 20px;
    text-align: center;
    line-height: 1.4;
  }

  &__profile-button {
    width: 36px;
    height: 36px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;

    svg {
      width: 18px;
      height: 18px;
      stroke-width: 2;
    }

    &:hover {
      transform: scale(1.1);
      opacity: 0.9;
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__profile-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  &__profile-initial {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
    color: white;
  }

  &__new-button {
    width: 36px;
    height: 36px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 18px;
      height: 18px;
      stroke-width: 2;
    }

    &:hover {
      transform: scale(1.1);
      background: var(--accent-color);
      opacity: 0.9;
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__search {
    padding: 0.75rem;

    @media (max-width: 768px) {
      padding: 0.5rem;
    }

    input {
      width: 100%;
      padding: 0.5rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      color: var(--text-primary);
      font-size: 0.9rem;

      @media (max-width: 768px) {
        padding: 0.625rem 0.875rem;
        font-size: 0.875rem;
      }

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

    @media (max-width: 768px) {
      padding: 0.625rem;
      gap: 0.5rem;
    }

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
    overflow: visible;
    flex-shrink: 0;
    position: relative;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__status-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bg-secondary);
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
