<template>
  <div class="chat-view">
    <ChatList
      @new-chat="showNewChat = true"
      @new-group="showNewGroup = true"
      @show-profile="showProfile = true"
    />
    <ChatWindow />
    <ContactList
      v-if="showNewChat"
      @select-user="handleSelectUser"
      @close="showNewChat = false"
    />
    <CreateGroupModal
      :is-open="showNewGroup"
      @close="showNewGroup = false"
      @created="handleGroupCreated"
    />
    <UserProfile
      v-if="showProfile"
      @close="showProfile = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatList from '../components/ChatList.vue';
import ChatWindow from '../components/ChatWindow.vue';
import ContactList from '../components/ContactList.vue';
import CreateGroupModal from '../components/CreateGroupModal.vue';
import UserProfile from '../components/UserProfile.vue';
import { useChatStore } from '../stores/chat.store';
import { useWebSocket } from '../composables/useWebSocket';
import api from '../services/api';
import { User } from '../types';

const chatStore = useChatStore();
const route = useRoute();
const router = useRouter();
const showNewChat = ref(false);
const showNewGroup = ref(false);
const showProfile = ref(false);

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
  background: var(--bg-primary);
}
</style>
