<template>
  <div class="chat-view">
    <ChatList
      :class="{ 'chat-view__list--hidden': (showChatWindow || showProfile) && isMobile }"
      @new-chat="showNewChat = true"
      @new-group="showNewGroup = true"
      @scroll-to-bottom-request="handleScrollToBottomRequest"
    />
    <ChatWindow
      v-if="showChatWindow && !showProfile"
      ref="chatWindowRef"
      @back="handleBack"
      :class="{ 'chat-view__window--full': showChatWindow && isMobile }"
    />
    <ProfileView 
      v-if="showProfile && !showChatWindow"
      :class="{ 'chat-view__profile--full': showProfile && isMobile }"
    />
    <NewChat
      :is-open="showNewChat"
      @select-user="handleSelectUser"
      @close="showNewChat = false"
    />
    <CreateGroupModal
      :is-open="showNewGroup"
      @close="showNewGroup = false"
      @created="handleGroupCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatList from '../components/ChatList.vue';
import ChatWindow from '../components/ChatWindow.vue';
import NewChat from '../components/NewChat.vue';
import CreateGroupModal from '../components/CreateGroupModal.vue';
import ProfileView from './ProfileView.vue';
import { useChatStore } from '../stores/chat.store';
import { useWebSocket } from '../composables/useWebSocket';
import api from '../services/api';
import { User } from '../types';

const chatStore = useChatStore();
const route = useRoute();
const router = useRouter();
const chatWindowRef = ref<ComponentPublicInstance<{ scrollToBottom: () => void }> | null>(null);
const showNewChat = ref(false);
const showNewGroup = ref(false);
const isMobile = ref(window.innerWidth <= 768);
const showChatWindow = computed(() => !!route.params.id);
const showProfile = computed(() => route.path === '/profile');

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

const handleBack = (): void => {
  router.push('/');
};

const handleScrollToBottomRequest = (): void => {
  chatWindowRef.value?.scrollToBottom?.();
};

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await chatStore.loadChats();
  // Загружаем чат из роута, если есть ID
  const chatId = route.params.id as string;
  if (chatId) {
    await loadChatFromRoute(chatId);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

useWebSocket();

onMounted(async () => {
  await chatStore.loadChats();
  // Загружаем чат из роута, если есть ID
  const chatId = route.params.id as string;
  if (chatId) {
    await loadChatFromRoute(chatId);
  }
});

// Отслеживаем изменения роута
watch(() => route.params.id, async (newChatId) => {
  if (newChatId) {
    await loadChatFromRoute(newChatId as string);
  } else {
    chatStore.setCurrentChat(null);
  }
});

const loadChatFromRoute = async (chatId: string): Promise<void> => {
  // Проверяем, есть ли чат в списке
  let chat = chatStore.chats.find(c => c._id === chatId);
  
  if (!chat) {
    // Если чата нет в списке, пытаемся загрузить его с сервера
    try {
      const response = await api.get(`/chats/${chatId}`);
      chat = response.data;
      // Добавляем чат в список, если его там нет
      if (!chatStore.chats.find(c => c._id === chatId)) {
        chatStore.chats.push(chat);
      }
    } catch (error) {
      console.error('Ошибка загрузки чата:', error);
      router.push('/');
      return;
    }
  }
  
  if (chat) {
    chatStore.setCurrentChat(chat);
  } else {
    // Если чат не найден, перенаправляем на главную
    router.push('/');
  }
};

const handleSelectUser = async (user: User): Promise<void> => {
  try {
    const chat = await chatStore.createChat('private', [user.id]);
    router.push(`/chat/${chat._id}`);
    showNewChat.value = false;
  } catch (error) {
    console.error('Ошибка создания чата:', error);
  }
};

const handleGroupCreated = async (chatId: string): Promise<void> => {
  await chatStore.loadChats();
  router.push(`/chat/${chatId}`);
};
</script>

<style scoped lang="scss">
.chat-view {
  display: flex;
  height: 100vh;
  height: 100dvh;
  min-height: -webkit-fill-available;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;

  &__list {
    &--hidden {
      @media (max-width: 768px) {
        display: none;
      }
    }
  }

  &__window {
    flex: 1;
    display: flex;

    &--full {
      @media (max-width: 768px) {
        width: 100%;
        position: absolute;
        left: 0;
        top: 0;
        z-index: 10;
      }
    }
  }

  &__profile {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);

    &--full {
      @media (max-width: 768px) {
        width: 100%;
        position: absolute;
        left: 0;
        top: 0;
        z-index: 10;
      }
    }
  }
}

@media (max-width: 768px) {
  .chat-view {
    flex-direction: column;
  }
}
</style>
