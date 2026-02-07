<template>
  <div class="chat-list">
    <div class="chat-list__header">
      <h2>{{ activeTab === 'private' ? 'Чаты' : 'Группы' }}</h2>
      <div class="chat-list__header-buttons">
        <button
          v-if="activeTab === 'private'"
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
        <button
          v-if="activeTab === 'group'"
          @click="$emit('new-group')"
          class="chat-list__new-button"
          title="Создать группу"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </button>
      </div>
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
        @contextmenu.prevent="onChatContextMenu(chat, $event)"
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
            <span v-if="chat.lastMessage && chat.lastMessage.content" :class="['chat-list__message', { 'chat-list__message--unread': getUnreadCount(chat._id) > 0 }]">
              {{ getSenderName(chat.lastMessage) }}: {{ chat.lastMessage.content }}
            </span>
            <span v-else class="chat-list__empty">Нет сообщений</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Нижняя навигация -->
    <div class="chat-list__bottom-nav">
      <button
        @click="goToChats"
        :class="['chat-list__nav-item', { 'chat-list__nav-item--active': activeTab === 'private' && !isProfilePage }]"
        title="Чаты"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="chat-list__nav-label">Чаты</span>
        <span v-if="unreadPrivateChatsCount > 0" class="chat-list__nav-badge">
          {{ unreadPrivateChatsCount }}
        </span>
      </button>
      <button
        @click="goToGroups"
        :class="['chat-list__nav-item', { 'chat-list__nav-item--active': activeTab === 'group' && !isProfilePage }]"
        title="Группы"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span class="chat-list__nav-label">Группы</span>
        <span v-if="unreadGroupChatsCount > 0" class="chat-list__nav-badge">
          {{ unreadGroupChatsCount }}
        </span>
      </button>
      <button
        @click="goToProfile"
        class="chat-list__nav-item"
        :class="{ 'chat-list__nav-item--active': isProfilePage }"
        title="Профиль"
      >
        <div class="chat-list__nav-avatar">
          <img
            v-if="userAvatar"
            :src="userAvatar"
            :alt="user?.username || 'Профиль'"
            class="chat-list__nav-avatar-img"
          />
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <span class="chat-list__nav-label">Профиль</span>
      </button>
    </div>

    <ContextMenu
      v-model="chatContextMenuVisible"
      :x="chatContextMenuX"
      :y="chatContextMenuY"
      :actions="chatContextMenuActions"
      @select="onChatContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useConfirm } from '../composables/useConfirm';
import { useNotifications } from '../composables/useNotifications';
import ContextMenu from './ContextMenu.vue';
import type { ContextMenuAction } from './ContextMenu.vue';
import { Chat, Message } from '../types';
import { getImageUrl } from '../utils/image';
import { getComputedStatus } from '../utils/status';
import type { User } from '../types';

const emit = defineEmits<{
  (e: 'new-chat'): void;
  (e: 'new-group'): void;
  (e: 'scroll-to-bottom-request'): void;
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();
const { confirm } = useConfirm();
const { success: notifySuccess, error: notifyError } = useNotifications();
const router = useRouter();
const route = useRoute();
const searchQuery = ref('');
const activeTab = ref<'private' | 'group'>('private');

const chatContextMenuVisible = ref(false);
const chatContextMenuX = ref(0);
const chatContextMenuY = ref(0);
const chatContextChat = ref<Chat | null>(null);

const chatContextMenuActions = computed((): ContextMenuAction[] => {
  if (!chatContextChat.value || chatContextChat.value.type !== 'private') return [];
  return [{ id: 'delete', label: 'Удалить чат', icon: 'trash' }];
});

const onChatContextMenu = (chat: Chat, e: MouseEvent): void => {
  if (chat.type !== 'private') return;
  chatContextChat.value = chat;
  chatContextMenuX.value = e.clientX;
  chatContextMenuY.value = e.clientY;
  chatContextMenuVisible.value = true;
};

const onChatContextMenuSelect = async (action: ContextMenuAction): Promise<void> => {
  const chat = chatContextChat.value;
  chatContextChat.value = null;
  if (!chat || action.id !== 'delete') return;
  const confirmed = await confirm('Удалить этот чат? История сообщений будет удалена.');
  if (!confirmed) return;
  try {
    await chatStore.deleteChat(chat._id);
    notifySuccess('Чат удалён');
    if (route.params.id === chat._id) {
      router.push('/');
    }
  } catch (err: any) {
    notifyError(err.response?.data?.error || 'Не удалось удалить чат');
  }
};

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
  if (!message.senderId || typeof message.senderId !== 'object') {
    return 'Пользователь';
  }
  return message.senderId.username || 'Пользователь';
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
  if (chatStore.currentChat?._id === chat._id) {
    emit('scroll-to-bottom-request');
    return;
  }
  router.push(`/chat/${chat._id}`);
};

const goToChats = (): void => {
  activeTab.value = 'private';
  router.push('/');
};

const goToGroups = (): void => {
  activeTab.value = 'group';
  router.push('/');
};

const goToProfile = (): void => {
  router.push('/profile');
};

const isProfilePage = computed(() => route.path === '/profile');
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
    height: 100%;
    height: 100dvh;
    min-height: -webkit-fill-available;
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

    @media (max-width: 768px) {
      padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    }
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
    flex-shrink: 0;
    position: relative;
		overflow: hidden;

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
		border-radius: 50%;
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

  &__bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 0.5rem 0;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    position: sticky;
    bottom: 0;
    z-index: 10;

    @media (max-width: 768px) {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.75rem 0;
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
    }
  }

  &__nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    flex: 1;
    min-width: 0;

    @media (max-width: 768px) {
      padding: 0.5rem 0.75rem;
    }

    svg {
      width: 24px;
      height: 24px;
      transition: color 0.2s;

      @media (max-width: 768px) {
        width: 22px;
        height: 22px;
      }
    }

    &:hover {
      color: var(--accent-color);
      background: rgba(var(--accent-color-rgb, 82, 136, 193), 0.1);
    }

    &--active {
      color: var(--accent-color);

      svg {
        color: var(--accent-color);
      }

      .chat-list__nav-label {
        color: var(--accent-color);
        font-weight: 600;
      }
    }
  }

  &__nav-avatar {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;

    @media (max-width: 768px) {
      width: 22px;
      height: 22px;
    }
  }

  &__nav-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  &__nav-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    transition: color 0.2s;
    white-space: nowrap;

    @media (max-width: 768px) {
      font-size: 0.7rem;
    }
  }

  &__nav-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.5rem;
    background: #ff3b30;
    color: white;
    border-radius: 10px;
    padding: 0.125rem 0.375rem;
    font-size: 0.65rem;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
    line-height: 1.2;

    @media (max-width: 768px) {
      top: 0.125rem;
      right: 0.375rem;
      font-size: 0.6rem;
      padding: 0.1rem 0.3rem;
      min-width: 16px;
    }
  }
}
</style>