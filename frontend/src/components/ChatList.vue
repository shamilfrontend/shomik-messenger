<script setup lang="ts">
import { ref, computed, watch } from 'vue';
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

interface CallHistory {
  id: string;
  type: 'incoming' | 'outgoing';
  callType: 'audio' | 'video';
  status: 'answered' | 'missed' | 'rejected';
  participant: User | { id: string; username: string; avatar?: string };
  participantsCount?: number; // количество участников (для групповых звонков)
  participants?: Array<{ id: string; username: string; avatar?: string }>; // список участников группового звонка
  chatId?: string;
  duration?: number; // в секундах
  createdAt: Date;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emit = defineEmits<{(e: 'new-chat'): void;
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
  const actions: ContextMenuAction[] = [
    {
      id: 'pin',
      label: isPinned ? 'Открепить чат' : 'Закрепить чат',
      icon: isPinned ? 'unpin' : 'pin',
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
      const name = getChatName(chat).toLowerCase();
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

const getChatName = (chat: Chat): string => {
  if (chat.type === 'group') {
    return chat.groupName || 'Группа';
  }
  // Для приватных чатов находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find((p) => {
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
  const otherParticipant = chat.participants.find((p) => {
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
  const otherParticipant = chat.participants.find((p) => {
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
  } if (days === 1) {
    return 'Вчера';
  } if (days < 7) {
    return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const getUnreadCount = (chatId: string): number => chatStore.getUnreadCount(chatId);

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
  router.push(`/chat/${chat._id}`);
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
  router.push('/profile/me');
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

interface ProfileSection {
  id: string;
  label: string;
  path: string;
  icon: string;
}

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
  router.push(section.path);
};

// Моковые данные для истории звонков
const callsHistory = ref<CallHistory[]>([
  {
    id: '1',
    type: 'incoming',
    callType: 'video',
    status: 'answered',
    participant: { id: '2', username: 'Анна Петрова', avatar: undefined },
    chatId: 'chat1',
    duration: 1250,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 часа назад
  },
  {
    id: '2',
    type: 'outgoing',
    callType: 'audio',
    status: 'answered',
    participant: { id: '3', username: 'Иван Сидоров', avatar: undefined },
    chatId: 'chat2',
    duration: 340,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 часов назад
  },
  {
    id: '3',
    type: 'incoming',
    callType: 'audio',
    status: 'missed',
    participant: { id: '4', username: 'Мария Иванова', avatar: undefined },
    chatId: 'chat3',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // вчера
  },
  {
    id: '4',
    type: 'outgoing',
    callType: 'video',
    status: 'rejected',
    participant: { id: '5', username: 'Петр Смирнов', avatar: undefined },
    chatId: 'chat4',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 дня назад
  },
  {
    id: '5',
    type: 'incoming',
    callType: 'audio',
    status: 'answered',
    participant: { id: '6', username: 'Елена Козлова', avatar: undefined },
    chatId: 'chat5',
    duration: 890,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 дня назад
  },
  {
    id: '6',
    type: 'outgoing',
    callType: 'audio',
    status: 'missed',
    participant: { id: '7', username: 'Дмитрий Волков', avatar: undefined },
    chatId: 'chat6',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 дня назад
  },
  {
    id: '7',
    type: 'incoming',
    callType: 'video',
    status: 'answered',
    participant: { id: '8', username: 'Ольга Новикова', avatar: undefined },
    participantsCount: 5,
    participants: [
      { id: '8', username: 'Ольга Новикова', avatar: undefined },
      { id: '2', username: 'Анна Петрова', avatar: undefined },
      { id: '3', username: 'Иван Сидоров', avatar: undefined },
      { id: '4', username: 'Мария Иванова', avatar: undefined },
      { id: '5', username: 'Петр Смирнов', avatar: undefined },
    ],
    chatId: 'chat7',
    duration: 2150,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 дней назад
  },
  {
    id: '8',
    type: 'outgoing',
    callType: 'audio',
    status: 'answered',
    participant: { id: '9', username: 'Сергей Морозов', avatar: undefined },
    participantsCount: 3,
    participants: [
      { id: '9', username: 'Сергей Морозов', avatar: undefined },
      { id: '6', username: 'Елена Козлова', avatar: undefined },
      { id: '7', username: 'Дмитрий Волков', avatar: undefined },
    ],
    chatId: 'chat8',
    duration: 120,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 дней назад
  },
  {
    id: '9',
    type: 'incoming',
    callType: 'audio',
    status: 'missed',
    participant: { id: '10', username: 'Татьяна Лебедева', avatar: undefined },
    participantsCount: 8,
    participants: [
      { id: '10', username: 'Татьяна Лебедева', avatar: undefined },
      { id: '2', username: 'Анна Петрова', avatar: undefined },
      { id: '3', username: 'Иван Сидоров', avatar: undefined },
      { id: '4', username: 'Мария Иванова', avatar: undefined },
      { id: '5', username: 'Петр Смирнов', avatar: undefined },
      { id: '6', username: 'Елена Козлова', avatar: undefined },
      { id: '7', username: 'Дмитрий Волков', avatar: undefined },
      { id: '8', username: 'Ольга Новикова', avatar: undefined },
    ],
    chatId: 'chat9',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // неделю назад
  },
  {
    id: '10',
    type: 'outgoing',
    callType: 'video',
    status: 'answered',
    participant: { id: '11', username: 'Алексей Соколов', avatar: undefined },
    participantsCount: 4,
    participants: [
      { id: '11', username: 'Алексей Соколов', avatar: undefined },
      { id: '2', username: 'Анна Петрова', avatar: undefined },
      { id: '3', username: 'Иван Сидоров', avatar: undefined },
      { id: '4', username: 'Мария Иванова', avatar: undefined },
    ],
    chatId: 'chat10',
    duration: 450,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 дней назад
  },
  // Дополнительные звонки для тестирования
  ...Array.from({ length: 40 }, (_, i) => {
    const id = i + 11;
    const daysAgo = Math.floor(Math.random() * 30) + 9;
    const types: ('incoming' | 'outgoing')[] = ['incoming', 'outgoing'];
    const callTypes: ('audio' | 'video')[] = ['audio', 'video'];
    const statuses: ('answered' | 'missed' | 'rejected')[] = ['answered', 'missed', 'rejected'];
    const names = [
      'Андрей Кузнецов', 'Наталья Федорова', 'Владимир Орлов', 'Екатерина Семенова',
      'Михаил Лебедев', 'Юлия Новикова', 'Александр Морозов', 'Ольга Петрова',
      'Денис Волков', 'Марина Соколова', 'Роман Козлов', 'Анна Лебедева',
      'Павел Новиков', 'Татьяна Морозова', 'Игорь Соколов', 'Елена Кузнецова',
      'Сергей Орлов', 'Виктория Семенова', 'Алексей Федоров', 'Надежда Волкова',
      'Дмитрий Козлов', 'Ирина Петрова', 'Максим Лебедев', 'Светлана Новикова',
      'Артем Морозов', 'Оксана Соколова', 'Николай Кузнецов', 'Людмила Орлова',
      'Вадим Семенов', 'Галина Федорова', 'Станислав Волков', 'Раиса Козлова',
      'Вячеслав Петров', 'Зоя Лебедева', 'Геннадий Новиков', 'Валентина Морозова',
      'Борис Соколов', 'Тамара Кузнецова', 'Валерий Орлов', 'Нина Семенова',
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const callType = callTypes[Math.floor(Math.random() * callTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const name = names[i % names.length];
    const hasGroup = Math.random() > 0.7;
    const participantsCount = hasGroup ? Math.floor(Math.random() * 10) + 2 : undefined;
    const duration = status === 'answered' ? Math.floor(Math.random() * 3600) + 60 : undefined;
    
    // Генерируем список участников для групповых звонков
    const participants = hasGroup && participantsCount ? Array.from({ length: participantsCount }, (_, idx) => {
      const participantNames = [
        'Анна Петрова', 'Иван Сидоров', 'Мария Иванова', 'Петр Смирнов',
        'Елена Козлова', 'Дмитрий Волков', 'Ольга Новикова', 'Сергей Морозов',
        'Татьяна Лебедева', 'Алексей Соколов', 'Андрей Кузнецов', 'Наталья Федорова',
        'Владимир Орлов', 'Екатерина Семенова', 'Михаил Лебедев', 'Юлия Новикова',
        'Александр Морозов', 'Денис Волков', 'Марина Соколова', 'Роман Козлов',
      ];
      return {
        id: String(id + 100 + idx),
        username: idx === 0 ? name : participantNames[(idx - 1) % participantNames.length],
        avatar: undefined,
      };
    }) : undefined;
    
    return {
      id: String(id),
      type,
      callType,
      status,
      participant: { id: String(id + 100), username: name, avatar: undefined },
      participantsCount,
      participants,
      chatId: `chat${id}`,
      duration,
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    };
  }),
]);

const filteredCalls = computed(() => {
  let result = callsHistory.value;

  // Фильтруем по поисковому запросу
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((call) => {
      const name = getCallParticipantName(call).toLowerCase();
      return name.includes(query);
    });
  }

  return result;
});

const getCallParticipantName = (call: CallHistory): string => {
  const participantName = typeof call.participant === 'object' && 'username' in call.participant
    ? call.participant.username
    : 'Пользователь';
  
  // Если это групповой звонок, показываем имя первого участника и количество
  if (call.participantsCount && call.participantsCount > 1) {
    return `${participantName} и еще ${call.participantsCount - 1}`;
  }
  
  return participantName;
};

const getCallParticipantAvatar = (call: CallHistory): string | undefined => {
  return typeof call.participant === 'object' && 'avatar' in call.participant
    ? call.participant.avatar
    : undefined;
};

const formatCallDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const selectCall = (call: CallHistory): void => {
  router.push(`/calls/${call.id}`);
};

const getCallById = (callId: string): CallHistory | undefined => {
  return callsHistory.value.find(call => call.id === callId);
};

const getCallsHistory = (): CallHistory[] => {
  return callsHistory.value;
};

// Моковые данные для задач
const tasks = ref<Task[]>([
  {
    id: '1',
    title: 'Завершить проект мессенджера',
    description: 'Добавить финальные функции и провести тестирование',
    completed: false,
    priority: 'high',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // через 3 дня
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    title: 'Обновить документацию',
    description: 'Обновить README и добавить примеры использования',
    completed: false,
    priority: 'medium',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // через 5 дней
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    title: 'Исправить баги в чате',
    description: 'Исправить проблемы с отправкой сообщений и уведомлениями',
    completed: true,
    priority: 'high',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    title: 'Добавить темную тему',
    description: 'Реализовать переключение между светлой и темной темой',
    completed: false,
    priority: 'low',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '5',
    title: 'Оптимизировать производительность',
    description: 'Улучшить скорость загрузки и отклика интерфейса',
    completed: false,
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // через неделю
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  // Дополнительные задачи для тестирования
  ...Array.from({ length: 45 }, (_, i) => {
    const id = i + 6;
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const completed = Math.random() > 0.6;
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const hasDueDate = Math.random() > 0.3;
    const dueDateDays = hasDueDate ? (Math.random() > 0.5 ? Math.floor(Math.random() * 30) + 1 : -(Math.floor(Math.random() * 10) + 1)) : undefined;
    
    const taskTitles = [
      'Реализовать систему уведомлений', 'Добавить поддержку файлов', 'Создать мобильное приложение',
      'Настроить CI/CD пайплайн', 'Провести код-ревью', 'Написать unit-тесты',
      'Оптимизировать базу данных', 'Добавить логирование', 'Реализовать кэширование',
      'Создать API документацию', 'Добавить валидацию форм', 'Исправить ошибки линтера',
      'Реализовать пагинацию', 'Добавить фильтрацию данных', 'Создать админ-панель',
      'Настроить мониторинг', 'Добавить аналитику', 'Реализовать экспорт данных',
      'Создать дашборд', 'Добавить поиск', 'Реализовать сортировку',
      'Настроить авторизацию', 'Добавить двухфакторную аутентификацию', 'Создать систему ролей',
      'Реализовать восстановление пароля', 'Добавить профиль пользователя', 'Создать настройки',
      'Реализовать уведомления в реальном времени', 'Добавить поддержку тем', 'Создать систему плагинов',
      'Оптимизировать изображения', 'Добавить lazy loading', 'Реализовать виртуализацию списков',
      'Создать систему шаблонов', 'Добавить мультиязычность', 'Реализовать локализацию',
      'Настроить SEO', 'Добавить мета-теги', 'Создать sitemap',
      'Реализовать копирование данных', 'Добавить импорт из файлов', 'Создать экспорт в PDF',
      'Настроить резервное копирование', 'Добавить восстановление данных', 'Реализовать версионирование',
    ];
    
    const taskDescriptions = [
      'Необходимо добавить push-уведомления для мобильных устройств',
      'Поддержка загрузки и просмотра различных форматов файлов',
      'Разработка нативных приложений для iOS и Android',
      'Автоматизация процесса деплоя и тестирования',
      'Проверка кода на соответствие стандартам',
      'Покрытие критических функций тестами',
      'Оптимизация запросов и индексов',
      'Централизованное логирование всех событий',
      'Кэширование часто используемых данных',
      'Подробное описание всех эндпоинтов API',
      'Проверка корректности введенных данных',
      'Исправление всех предупреждений линтера',
      'Разбиение больших списков на страницы',
      'Возможность фильтрации по различным критериям',
      'Панель управления для администраторов',
      'Отслеживание производительности системы',
      'Сбор статистики использования приложения',
      'Экспорт данных в различные форматы',
      'Визуализация ключевых метрик',
      'Быстрый поиск по всем данным',
      'Сортировка по различным полям',
      'Безопасная система входа',
      'Дополнительная защита аккаунта',
      'Управление правами доступа',
      'Восстановление доступа к аккаунту',
      'Расширенные настройки профиля',
      'Персонализация интерфейса',
      'WebSocket для мгновенных обновлений',
      'Переключение между темами оформления',
      'Расширяемость функционала',
      'Оптимизация размера изображений',
      'Загрузка контента по требованию',
      'Эффективная работа с большими списками',
      'Готовые шаблоны для быстрого старта',
      'Поддержка нескольких языков',
      'Адаптация под разные регионы',
      'Улучшение видимости в поисковиках',
      'Метаданные для социальных сетей',
      'Карта сайта для индексации',
      'Дублирование важных данных',
      'Импорт данных из внешних источников',
      'Генерация PDF документов',
      'Регулярное резервное копирование',
      'Восстановление после сбоев',
      'История изменений данных',
    ];
    
    const title = taskTitles[i % taskTitles.length];
    const description = taskDescriptions[i % taskDescriptions.length];
    const dueDate = dueDateDays !== undefined ? new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000) : undefined;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * (daysAgo - 1)) * 24 * 60 * 60 * 1000);
    
    return {
      id: String(id),
      title,
      description,
      completed,
      priority,
      dueDate,
      createdAt,
      updatedAt,
    };
  }),
]);

const filteredTasks = computed(() => {
  let result = tasks.value;

  // Фильтруем по поисковому запросу
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((task) => {
      const title = task.title.toLowerCase();
      const description = task.description?.toLowerCase() || '';
      return title.includes(query) || description.includes(query);
    });
  }

  // Сортируем: незавершенные сначала, затем по приоритету
  result.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return result;
});

const selectTask = (task: Task): void => {
  router.push(`/tasks/${task.id}`);
};

const getTaskById = (taskId: string): Task | undefined => {
  return tasks.value.find(task => task.id === taskId);
};

const getTasks = (): Task[] => {
  return tasks.value;
};

const formatTaskDueDate = (date: Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Сегодня';
  } if (days === 1) {
    return 'Завтра';
  } if (days === -1) {
    return 'Вчера';
  } if (days > 0 && days < 7) {
    return `Через ${days} дн.`;
  } if (days < 0) {
    return `${Math.abs(days)} дн. назад`;
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

defineExpose({
  getCallById,
  getCallsHistory,
  callsHistory,
  getTaskById,
  getTasks,
  tasks,
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
          @click="router.push('/calls/new')"
          class="chat-list__new-button"
          title="Создать звонок"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </button>
        <button
          v-if="isTasksPage && !isProfilePage && showTasksSection"
          @click="router.push('/tasks/new')"
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
      <!-- Список звонков -->
      <template v-if="isCallsPage">
        <div
          v-for="call in filteredCalls"
          :key="call.id"
          :class="['chat-list__item', 'chat-list__item--call', { 'chat-list__item--active': currentCallId === call.id }]"
          @click="selectCall(call)"
        >
          <div class="chat-list__avatar">
            <div v-if="call.participantsCount && call.participantsCount > 1" class="chat-list__avatar-group-icon">
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div v-else-if="getCallParticipantAvatar(call)" class="chat-list__avatar-img">
              <img
                :src="getCallParticipantAvatar(call)"
                :alt="getCallParticipantName(call)"
              />
            </div>
            <div v-else class="chat-list__avatar-placeholder">
              {{ getCallParticipantName(call).charAt(0).toUpperCase() }}
            </div>
          </div>

          <div class="chat-list__content">
            <div class="chat-list__header-row">
              <span class="chat-list__name">
                {{ getCallParticipantName(call) }}
              </span>
              <span class="chat-list__time">{{ formatTime(call.createdAt) }}</span>
            </div>
            <div class="chat-list__call-details">
              <span
                :class="[
                  'chat-list__call-type-icon',
                  `chat-list__call-type-icon--${call.type}`,
                  `chat-list__call-type-icon--${call.status}`,
                ]"
              >
                <svg
                  v-if="call.type === 'incoming'"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <svg
                  v-else
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <span class="chat-list__call-info">
                {{ call.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок' }}
                <span v-if="call.participantsCount && call.participantsCount > 1" class="chat-list__call-participants">
                  · {{ call.participantsCount }} участников
                </span>
                <span v-if="call.duration" class="chat-list__call-duration">
                  · {{ formatCallDuration(call.duration) }}
                </span>
              </span>
              <span
                :class="['chat-list__call-status', `chat-list__call-status--${call.status}`]"
              >
                {{ call.status === 'answered' ? 'Принят' : call.status === 'missed' ? 'Пропущен' : 'Отклонен' }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- Раздел Задачи отключён -->
      <template v-else-if="isTasksPage && !showTasksSection">
        <div class="chat-list__tasks-disabled">
          <p class="chat-list__tasks-disabled-text">Раздел «Задачи» отключён.</p>
          <router-link to="/profile/advanced-features" class="chat-list__tasks-disabled-link">Включить в настройках</router-link>
        </div>
      </template>
      <!-- Список задач (только если раздел включён) -->
      <template v-else-if="isTasksPage && showTasksSection">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          :class="['chat-list__item', 'chat-list__item--task', { 'chat-list__item--active': route.params.taskId === task.id, 'chat-list__item--completed': task.completed }]"
          @click="selectTask(task)"
        >
          <div class="chat-list__task-checkbox">
            <svg
              v-if="task.completed"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <svg
              v-else
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>

          <div class="chat-list__content">
            <div class="chat-list__header-row">
              <span :class="['chat-list__name', { 'chat-list__name--completed': task.completed }]">
                {{ task.title }}
              </span>
              <span
                v-if="task.dueDate"
                :class="['chat-list__task-due', { 'chat-list__task-due--overdue': !task.completed && new Date(task.dueDate) < new Date() }]"
              >
                {{ formatTaskDueDate(task.dueDate) }}
              </span>
            </div>
            <div v-if="task.description" class="chat-list__task-description">
              {{ task.description }}
            </div>
            <div class="chat-list__task-meta">
              <span :class="['chat-list__task-priority', `chat-list__task-priority--${task.priority}`]">
                {{ task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий' }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- Список подразделов профиля -->
      <template v-else-if="isProfilePage">
        <div
          v-for="section in profileSections"
          :key="section.id"
          :class="['chat-list__item', 'chat-list__item--profile', { 'chat-list__item--active': currentProfileSection === section.id }]"
          @click="selectProfileSection(section)"
        >
          <div class="chat-list__avatar">
            <div class="chat-list__avatar-placeholder chat-list__avatar-placeholder--icon">
              <!-- Иконка пользователя -->
              <svg v-if="section.icon === 'user'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <!-- Иконка палитры -->
              <svg v-else-if="section.icon === 'palette'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="13.5" cy="6.5" r=".5"></circle>
                <circle cx="17.5" cy="10.5" r=".5"></circle>
                <circle cx="8.5" cy="7.5" r=".5"></circle>
                <circle cx="6.5" cy="12.5" r=".5"></circle>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.074 2.26-.21"></path>
                <path d="M19.07 4.93a10 10 0 0 1 .11 14.11"></path>
              </svg>
              <!-- Иконка глобуса -->
              <svg v-else-if="section.icon === 'globe'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <!-- Иконка микрофона/аудио -->
              <svg v-else-if="section.icon === 'mic'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              <!-- Иконка монитора -->
              <svg v-else-if="section.icon === 'monitor'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <!-- Иконка ползунков (расширенные настройки) -->
              <svg v-else-if="section.icon === 'sliders'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
            </div>
          </div>

          <div class="chat-list__content">
            <div class="chat-list__header-row">
              <span class="chat-list__name">{{ section.label }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Список чатов -->
      <template v-else>
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
              <span class="chat-list__name">
                {{ getChatName(chat) }}
                <svg
                  v-if="chatStore.isChatPinned(chat._id)"
                  class="chat-list__pin-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <path d="M16 12V4h1V2H7v2h1v8l-4 4v2h16v-2l-4-4z"/>
                </svg>
              </span>
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
  </div>
</template>

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

  &__tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);

    @media (max-width: 768px) {
      padding: 0.5rem;
    }
  }

  &__tab {
    flex: 1;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    @media (max-width: 768px) {
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
    }

    &:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    &--active {
      background: var(--accent-color);
      color: white;

      &:hover {
        background: var(--accent-color);
        opacity: 0.9;
      }

      .chat-list__tab-badge {
        background: rgba(255, 255, 255, 0.3);
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
}
</style>
