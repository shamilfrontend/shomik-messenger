<script setup lang="ts">
import {
  ref, onMounted, watch, computed, onUnmounted, nextTick,
} from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatList from '../components/ChatList.vue';
import ChatWindow from '../components/ChatWindow.vue';
import NewChat from '../components/NewChat.vue';
import CreateGroupModal from '../components/CreateGroupModal.vue';
import ProfileView from './ProfileView.vue';
import CallsView from './CallsView.vue';
import TasksView from './TasksView.vue';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useWebSocket } from '../composables/useWebSocket';
import api from '../services/api';
import { User } from '../types';

const chatStore = useChatStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const chatWindowRef = ref<ComponentPublicInstance<{ scrollToBottom:() => void }> | null>(null);
const chatListRef = ref<ComponentPublicInstance<{ getCallById: (id: string) => any; getCallsHistory: () => any[]; getTaskById: (id: string) => any; getTasks: () => any[] }> | null>(null);
const showNewChat = ref(false);
const showNewGroup = ref(false);
const isMobile = ref(window.innerWidth <= 768);
const showChatWindow = computed(() => !!route.params.id || route.path === '/chat/new' || !!route.query.userId);
const showProfile = computed(() => route.path.startsWith('/profile') && route.path !== '/profile');
const showCalls = computed(() => route.path.startsWith('/calls'));
const showTasks = computed(() => route.path.startsWith('/tasks'));
const showTasksSection = computed(() => authStore.user?.params?.tasks === true);
const profileSection = computed(() => {
  const path = route.path;
  if (path === '/profile/me') return 'me';
  if (path === '/profile/design') return 'design';
  if (path === '/profile/audio-and-video') return 'audio-and-video';
  if (path === '/profile/language') return 'language';
  if (path === '/profile/sessions') return 'sessions';
  if (path === '/profile/advanced-features') return 'advanced-features';
  return null;
});
const callId = computed(() => route.params.callId as string | undefined);
const isNewCall = computed(() => route.path === '/calls/new');
const selectedCall = ref<any>(null);
const taskId = computed(() => route.params.taskId as string | undefined);
const isNewTask = computed(() => route.path === '/tasks/new');
const selectedTask = ref<any>(null);

const loadCall = async (): Promise<void> => {
  if (!callId.value || isNewCall.value) {
    selectedCall.value = null;
    return;
  }
  
  // Ждем, пока компонент ChatList будет готов
  let attempts = 0;
  const maxAttempts = 10;
  
  const tryLoadCall = async (): Promise<void> => {
    await nextTick();
    
    if (chatListRef.value) {
      try {
        if (typeof chatListRef.value.getCallById === 'function') {
          const call = chatListRef.value.getCallById(callId.value);
          if (call) {
            selectedCall.value = call;
            return;
          }
        }
        // Если функция еще не доступна, попробуем через getCallsHistory
        if (typeof chatListRef.value.getCallsHistory === 'function') {
          const calls = chatListRef.value.getCallsHistory();
          const call = calls.find((c: any) => c.id === callId.value);
          if (call) {
            selectedCall.value = call;
            return;
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки звонка:', error);
      }
    }
    
    // Если не получилось, пробуем еще раз
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(tryLoadCall, 50);
    } else {
      selectedCall.value = null;
    }
  };
  
  await tryLoadCall();
};

watch(callId, () => {
  if (callId.value) {
    loadCall();
  } else {
    selectedCall.value = null;
  }
}, { immediate: true });

watch(() => chatListRef.value, () => {
  if (callId.value && chatListRef.value) {
    loadCall();
  }
});

const loadTask = async (): Promise<void> => {
  if (!taskId.value || isNewTask.value) {
    selectedTask.value = null;
    return;
  }
  
  // Ждем, пока компонент ChatList будет готов
  let attempts = 0;
  const maxAttempts = 10;
  
  const tryLoadTask = async (): Promise<void> => {
    await nextTick();
    
    if (chatListRef.value) {
      try {
        if (typeof chatListRef.value.getTaskById === 'function') {
          const task = chatListRef.value.getTaskById(taskId.value);
          if (task) {
            selectedTask.value = task;
            return;
          }
        }
        // Если функция еще не доступна, попробуем через getTasks
        if (typeof chatListRef.value.getTasks === 'function') {
          const tasks = chatListRef.value.getTasks();
          const task = tasks.find((t: any) => t.id === taskId.value);
          if (task) {
            selectedTask.value = task;
            return;
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки задачи:', error);
      }
    }
    
    // Если не получилось, пробуем еще раз
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(tryLoadTask, 50);
    } else {
      selectedTask.value = null;
    }
  };
  
  await tryLoadTask();
};

watch(taskId, () => {
  if (taskId.value) {
    loadTask();
  } else {
    selectedTask.value = null;
  }
}, { immediate: true });

watch(() => chatListRef.value, () => {
  if (taskId.value && chatListRef.value) {
    loadTask();
  }
}, { immediate: true });

watch(() => route.path, () => {
  if (route.path === '/calls/new') {
    selectedCall.value = null;
  } else if (route.path.startsWith('/calls') && callId.value) {
    loadCall();
  } else if (route.path === '/calls') {
    selectedCall.value = null;
  } else if (route.path === '/tasks/new') {
    selectedTask.value = null;
  } else if (route.path.startsWith('/tasks') && taskId.value) {
    loadTask();
  } else if (route.path === '/tasks') {
    selectedTask.value = null;
  }
});

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
  // Загружаем чат из роута, если есть ID и это не роут /chat/new
  const chatId = route.params.id as string;
  if (chatId && chatId !== 'new') {
    await loadChatFromRoute(chatId);
  }
  // Загружаем звонок, если мы на странице звонков
  if (route.path.startsWith('/calls')) {
    await loadCall();
  }
  // Загружаем задачу, если мы на странице задач
  if (route.path.startsWith('/tasks')) {
    await loadTask();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

useWebSocket();


// Отслеживаем изменения роута
watch(() => route.params.id, async (newChatId) => {
  // Не загружаем чат если это роут /chat/new
  if (newChatId === 'new') {
    chatStore.setCurrentChat(null);
    return;
  }
  if (newChatId) {
    await loadChatFromRoute(newChatId as string);
  } else {
    chatStore.setCurrentChat(null);
  }
});

// Отслеживаем изменения роута для нового чата (/chat/new)
watch(() => [route.path, route.query.userId], ([path, userId]) => {
  if (path === '/chat/new' || (userId && !route.params.id)) {
    // Для нового чата не устанавливаем currentChat
    chatStore.setCurrentChat(null);
  }
});

const loadChatFromRoute = async (chatId: string): Promise<void> => {
  // Не загружаем чат если это роут /chat/new
  if (chatId === 'new') {
    chatStore.setCurrentChat(null);
    return;
  }

  // Проверяем, есть ли чат в списке
  let chat = chatStore.chats.find((c) => c._id === chatId);

  if (!chat) {
    // Если чата нет в списке, пытаемся загрузить его с сервера
    try {
      const response = await api.get(`/chats/${chatId}`);
      chat = response.data;
      // Добавляем чат в список, если его там нет
      if (!chatStore.chats.find((c) => c._id === chatId)) {
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
  // Открываем чат с выбранным пользователем без создания чата
  // Чат будет создан при отправке первого сообщения
  router.push(`/chat/new?userId=${user.id}`);
  showNewChat.value = false;
};

const handleGroupCreated = async (chatId: string): Promise<void> => {
  await chatStore.loadChats();
  router.push(`/chat/${chatId}`);
};
</script>

<template>
  <div class="chat-view">
    <ChatList
      ref="chatListRef"
      :class="{ 'chat-view__list--hidden': showChatWindow && isMobile }"
      @new-chat="showNewChat = true"
      @new-group="showNewGroup = true"
      @scroll-to-bottom-request="handleScrollToBottomRequest"
    />
    <ChatWindow
      v-if="showChatWindow && !showProfile && !showCalls"
      ref="chatWindowRef"
      @back="handleBack"
      :class="{ 'chat-view__window--full': showChatWindow && isMobile }"
    />
    <ProfileView
      v-if="showProfile && !showChatWindow && !showCalls && !showTasks && (route.path !== '/profile' || !isMobile)"
      :section="profileSection"
      :class="{ 'chat-view__profile--full': showProfile && isMobile && route.path !== '/profile' }"
    />
    <CallsView
      v-if="showCalls && !showChatWindow && !showProfile && !showTasks"
      :selected-call="selectedCall"
      :call-id="callId"
      :is-new-call="isNewCall"
      :is-calls-page="route.path === '/calls'"
      :class="{ 'chat-view__calls--full': showCalls && isMobile }"
    />
    <TasksView
      v-if="showTasks && showTasksSection && !showChatWindow && !showProfile && !showCalls"
      :selected-task="selectedTask"
      :task-id="taskId"
      :is-new-task="isNewTask"
      :is-tasks-page="route.path === '/tasks'"
      :class="{ 'chat-view__tasks--full': showTasks && isMobile }"
    />
    <div
      v-else-if="showTasks && !showTasksSection && !showChatWindow && !showProfile && !showCalls"
      class="chat-view__tasks-disabled"
    >
      <p>Раздел «Задачи» отключён.</p>
      <router-link to="/profile/advanced-features">Включить в настройках</router-link>
    </div>
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
        z-index: 12;
      }
    }
  }

  &__calls {
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

  &__tasks {
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

  &__tasks-disabled {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 0.95rem;

    a {
      color: var(--accent-color);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  }
}

@media (max-width: 768px) {
  .chat-view {
    flex-direction: column;
  }
}
</style>
