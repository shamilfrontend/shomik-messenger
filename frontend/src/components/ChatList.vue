<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useConfirm } from '../composables/useConfirm';
import { useNotifications } from '../composables/useNotifications';
import { useSettings } from '../composables/useSettings';
import ContextMenu from './ContextMenu.vue';
import ChatListItem from './ChatListItem.vue';
import ChatCallsList from './ChatCallsList.vue';
import ChatTasksList from './ChatTasksList.vue';
import ChatProfileNav from './ChatProfileNav.vue';
import type { ProfileSection } from './ChatProfileNav.vue';
import CallsView from '../views/CallsView.vue';
import ProfileView from '../views/ProfileView.vue';
import TasksView from '../views/TasksView.vue';
import type { ContextMenuAction } from './ContextMenu.vue';
import { Chat } from '../types';
import { getImageUrl } from '../utils/image';
import { getChatName } from '../utils/chatDisplay';
import { useSidebarStore } from '../stores/sidebar.store';
import { storeToRefs } from 'pinia';
import type { CallHistory, TaskItem as Task } from '../stores/sidebar.store';

const emit = defineEmits<{(e: 'new-chat'): void;
  (e: 'new-group'): void;
  (e: 'scroll-to-bottom-request'): void;
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();
const sidebarStore = useSidebarStore();
const { callsHistory, tasks } = storeToRefs(sidebarStore);
const { confirm } = useConfirm();
const { success: notifySuccess, error: notifyError } = useNotifications();
const { isChatMuted, toggleChatMuted } = useSettings();
const router = useRouter();
const route = useRoute();
const searchQuery = ref('');
const activeTab = ref<'private' | 'group'>('private');
const isMobile = ref(window.innerWidth <= 768);
const selectedCallModal = ref<CallHistory | null>(null);
const showCallModal = ref(false);
const showProfileModal = ref(false);
const currentProfileSectionModal = ref<string | null>(null);
const selectedTaskModal = ref<Task | null>(null);
const showTaskModal = ref(false);

watch(
  () => route.query.type,
  (type) => {
    if (type === 'private' || type === 'group') {
      activeTab.value = type;
    }
  },
  { immediate: true },
);

const chatContextMenuVisible = ref(false);
const chatContextMenuX = ref(0);
const chatContextMenuY = ref(0);
const chatContextChat = ref<Chat | null>(null);

const chatContextMenuActions = computed((): ContextMenuAction[] => {
  if (!chatContextChat.value) return [];
  const chat = chatContextChat.value;
  const isPinned = chatStore.isChatPinned(chat._id);
  const muted = isChatMuted(chat._id);
  const actions: ContextMenuAction[] = [
    {
      id: 'pin',
      label: isPinned ? 'Открепить чат' : 'Закрепить чат',
      icon: isPinned ? 'unpin' : 'pin',
    },
    {
      id: 'mute',
      label: muted ? 'Включить уведомления' : 'Отключить уведомления',
      icon: 'mute',
    },
  ];
  if (chat.type === 'private') {
    actions.push({ id: 'delete', label: 'Удалить чат', icon: 'trash' });
  }
  return actions;
});

const onChatContextMenu = (chat: Chat, e: MouseEvent): void => {
  chatContextChat.value = chat;
  chatContextMenuX.value = e.clientX;
  chatContextMenuY.value = e.clientY;
  chatContextMenuVisible.value = true;
};

const onChatContextMenuSelect = async (action: ContextMenuAction): Promise<void> => {
  const chat = chatContextChat.value;
  chatContextChat.value = null;
  if (!chat) return;

  if (action.id === 'pin') {
    try {
      await chatStore.togglePinChat(chat._id);
      const isPinned = chatStore.isChatPinned(chat._id);
      notifySuccess(isPinned ? 'Чат закреплён' : 'Чат откреплён');
    } catch (err: any) {
      notifyError(err.response?.data?.error || 'Не удалось изменить закрепление');
    }
    return;
  }

  if (action.id === 'mute') {
    try {
      const nowMuted = await toggleChatMuted(chat._id);
      notifySuccess(nowMuted ? 'Уведомления отключены' : 'Уведомления включены');
    } catch (err: any) {
      notifyError(err.response?.data?.error || 'Не удалось изменить настройки уведомлений');
    }
    return;
  }

  if (action.id === 'delete') {
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
  }
};

const user = computed(() => authStore.user);
const userAvatar = computed(() => getImageUrl(user.value?.avatar));

const currentChat = computed(() => {
  const chatId = route.params.id as string;
  if (chatId) {
    return chatStore.chats.find((c) => c._id === chatId) || chatStore.currentChat;
  }
  return chatStore.currentChat;
});
const chats = computed(() => chatStore.chats);

const filteredChats = computed(() => {
  // Сначала фильтруем по типу чата (таб)
  let result = chats.value.filter((chat) => chat.type === activeTab.value);

  // Затем фильтруем по поисковому запросу
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((chat) => {
      const name = getChatName(chat, chatStore.user?.id).toLowerCase();
      return name.includes(query);
    });
  }

  // Сортируем: закрепленные чаты наверху
  result.sort((a, b) => {
    const aPinned = chatStore.isChatPinned(a._id);
    const bPinned = chatStore.isChatPinned(b._id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return result;
});

const unreadPrivateChatsCount = computed((): number => chats.value.filter((chat) => {
  if (chat.type !== 'private') return false;
  return chatStore.getUnreadCount(chat._id) > 0;
}).length);

const unreadGroupChatsCount = computed((): number => chats.value.filter((chat) => {
  if (chat.type !== 'group') return false;
  return chatStore.getUnreadCount(chat._id) > 0;
}).length);

/** Сумма непрочитанных сообщений в личных чатах */
const unreadPrivateMessagesCount = computed((): number => chats.value
  .filter((c) => c.type === 'private')
  .reduce((sum, c) => sum + chatStore.getUnreadCount(c._id), 0));

/** Сумма непрочитанных сообщений в групповых чатах */
const unreadGroupMessagesCount = computed((): number => chats.value
  .filter((c) => c.type === 'group')
  .reduce((sum, c) => sum + chatStore.getUnreadCount(c._id), 0));

const selectChat = (chat: Chat): void => {
  if (chatStore.currentChat?._id === chat._id) {
    emit('scroll-to-bottom-request');
    return;
  }
  router.push({ path: `/chat/${chat._id}`, query: { ...route.query, type: chat.type } });
};

const goToChats = (): void => {
  activeTab.value = 'private';
  router.push({ path: '/', query: { ...route.query, type: 'private' } });
};

const goToGroups = (): void => {
  activeTab.value = 'group';
  router.push({ path: '/', query: { ...route.query, type: 'group' } });
};

const switchTab = (type: 'private' | 'group'): void => {
  activeTab.value = type;
  const path = route.path === '/' || route.path === '/chat' ? route.path : '/';
  router.push({ path, query: { ...route.query, type } });
};

const goToCalls = (): void => {
  router.push('/calls');
};

const goToTasks = (): void => {
  router.push('/tasks');
};

const goToProfile = (): void => {
  // На мобильных переходим на страницу со списком подпунктов профиля
  if (isMobile.value) {
    router.push('/profile');
  } else {
    router.push('/profile/me');
  }
};

const isCallsPage = computed(() => route.path.startsWith('/calls'));
const isProfilePage = computed(() => route.path.startsWith('/profile'));
const isTasksPage = computed(() => route.path.startsWith('/tasks'));
const showTasksSection = computed(() => authStore.user?.params?.tasks === true);
const isChatsPage = computed(() => {
  const path = route.path;
  return path === '/' || path === '/chat' || path.startsWith('/chat/');
});
const currentCallId = computed(() => route.params.callId as string | undefined);
const currentTaskId = computed(() => route.params.taskId as string | undefined);
const currentProfileSection = computed(() => {
  const path = route.path;
  if (path === '/profile/me') return 'me';
  if (path === '/profile/design') return 'design';
  if (path === '/profile/audio-and-video') return 'audio-and-video';
  if (path === '/profile/language') return 'language';
  if (path === '/profile/sessions') return 'sessions';
  if (path === '/profile/advanced-features') return 'advanced-features';
  return null;
});

const profileSections = ref<ProfileSection[]>([
  {
    id: 'me',
    label: 'Мой профиль',
    path: '/profile/me',
    icon: 'user',
  },
  {
    id: 'design',
    label: 'Оформление',
    path: '/profile/design',
    icon: 'palette',
  },
  {
    id: 'audio-and-video',
    label: 'Аудио и Видео',
    path: '/profile/audio-and-video',
    icon: 'mic',
  },
  {
    id: 'language',
    label: 'Язык',
    path: '/profile/language',
    icon: 'globe',
  },
  {
    id: 'sessions',
    label: 'Активные сессии',
    path: '/profile/sessions',
    icon: 'monitor',
  },
  {
    id: 'advanced-features',
    label: 'Расширенные возможности',
    path: '/profile/advanced-features',
    icon: 'sliders',
  },
]);

const selectProfileSection = (section: ProfileSection): void => {
  if (isMobile.value) {
    // На мобильных открываем модальное окно для всех подпунктов, кроме "Мой профиль" (me)
    // "Мой профиль" показывает список подпунктов, поэтому модальное окно не нужно
    if (section.id !== 'me') {
      currentProfileSectionModal.value = section.id;
      showProfileModal.value = true;
    } else {
      // Для "Мой профиль" просто переходим на роут (показывает список подпунктов)
      router.push(section.path);
    }
  } else {
    router.push(section.path);
  }
};

const selectCall = (call: CallHistory): void => {
  if (isMobile.value) {
    selectedCallModal.value = call;
    showCallModal.value = true;
  } else {
    router.push(`/calls/${call.id}`);
  }
};

const selectTask = (task: Task): void => {
  if (isMobile.value) {
    selectedTaskModal.value = task;
    showTaskModal.value = true;
  } else {
    router.push(`/tasks/${task.id}`);
  }
};

const isNewCallPage = computed(() => route.path === '/calls/new');
const isNewTaskPage = computed(() => route.path === '/tasks/new');

const closeCallModal = (): void => {
  showCallModal.value = false;
  selectedCallModal.value = null;
  // Если мы были на странице создания звонка, возвращаемся на /calls
  if (isNewCallPage.value && isMobile.value) {
    router.push('/calls');
  }
};

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

const getProfileSectionFromPath = (path: string): string | null => {
  if (path === '/profile/me') return 'me';
  if (path === '/profile/design') return 'design';
  if (path === '/profile/audio-and-video') return 'audio-and-video';
  if (path === '/profile/language') return 'language';
  if (path === '/profile/sessions') return 'sessions';
  if (path === '/profile/advanced-features') return 'advanced-features';
  return null;
};

// Отслеживаем переход на /calls/new, /tasks/new и подпункты профиля на мобильных устройствах
watch(
  () => [route.path, isMobile.value],
  ([path, mobile]) => {
    if (mobile && path === '/calls/new') {
      selectedCallModal.value = null; // null означает создание нового звонка
      showCallModal.value = true;
    } else if (mobile && path.startsWith('/calls') && path !== '/calls/new') {
      // Если перешли на другую страницу звонков, закрываем модальное окно
      showCallModal.value = false;
    }
    
    // Отслеживаем переход на /tasks/new на мобильных устройствах
    if (mobile && path === '/tasks/new') {
      selectedTaskModal.value = null; // null означает создание новой задачи
      showTaskModal.value = true;
    } else if (mobile && path.startsWith('/tasks') && path !== '/tasks/new') {
      // Если перешли на другую страницу задач, закрываем модальное окно
      showTaskModal.value = false;
    }
    
    // Отслеживаем переход на подпункты профиля на мобильных устройствах
    // Открываем модальное окно только для конкретных подразделов (не для /profile/me, который показывает список)
    if (mobile && path.startsWith('/profile/') && path !== '/profile' && path !== '/profile/me') {
      const section = getProfileSectionFromPath(path);
      if (section) {
        currentProfileSectionModal.value = section;
        showProfileModal.value = true;
      }
    } else if (mobile && (path === '/profile/me' || !path.startsWith('/profile') || path === '/profile')) {
      // Если перешли на /profile/me (список подпунктов) или на другую страницу, закрываем модальное окно
      showProfileModal.value = false;
    }
  },
  { immediate: true }
);

const closeProfileModal = (): void => {
  showProfileModal.value = false;
  currentProfileSectionModal.value = null;
  // Если мы были на подпункте профиля, возвращаемся на страницу профиля со списком подпунктов
  if (isProfilePage.value && isMobile.value && route.path.startsWith('/profile/')) {
    router.push('/profile/me');
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
  // Проверяем начальное состояние роута
  if (isMobile.value && route.path === '/calls/new') {
    selectedCallModal.value = null;
    showCallModal.value = true;
  }
  // Проверяем начальное состояние роута подпунктов профиля
  // Открываем модальное окно только для подпунктов, но не для /profile/me (список подпунктов)
  if (isMobile.value && route.path.startsWith('/profile/') && route.path !== '/profile' && route.path !== '/profile/me') {
    const section = getProfileSectionFromPath(route.path);
    if (section) {
      currentProfileSectionModal.value = section;
      showProfileModal.value = true;
    }
  }
  // Проверяем начальное состояние роута задач
  if (isMobile.value && route.path === '/tasks/new') {
    selectedTaskModal.value = null;
    showTaskModal.value = true;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

</script>

<template>
  <div class="chat-list">
    <div class="chat-list__header">
      <h2>{{ isProfilePage ? 'Профиль' : (isCallsPage ? 'Звонки' : (isTasksPage ? 'Задачи' : (activeTab === 'private' ? 'Чаты' : 'Группы'))) }}</h2>
      <div class="chat-list__header-buttons">
        <button
          v-if="activeTab === 'private' && !isCallsPage && !isProfilePage && !isTasksPage"
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
          v-if="activeTab === 'group' && !isCallsPage && !isProfilePage && !isTasksPage"
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
        <button
          v-if="isCallsPage && !isProfilePage"
          @click="isMobile ? (selectedCallModal = null, showCallModal = true) : router.push('/calls/new')"
          class="chat-list__new-button"
          title="Создать звонок"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </button>
        <button
          v-if="isTasksPage && !isProfilePage && showTasksSection"
          @click="isMobile ? (selectedTaskModal = null, showTaskModal = true) : router.push('/tasks/new')"
          class="chat-list__new-button"
          title="Создать задачу"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Табы для переключения между чатами и группами -->
    <div v-if="!isProfilePage && !isCallsPage && !isTasksPage" class="chat-list__tabs">
      <button
        @click="switchTab('private')"
        :class="['chat-list__tab', { 'chat-list__tab--active': activeTab === 'private' }]"
      >
        Чаты
        <span v-if="unreadPrivateMessagesCount > 0" class="chat-list__tab-badge">{{ unreadPrivateMessagesCount }}</span>
      </button>
      <button
        @click="switchTab('group')"
        :class="['chat-list__tab', { 'chat-list__tab--active': activeTab === 'group' }]"
      >
        Группы
        <span v-if="unreadGroupMessagesCount > 0" class="chat-list__tab-badge">{{ unreadGroupMessagesCount }}</span>
      </button>
    </div>

    <div v-if="!isProfilePage" class="chat-list__search">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="isCallsPage ? 'Поиск звонков...' : (isTasksPage ? 'Поиск задач...' : 'Поиск чатов...')"
      />
    </div>

    <div class="chat-list__items">
      <ChatCallsList
        v-if="isCallsPage"
        :calls="callsHistory"
        :search="searchQuery"
        :active-id="currentCallId"
        @select="selectCall"
      />
      <ChatTasksList
        v-else-if="isTasksPage"
        :tasks="tasks"
        :search="searchQuery"
        :active-id="currentTaskId"
        :enabled="showTasksSection"
        @select="selectTask"
      />
      <ChatProfileNav
        v-else-if="isProfilePage"
        :sections="profileSections"
        :active-id="currentProfileSection"
        @select="selectProfileSection"
      />
      <template v-else>
        <ChatListItem
          v-for="chat in filteredChats"
          :key="chat._id"
          :chat="chat"
          :is-active="currentChat?._id === chat._id"
          @select="selectChat"
          @contextmenu="onChatContextMenu"
        />
      </template>
    </div>

    <!-- Нижняя навигация -->
    <div class="chat-list__bottom-nav">
      <button
        @click="goToChats"
        :class="['chat-list__nav-item', { 'chat-list__nav-item--active': isChatsPage }]"
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
        @click="goToCalls"
        :class="['chat-list__nav-item', { 'chat-list__nav-item--active': isCallsPage }]"
        title="Звонки"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span class="chat-list__nav-label">Звонки</span>
      </button>
      <button
        v-if="showTasksSection"
        @click="goToTasks"
        :class="['chat-list__nav-item', { 'chat-list__nav-item--active': route.path.startsWith('/tasks') }]"
        title="Задачи"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <span class="chat-list__nav-label">Задачи</span>
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

    <!-- Модальное окно детального вида звонка для мобильных устройств -->
    <Teleport to="body">
      <div
        v-if="(showCallModal || (isMobile && isNewCallPage)) && isMobile"
        class="chat-list__call-modal"
        @click.self="closeCallModal"
      >
        <div class="chat-list__call-modal-content">
          <button
            class="chat-list__call-modal-close"
            @click="closeCallModal"
            type="button"
            aria-label="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <CallsView
            :selected-call="selectedCallModal"
            :is-calls-page="false"
            :is-new-call="selectedCallModal === null"
          />
        </div>
      </div>
    </Teleport>

    <!-- Модальное окно подпунктов профиля для мобильных устройств -->
    <Teleport to="body">
      <div
        v-if="showProfileModal && isMobile && currentProfileSectionModal"
        class="chat-list__profile-modal"
        @click.self="closeProfileModal"
      >
        <div class="chat-list__profile-modal-content">
          <button
            class="chat-list__profile-modal-close"
            @click="closeProfileModal"
            type="button"
            aria-label="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <ProfileView
            :section="currentProfileSectionModal"
          />
        </div>
      </div>
    </Teleport>

    <!-- Модальное окно детального вида задачи для мобильных устройств -->
    <Teleport to="body">
      <div
        v-if="(showTaskModal || (isMobile && isNewTaskPage)) && isMobile"
        class="chat-list__task-modal"
        @click.self="closeTaskModal"
      >
        <div class="chat-list__task-modal-content">
          <button
            class="chat-list__task-modal-close"
            @click="closeTaskModal"
            type="button"
            aria-label="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <TasksView
            :selected-task="selectedTaskModal"
            :task-id="selectedTaskModal?.id"
            :is-new-task="selectedTaskModal === null"
            :is-tasks-page="false"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.chat-list {
  width: 350px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface, var(--bg-secondary));
  border-right: 1px solid var(--border-color);
  z-index: 11;

  @media (max-width: 768px) {
    width: 100%;
    height: 100%;
    height: 100dvh;
    min-height: -webkit-fill-available;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 11;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--surface, var(--bg-secondary));

    @media (max-width: 768px) {
      padding: 0.75rem 1rem;
    }

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-heading-size, 1.25rem);
      font-weight: var(--font-heading-weight, 600);

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
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    svg {
      width: 18px;
      height: 18px;
      stroke-width: 2;
    }

    &:hover {
      transform: scale(1.05);
      background: var(--accent-hover);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
    }

    &:active {
      transform: scale(0.98);
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
      border-radius: var(--radius-md, 12px);
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

  &__tabs {
    display: flex;
    gap: 0;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);

    @media (max-width: 768px) {
      padding: 0.5rem 0.75rem;
    }
  }

  &__tab {
    flex: 1;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle, var(--border-color));
    border-radius: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    @media (max-width: 768px) {
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
    }

    &:first-child {
      border-radius: var(--radius-sm, 8px) 0 0 var(--radius-sm, 8px);
      border-right: none;
    }

    &:last-child {
      border-radius: 0 var(--radius-sm, 8px) var(--radius-sm, 8px) 0;
      border-left: none;
    }

    &:only-child {
      border-radius: var(--radius-sm, 8px);
      border: 1px solid var(--border-subtle, var(--border-color));
    }

    &:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    &--active {
      background: var(--accent-color);
      color: white;
      border-color: var(--accent-color);

      &:hover {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
      }

      .chat-list__tab-badge {
        background: rgba(255, 255, 255, 0.35);
        color: white;
      }
    }
  }

  &__tab-badge {
    margin-left: 0.35rem;
    padding: 0.125rem 0.4rem;
    background: var(--accent-color);
    color: white;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.2;
  }

  &__items {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    max-width: 100%;

    @media (max-width: 768px) {
      padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    }
  }

  &__item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
    border-bottom: 1px solid var(--border-subtle, var(--border-color));

    @media (max-width: 768px) {
      padding: 0.625rem 0.75rem;
      gap: 0.5rem;
    }

    &:hover {
      background: var(--bg-secondary);
    }

    &--active {
      background: var(--bg-secondary);
      border-left: 3px solid var(--accent-color);
      padding-left: calc(1rem - 3px);
    }
  }

  &__tasks-disabled {
    padding: 1.5rem 1rem;
    text-align: center;
  }

  &__tasks-disabled-text {
    margin: 0 0 0.75rem;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  &__tasks-disabled-link {
    color: var(--accent-color);
    font-size: 0.95rem;
    text-decoration: none;
  }

  &__tasks-disabled-link:hover {
    text-decoration: underline;
  }

  &__avatar {
    width: 36px;
    height: 36px;
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

    &--icon {
      background: var(--bg-secondary);
      color: var(--accent-color);
      border: 2px solid var(--accent-color);
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0.25rem;
  }

  &__header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 0.5rem;
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
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__pin-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
    opacity: 0.7;
  }

  &__time {
    flex-shrink: 0;
    white-space: nowrap;
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
    background: var(--surface, var(--bg-secondary));
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
      z-index: 20;
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
    border-radius: var(--radius-sm, 8px);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
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
      background: var(--bg-secondary);
    }

    &--active {
      color: var(--accent-color);
      background: var(--bg-secondary);
      box-shadow: inset 0 -2px 0 0 var(--accent-color);

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
    top: 0.125rem;
    right: 0.5rem;
    background: var(--accent-color);
    color: white;
    border-radius: 10px;
    padding: 0.125rem 0.35rem;
    font-size: 0.65rem;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
    line-height: 1.2;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);

    @media (max-width: 768px) {
      top: 0;
      right: 0.25rem;
      font-size: 0.6rem;
      padding: 0.1rem 0.28rem;
      min-width: 16px;
    }
  }

  &__avatar-img {
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__avatar-group-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    color: var(--accent-color);
    border-radius: 50%;
    border: 2px solid var(--accent-color);
    padding: 0.5rem;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__call-details {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  &__call-type-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;

    &--incoming {
      color: #52c41a;
    }

    &--outgoing {
      color: var(--accent-color);
    }

    &--missed {
      color: #ff4d4f;
    }

    &--rejected {
      color: #ff4d4f;
    }
  }

  &__call-info {
    flex: 1;
    min-width: 0;
  }

  &__call-participants {
    color: var(--text-secondary);
    white-space: nowrap;
  }

  &__call-duration {
    color: var(--text-secondary);
    white-space: nowrap;
  }

  &__call-status {
    white-space: nowrap;
    font-size: 0.8rem;

    &--answered {
      color: #52c41a;
    }

    &--missed {
      color: #ff4d4f;
    }

    &--rejected {
      color: #ff4d4f;
    }
  }

  &__task-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    color: var(--text-secondary);
    cursor: pointer;

    svg {
      width: 24px;
      height: 24px;
    }
  }

  &__task-description {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    min-width: 0;
  }

  &__task-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  &__task-priority {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;

    &--high {
      background: rgba(255, 77, 79, 0.1);
      color: #ff4d4f;
    }

    &--medium {
      background: rgba(250, 173, 20, 0.1);
      color: #faad14;
    }

    &--low {
      background: rgba(82, 196, 26, 0.1);
      color: #52c41a;
    }
  }

  &__task-due {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;

    &--overdue {
      color: #ff4d4f;
      font-weight: 500;
    }
  }

  &__name--completed {
    text-decoration: line-through;
    opacity: 0.6;
  }

  &__item--completed {
    opacity: 0.7;
  }

  &__call-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;

    @media (min-width: 769px) {
      display: none;
    }
  }

  &__call-modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  &__call-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 1001;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-primary);
    transition: all 0.2s;

    &:hover {
      background: var(--bg-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  &__profile-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;

    @media (min-width: 769px) {
      display: none;
    }
  }

  &__profile-modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  &__profile-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 1001;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-primary);
    transition: all 0.2s;

    &:hover {
      background: var(--bg-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  &__task-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;

    @media (min-width: 769px) {
      display: none;
    }
  }

  &__task-modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  &__task-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 1001;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-primary);
    transition: all 0.2s;

    &:hover {
      background: var(--bg-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }
}
</style>

<style lang="scss">
.chat-list__items {
  .chat-list__item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
    border-bottom: 1px solid var(--border-subtle, var(--border-color));

    &:hover,
    &--active {
      background: var(--bg-secondary);
    }

    &--active {
      border-left: 3px solid var(--accent-color);
      padding-left: calc(1rem - 3px);
    }
  }

  .chat-list__avatar {
    width: 36px;
    height: 36px;
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

  .chat-list__avatar-placeholder {
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

    &--icon {
      background: var(--bg-secondary);
      color: var(--accent-color);
      border: 2px solid var(--accent-color);
    }
  }

  .chat-list__avatar-img,
  .chat-list__avatar-group-icon {
    width: 100%;
    height: 100%;
  }

  .chat-list__avatar-group-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    color: var(--accent-color);
    border-radius: 50%;
    border: 2px solid var(--accent-color);
    padding: 0.5rem;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .chat-list__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0.25rem;
  }

  .chat-list__header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 0.5rem;
  }

  .chat-list__name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;

    &--completed {
      text-decoration: line-through;
      opacity: 0.7;
    }
  }

  .chat-list__time {
    flex-shrink: 0;
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .chat-list__call-details {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .chat-list__call-type-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;

    &--incoming { color: #52c41a; }
    &--outgoing { color: var(--accent-color); }
    &--missed,
    &--rejected { color: #ff4d4f; }
  }

  .chat-list__call-info {
    flex: 1;
    min-width: 0;
  }

  .chat-list__call-status {
    white-space: nowrap;
    font-size: 0.8rem;

    &--answered { color: #52c41a; }
    &--missed,
    &--rejected { color: #ff4d4f; }
  }

  .chat-list__task-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .chat-list__task-description {
    font-size: 0.85rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-list__task-meta {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .chat-list__task-priority {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;

    &--high { background: rgba(255, 77, 79, 0.1); color: #ff4d4f; }
    &--medium { background: rgba(250, 173, 20, 0.1); color: #faad14; }
    &--low { background: rgba(82, 196, 26, 0.1); color: #52c41a; }
  }

  .chat-list__task-due {
    font-size: 0.8rem;
    color: var(--text-secondary);

    &--overdue {
      color: #ff4d4f;
      font-weight: 500;
    }
  }

  .chat-list__tasks-disabled {
    padding: 1.5rem 1rem;
    text-align: center;
  }

  .chat-list__tasks-disabled-text {
    margin: 0 0 0.75rem;
    color: var(--text-secondary);
  }

  .chat-list__tasks-disabled-link {
    color: var(--accent-color);
    text-decoration: none;
  }
}
</style>

