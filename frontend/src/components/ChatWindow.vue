<script setup lang="ts">
import {
  computed, watch, ref, nextTick, onMounted, onUnmounted,
} from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { useChatStore } from '../stores/chat.store';
import { useCallStore } from '../stores/call.store';
import MessageInput from './MessageInput.vue';
import UserInfoModal from './UserInfoModal.vue';
import GroupSettingsModal from './GroupSettingsModal.vue';
import MessageViewModal from './MessageViewModal.vue';
import ContextMenu from './ContextMenu.vue';
import Tooltip from './Tooltip.vue';
import type { Message, User } from '../types';
import { getImageUrl } from '../utils/image';
import { isUserOnline, getComputedStatus } from '../utils/status';
import { useNotifications } from '../composables/useNotifications';
import { useConfirm } from '../composables/useConfirm';
import api from '../services/api';

const chatStore = useChatStore();
const callStore = useCallStore();
const { success: notifySuccess, error: notifyError } = useNotifications();

const remoteAudioRef = ref<HTMLAudioElement | null>(null);
const localVideoRef = ref<HTMLVideoElement | null>(null);
const remoteVideoRef = ref<HTMLVideoElement | null>(null);
/** Элементы <video> для удалённых потоков по userId (групповой видеозвонок) */
const remoteVideoEls: Record<string, HTMLVideoElement | null> = {};
const messagesContainer = ref<HTMLElement | null>(null);
const showUserInfo = ref(false);
const selectedUser = ref<User | null>(null);
const showGroupSettings = ref(false);
const replyToMessage = ref<Message | null>(null);
const editMessage = ref<Message | null>(null);
const isMobile = ref(window.innerWidth <= 768);
const showReactionMenu = ref<string | null>(null);
/** Позиция меню реакций на мобильных: выше или ниже сообщения (с отступом 50px от краёв viewport) */
const reactionMenuPosition = ref<'above' | 'below'>('below');
const showMessageView = ref(false);
const selectedMessage = ref<Message | null>(null);
const contextMenuVisible = ref(false);
const selectionMode = ref(false);
const selectedMessageIds = ref<Set<string>>(new Set());
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuMessage = ref<Message | null>(null);
const availableReactions = ['👍', '😂', '🔥', '❤️', '👎', '👀', '💯'];
const videoCallMicDropdownOpen = ref(false);
const videoCallCameraDropdownOpen = ref(false);
const headerRef = ref<HTMLElement | null>(null);
const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null);

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

// Обработчик изменения высоты viewport для мобильных устройств
let rafId: number | null = null;
let lastViewportTop = 0;

const handleViewportResize = (): void => {
  if (!isMobile.value || !headerRef.value) return;

  // Отменяем предыдущий запрос анимации, если он есть
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  // Используем requestAnimationFrame для плавного обновления
  rafId = requestAnimationFrame(() => {
    if (!headerRef.value) return;

    // Получаем реальную высоту и позицию viewport
    const { visualViewport } = window;
    let viewportTop = 0;

    if (visualViewport) {
      // Используем visualViewport API для точного определения позиции
      viewportTop = visualViewport.offsetTop;
    } else {
      // Fallback: вычисляем позицию на основе изменения высоты окна
      const currentHeight = window.innerHeight;
      const screenHeight = window.screen.height;
      // Если высота уменьшилась, значит открылась клавиатура
      if (currentHeight < screenHeight * 0.75) {
        viewportTop = 0; // Header должен быть в самом верху
      }
    }

    // Обновляем только если позиция изменилась
    if (viewportTop !== lastViewportTop) {
      lastViewportTop = viewportTop;

      // Принудительно фиксируем header в верхней части видимой области
      headerRef.value.style.position = 'fixed';
      headerRef.value.style.top = `${viewportTop}px`;
      headerRef.value.style.left = '0';
      headerRef.value.style.right = '0';
      headerRef.value.style.zIndex = '1000';
      headerRef.value.style.width = '100%';
      headerRef.value.style.transform = 'translateZ(0)';
      headerRef.value.style.webkitTransform = 'translateZ(0)';
    }

    rafId = null;
  });
};

// Обработчик фокуса на input поле (когда открывается клавиатура)
const handleInputFocus = (): void => {
  if (isMobile.value && headerRef.value) {
    // Несколько проверок с задержками для надежности
    setTimeout(() => handleViewportResize(), 50);
    setTimeout(() => handleViewportResize(), 150);
    setTimeout(() => handleViewportResize(), 300);
  }
};

// Обработчик потери фокуса (когда закрывается клавиатура)
const handleInputBlur = (): void => {
  if (isMobile.value && headerRef.value) {
    setTimeout(() => handleViewportResize(), 50);
    setTimeout(() => handleViewportResize(), 150);
    setTimeout(() => handleViewportResize(), 300);
  }
};

// Периодическая проверка позиции header'а (fallback)
let checkInterval: number | null = null;
const startHeaderPositionCheck = (): void => {
  if (checkInterval !== null) return;

  checkInterval = window.setInterval(() => {
    if (isMobile.value && headerRef.value) {
      handleViewportResize();
    }
  }, 500); // Проверяем каждые 500ms
};

const stopHeaderPositionCheck = (): void => {
  if (checkInterval !== null) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};

// Закрываем меню реакций и выпадающие списки устройств при клике вне их
const handleClickOutside = (event: MouseEvent): void => {
  const target = event.target as HTMLElement;
  // На мобильных устройствах закрываем меню реакций при клике вне его
  if (isMobile.value) {
    if (!target.closest('.chat-window__reaction-menu') && !target.closest('.chat-window__message-wrapper')) {
      // Очищаем inline styles при закрытии меню
      const menuEl = messagesContainer.value?.querySelector('.chat-window__reaction-menu--visible') as HTMLElement | null;
      if (menuEl) {
        menuEl.style.top = '';
        menuEl.style.bottom = '';
        menuEl.style.left = '';
      }
      showReactionMenu.value = null;
    }
  }
  if (!target.closest('.chat-window__video-call-device-group')) {
    videoCallMicDropdownOpen.value = false;
    videoCallCameraDropdownOpen.value = false;
  }
};

// Обработчик автофокуса при начале ввода текста
const handleGlobalKeyDown = (event: KeyboardEvent): void => {
  // Проверяем, что чат открыт
  if (!currentChat.value) return;

  // Проверяем, что модальные окна не открыты
  if (showUserInfo.value || showGroupSettings.value) return;

  // Проверяем, что фокус не на поле ввода сообщения
  if (messageInputRef.value?.hasFocus()) return;

  // Проверяем, что фокус не на других input/textarea элементах
  const { activeElement } = document;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    return;
  }

  // Проверяем, что фокус не на contentEditable элементах
  if (activeElement && activeElement.contentEditable === 'true') {
    return;
  }

  // Проверяем, что фокус не на элементах с классом модальных окон или выпадающих меню
  if (activeElement && (
    activeElement.closest('.group-settings-modal')
    || activeElement.closest('.user-info-modal')
    || activeElement.closest('.chat-window__reaction-menu')
    || activeElement.closest('.chat-window__video-call-device-dropdown')
  )) {
    return;
  }

  // Проверяем, что нажата печатная клавиша (не служебная)
  // Игнорируем служебные клавиши: Escape, Tab, Arrow keys, F-keys, Ctrl, Alt, Meta, Shift
  const isPrintableKey = event.key.length === 1
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && event.key !== 'Escape'
    && event.key !== 'Tab'
    && !event.key.startsWith('Arrow')
    && !event.key.startsWith('F')
    && event.key !== 'Enter'
    && event.key !== 'Backspace'
    && event.key !== 'Delete';

  if (isPrintableKey && messageInputRef.value?.inputField) {
    // Предотвращаем стандартное поведение для этого символа
    event.preventDefault();

    // Ставим фокус на поле ввода
    messageInputRef.value.focusInput();

    // Вставляем символ в поле ввода
    const input = messageInputRef.value.inputField;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = input.value;
    const newValue = currentValue.slice(0, start) + event.key + currentValue.slice(end);

    // Обновляем значение напрямую в input и триггерим событие input для обновления v-model
    input.value = newValue;
    input.setSelectionRange(start + 1, start + 1);

    // Триггерим событие input для обновления v-model
    const inputEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(inputEvent);
  }
};

/** Название чата по id (для панели созвона вне текущего чата) */
const getChatNameById = (chatId: string): string => {
  const chat = chatStore.chats.find((c) => c._id === chatId);
  if (!chat) return 'Чат';
  if (chat.type === 'group') return chat.groupName || 'Группа';
  const other = chat.participants.find((p) => (typeof p === 'string' ? p : p.id) !== chatStore.user?.id);
  return typeof other === 'string' ? 'Чат' : (other?.username || 'Чат');
};

/** Username участника звонка по chatId и userId (для подписи на превью) */
const getParticipantUsername = (chatId: string, userId: string): string => {
  const chat = chatStore.chats.find((c) => c._id === chatId);
  if (!chat) return userId.slice(0, 8);
  const p = chat.participants.find((participant) => (typeof participant === 'string' ? participant : participant.id) === userId);
  return p && typeof p !== 'string' ? p.username : userId.slice(0, 8);
};

const handleStartCall = async (): Promise<void> => {
  const other = getOtherParticipant();
  if (!currentChat.value || !other) return;
  try {
    await callStore.startCall(currentChat.value._id, other.id, false);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось начать звонок');
  }
};

const handleStartVideoCall = async (): Promise<void> => {
  const other = getOtherParticipant();
  if (!currentChat.value || !other) return;
  try {
    await callStore.startCall(currentChat.value._id, other.id, true);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось начать видеозвонок');
  }
};

const handleAcceptCall = async (): Promise<void> => {
  if (!callStore.incomingCall) return;
  try {
    await callStore.acceptCall(callStore.incomingCall.chatId, callStore.incomingCall.fromUserId);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось принять звонок');
  }
};

const handleRejectCall = (): void => {
  if (!callStore.incomingCall) return;
  callStore.rejectCall(callStore.incomingCall.chatId, callStore.incomingCall.fromUserId);
};

const handleStartGroupCall = async (): Promise<void> => {
  if (!currentChat.value) return;
  try {
    await callStore.startGroupCall(currentChat.value._id, false);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось начать групповой звонок');
  }
};

const handleStartGroupVideoCall = async (): Promise<void> => {
  if (!currentChat.value) return;
  try {
    await callStore.startGroupCall(currentChat.value._id, true);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось начать групповой видеозвонок');
  }
};

const handleJoinGroupCall = async (): Promise<void> => {
  const chatId = callStore.groupCallAvailable?.chatId ?? currentChat.value?._id;
  if (!chatId) return;
  try {
    await callStore.joinGroupCall(chatId);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось присоединиться к созвону');
  }
};

const handleReactionPopoverUpdatePosition = (): void => {
  if (reactionPopover.value) updateReactionPopoverPosition();
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('resize', handleReactionPopoverUpdatePosition);
  window.addEventListener('scroll', handleReactionPopoverUpdatePosition, true);
  document.addEventListener('click', handleClickOutside);

  // Отслеживаем изменение высоты viewport на мобильных устройствах
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
  }
  // Fallback для устройств без visualViewport API
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('orientationchange', handleViewportResize);

  // Отслеживаем фокус на input полях для обнаружения открытия клавиатуры
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      handleInputFocus();
    }
  });

  document.addEventListener('focusout', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      handleInputBlur();
    }
  });

  // Обработчик автофокуса при начале ввода текста
  document.addEventListener('keydown', handleGlobalKeyDown);

  nextTick(() => {
    callStore.setRemoteAudioRef(remoteAudioRef.value);
    callStore.setLocalVideoRef(localVideoRef.value);
    // Инициализируем позицию header'а
    handleViewportResize();
    // Запускаем периодическую проверку позиции header'а на мобильных
    if (isMobile.value) {
      startHeaderPositionCheck();
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('resize', handleReactionPopoverUpdatePosition);
  window.removeEventListener('scroll', handleReactionPopoverUpdatePosition, true);
  if (reactionPopoverShowTimeout) clearTimeout(reactionPopoverShowTimeout);
  if (reactionPopoverHideTimeout) clearTimeout(reactionPopoverHideTimeout);
  document.removeEventListener('click', handleClickOutside);

  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportResize);
    window.visualViewport.removeEventListener('scroll', handleViewportResize);
  }
  window.removeEventListener('resize', handleViewportResize);
  window.removeEventListener('orientationchange', handleViewportResize);

  // Отменяем pending requestAnimationFrame
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  // Останавливаем периодическую проверку
  stopHeaderPositionCheck();

  // Удаляем обработчик автофокуса
  document.removeEventListener('keydown', handleGlobalKeyDown);

  callStore.setRemoteAudioRef(null);
  callStore.setLocalVideoRef(null);
});

const currentChat = computed(() => chatStore.currentChat);
const messages = computed(() => chatStore.messages);
const typingUsers = computed(() => {
  if (!currentChat.value) return new Set();
  return chatStore.typingUsers.get(currentChat.value._id) || new Set();
});

const isGroupChat = computed(() => currentChat.value?.type === 'group');

/** Число колонок сетки группового видеозвонка по количеству участников (≈ квадратная сетка) */
const groupVideoGridStyle = computed(() => {
  const n = Math.max(1, Object.keys(callStore.remoteStreams).length);
  const cols = Math.ceil(Math.sqrt(n));
  return { '--grid-cols': String(cols) };
});

watch(currentChat, (newChat, oldChat) => {
  const chatIdChanged = !oldChat || !newChat || oldChat._id !== newChat._id;
  if (chatIdChanged) {
    showGroupSettings.value = false;
    showUserInfo.value = false;
    selectedUser.value = null;
    replyToMessage.value = null;
    editMessage.value = null;
    showReactionMenu.value = null;
  }
});

watch(
  () => (callStore.remoteStreams && callStore.activeCall?.peerUserId
    ? callStore.remoteStreams[callStore.activeCall.peerUserId]
    : null),
  (stream) => {
    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = stream || null;
    }
  },
  { immediate: true },
);

/** Привязка элемента видео к удалённому потоку по userId (для группового видеозвонка) */
function setRemoteVideoEl(userId: string, el: unknown): void {
  if (!el || !(el instanceof HTMLVideoElement)) {
    delete remoteVideoEls[userId];
    return;
  }
  remoteVideoEls[userId] = el;
  el.srcObject = callStore.remoteStreams[userId] || null;
}

watch(
  () => callStore.remoteStreams,
  () => {
    Object.entries(remoteVideoEls).forEach(([uid, video]) => {
      if (video) video.srcObject = callStore.remoteStreams[uid] || null;
    });
  },
  { deep: true },
);

watch(
  () => callStore.activeCall?.isVideo === true,
  (isVideo) => {
    if (isVideo) {
      nextTick(() => {
        callStore.setLocalVideoRef(localVideoRef.value);
      });
    } else {
      callStore.setLocalVideoRef(null);
    }
  },
);

watch(
  () => Boolean(callStore.activeCall && callStore.isVideoCall),
  (isVideoCallActive) => {
    if (isVideoCallActive) callStore.loadDevices();
  },
);

const showScrollToBottom = ref(false);
const userWasAtBottom = ref(true);
const SCROLL_TO_BOTTOM_THRESHOLD = 100;
const SCROLL_LOAD_OLDER_THRESHOLD = 150;

const onMessagesScroll = async (): Promise<void> => {
  const el = messagesContainer.value;
  if (!el || !currentChat.value) return;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_TO_BOTTOM_THRESHOLD;
  userWasAtBottom.value = atBottom;
  showScrollToBottom.value = !atBottom;

  if (
    el.scrollTop <= SCROLL_LOAD_OLDER_THRESHOLD
    && chatStore.hasMoreOlderMessages
    && !chatStore.loadingOlderMessages
  ) {
    const oldScrollHeight = el.scrollHeight;
    const oldScrollTop = el.scrollTop;
    const loaded = await chatStore.loadOlderMessages(currentChat.value._id);
    if (loaded && messagesContainer.value) {
      nextTick(() => {
        const container = messagesContainer.value;
        if (container) {
          container.scrollTop = oldScrollTop + (container.scrollHeight - oldScrollHeight);
        }
      });
    }
  }
};

const scrollToBottom = (smooth = true): void => {
  const el = messagesContainer.value;
  if (!el) return;
  const target = el.scrollHeight;
  if (smooth) {
    el.scrollTo({ top: target, behavior: 'smooth' });
  } else {
    el.scrollTop = target;
  }
  userWasAtBottom.value = true;
  showScrollToBottom.value = false;
};

defineExpose({ scrollToBottom });

// Скролл вниз при первой загрузке чата: несколько попыток после отрисовки (учитываем sticky pinned bar)
const runInitialScrollToBottom = (): void => {
  const attempt = (): void => {
    scrollToBottom(false);
  };
  nextTick(() => {
    attempt();
    requestAnimationFrame(() => {
      attempt();
      setTimeout(attempt, 50);
      setTimeout(attempt, 150);
      setTimeout(attempt, 350);
    });
  });
};

// Явный запрос скролла из стора после loadMessages — гарантирует скролл при первом открытии чата
watch(
  () => chatStore.requestScrollToBottom,
  () => {
    if (currentChat.value && messages.value.length > 0) {
      runInitialScrollToBottom();
    }
  },
  { flush: 'post' },
);

// Скролл вниз при подгрузке старых сообщений и при отправке нового (пользователь был внизу)
watch(
  () => messages.value.length,
  (newLen, oldLen) => {
    if (oldLen !== undefined && newLen > oldLen && messages.value.length > 0) {
      if (userWasAtBottom.value) {
        nextTick(() => scrollToBottom(true));
      }
    }
  },
  { flush: 'post' },
);

const getChatName = (): string => {
  // Для нового чата используем информацию о пользователе
  if (isNewChat.value && newChatUser.value) {
    return newChatUser.value.username || 'Пользователь';
  }
  if (!currentChat.value) return '';
  if (isGroupChat.value) {
    return currentChat.value.groupName || 'Группа';
  }
  const otherParticipant = currentChat.value.participants.find((p) => (typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id));
  return typeof otherParticipant === 'string' ? 'Пользователь' : (otherParticipant?.username || 'Пользователь');
};

const getAvatar = (): string | undefined => {
  // Для нового чата используем информацию о пользователе
  if (isNewChat.value && newChatUser.value) {
    return getImageUrl(newChatUser.value.avatar);
  }
  if (!currentChat.value) return;
  if (isGroupChat.value) {
    return getImageUrl(currentChat.value.groupAvatar);
  }
  const otherParticipant = currentChat.value.participants.find((p) => (typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id));
  return typeof otherParticipant === 'string' ? undefined : getImageUrl(otherParticipant?.avatar);
};

const getOtherParticipant = (): User | null => {
  // Для нового чата возвращаем загруженного пользователя
  if (isNewChat.value && newChatUser.value) {
    return newChatUser.value;
  }
  if (!currentChat.value || isGroupChat.value) {
    return null;
  }
  const otherParticipant = currentChat.value.participants.find((p) => (typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id));
  if (!otherParticipant || typeof otherParticipant === 'string') {
    return null;
  }
  return otherParticipant;
};

const getStatus = (): string => {
  // Для нового чата используем информацию о пользователе
  if (isNewChat.value && newChatUser.value) {
    return isUserOnline(newChatUser.value) ? 'в сети' : 'не в сети';
  }
  if (!currentChat.value || isGroupChat.value) return '';
  const otherParticipant = currentChat.value.participants.find((p) => (typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id));
  if (typeof otherParticipant === 'string') return '';
  return isUserOnline(otherParticipant) ? 'в сети' : 'не в сети';
};

const isGroupAdmin = computed((): boolean => {
  if (!currentChat.value || currentChat.value.type !== 'group' || !currentChat.value.admin) {
    return false;
  }
  const adminId = typeof currentChat.value.admin === 'string'
    ? currentChat.value.admin
    : currentChat.value.admin.id;
  return adminId === chatStore.user?.id;
});

const isSenderIdUser = (senderId: User | string): senderId is User => typeof senderId === 'object' && senderId !== null && 'id' in senderId;

const getMessageSenderId = (message: Message): string => (isSenderIdUser(message.senderId) ? message.senderId.id : message.senderId);

const isMessageSenderUser = (message: Message): boolean => isSenderIdUser(message.senderId);

const getMessageSenderStatus = (message: Message): 'online' | 'offline' | 'away' => (isSenderIdUser(message.senderId) ? getComputedStatus(message.senderId) : 'offline');

const isOwnMessage = (message: Message): boolean => {
  const senderId = getMessageSenderId(message);
  return senderId === chatStore.user?.id;
};

// Проверка прав на удаление сообщения
const canDeleteMessage = (message: Message): boolean => {
  // Нельзя удалять системные сообщения
  if (message.type === 'system') {
    return false;
  }

  // Пользователь может удалять свои сообщения
  if (isOwnMessage(message)) {
    return true;
  }

  // Админ группы может удалять любые сообщения в группе
  if (isGroupChat.value && isGroupAdmin.value) {
    return true;
  }

  return false;
};

const canEditMessage = (message: Message): boolean => message.type === 'text' && isOwnMessage(message);

const handleEditMessage = (message: Message): void => {
  if (!canEditMessage(message)) return;
  replyToMessage.value = null;
  editMessage.value = message;
  nextTick(() => messageInputRef.value?.focusInput());
};

const clearEditMessage = (): void => {
  editMessage.value = null;
};

const handleStartEditLast = (): void => {
  if (!currentChat.value || !chatStore.user) return;
  const ownId = chatStore.user.id;
  const list = messages.value;
  for (let i = list.length - 1; i >= 0; i--) {
    const msg = list[i];
    if (msg.type !== 'text') continue;
    const senderId = getMessageSenderId(msg);
    if (senderId === ownId) {
      editMessage.value = msg;
      replyToMessage.value = null;
      nextTick(() => messageInputRef.value?.focusInput());
      return;
    }
  }
};

// Обработчик удаления сообщения
const handleDeleteMessage = async (message: Message): Promise<void> => {
  if (!currentChat.value || !canDeleteMessage(message)) {
    return;
  }

  const { confirm } = useConfirm();
  const confirmed = await confirm('Вы уверены, что хотите удалить это сообщение?');

  if (!confirmed) {
    return;
  }

  try {
    await chatStore.deleteMessage(currentChat.value._id, message._id);
  } catch (error: any) {
    notifyError(error.response?.data?.error || 'Не удалось удалить сообщение');
  }
};

// Константа для максимальной длины сообщения
const MAX_MESSAGE_LENGTH = 500;

// Проверка, нужно ли обрезать сообщение
const shouldTruncateMessage = (message: Message): boolean => {
  const { content } = message;
  if (typeof content !== 'string' || content.length <= MAX_MESSAGE_LENGTH) {
    return false;
  }
  // Обрезаем только текстовые сообщения (тип text или не задан)
  if (message.type === 'image' || message.type === 'file' || message.type === 'system') {
    return false;
  }
  return true;
};

// Получение обрезанного текста сообщения
const getTruncatedText = (content: string): string => {
  if (typeof content !== 'string') return String(content ?? '');
  if (content.length <= MAX_MESSAGE_LENGTH) return content;
  return `${content.slice(0, MAX_MESSAGE_LENGTH)}...`;
};

// Открытие модального окна для просмотра полного сообщения
const openMessageView = (message: Message): void => {
  selectedMessage.value = message;
  showMessageView.value = true;
};

// Закрытие модального окна
const closeMessageView = (): void => {
  showMessageView.value = false;
  selectedMessage.value = null;
};

const isUnreadMessage = (message: Message): boolean => chatStore.isMessageUnread(message);

const getMessageSender = (message: Message): string => {
  if (!isSenderIdUser(message.senderId)) {
    return 'Пользователь';
  }
  return message.senderId.username || 'Пользователь';
};

const getMessageAvatar = (message: Message): string | undefined => {
  if (!isSenderIdUser(message.senderId)) {
    return undefined;
  }
  return getImageUrl(message.senderId.avatar);
};

const openUserInfo = (message: Message): void => {
  // Не открываем модальное окно для своих сообщений
  if (isOwnMessage(message)) {
    return;
  }

  const senderId = getMessageSenderId(message);

  if (senderId === chatStore.user?.id) {
    console.error('openUserInfo: попытка открыть информацию о себе');
    return;
  }

  if (isSenderIdUser(message.senderId)) {
    if (message.senderId.id !== chatStore.user?.id) {
      selectedUser.value = message.senderId;
      showUserInfo.value = true;
    } else {
      console.error('openUserInfo: попытка открыть информацию о себе');
    }
  } else {
    const participant = currentChat.value?.participants.find((p) => {
      const participantId = typeof p === 'string' ? p : p.id;
      return participantId === senderId && participantId !== chatStore.user?.id;
    });
    if (participant && typeof participant !== 'string') {
      selectedUser.value = participant;
      showUserInfo.value = true;
    } else {
      console.error('openUserInfo: участник не найден для senderId:', senderId);
    }
  }
};

const closeUserInfo = (): void => {
  showUserInfo.value = false;
  selectedUser.value = null;
};

const handleHeaderAvatarClick = (): void => {
  if (!currentChat.value) return;
  if (currentChat.value.type === 'private') {
    const other = getOtherParticipant();
    if (other) {
      selectedUser.value = other;
      showUserInfo.value = true;
    }
  } else {
    showGroupSettings.value = true;
  }
};

const handleHeaderTitleClick = (): void => {
  if (isGroupChat.value) {
    showGroupSettings.value = true;
  }
};

const router = useRouter();
const route = useRoute();

// Поддержка нового чата с userId из query параметра или роута /chat/new
const newChatUserId = computed(() => {
  // Поддерживаем как /chat/new?userId=... так и /chat?userId=...
  return route.query.userId as string | undefined;
});
const isNewChat = computed(() => {
  // Новый чат если есть userId в query и нет текущего чата, или если роут /chat/new
  return (route.path === '/chat/new' || !!route.query.userId) && !currentChat.value;
});
const newChatUser = ref<User | null>(null);

// Загружаем информацию о пользователе для нового чата
watch([() => route.path, newChatUserId], async ([path, userId]) => {
  if ((path === '/chat/new' || userId) && !currentChat.value && userId) {
    try {
      const response = await api.get(`/users/${userId}`);
      newChatUser.value = response.data;
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      router.push('/');
    }
  } else {
    newChatUser.value = null;
  }
}, { immediate: true });

const handleSendMessage = async (userId: string): Promise<void> => {
  // Проверяем, что это не текущий пользователь
  if (!userId || userId === chatStore.user?.id) {
    console.error('Нельзя создать чат с самим собой. userId:', userId, 'currentUserId:', chatStore.user?.id);
    return;
  }

  // Переходим на страницу нового чата с userId
  // Чат будет создан при отправке первого сообщения
  router.push(`/chat/new?userId=${userId}`);
};

const formatMessageTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const getTypingText = (): string => {
  const ids = Array.from(typingUsers.value);
  if (ids.length === 0) return '';
  const names = ids.map((userId) => {
    if (!currentChat.value) return userId.slice(0, 8);
    const p = currentChat.value.participants.find(
      (participant) => (typeof participant === 'string' ? participant : participant.id) === userId,
    );
    return p && typeof p !== 'string' ? p.username : userId.slice(0, 8);
  });
  if (names.length === 1) return `${names[0]} печатает`;
  return `${names.join(', ')} печатают`;
};

const getReadStatus = (message: Message): 'sent' | 'delivered' | 'read' => {
  // Показываем статус только для своих сообщений
  if (!isOwnMessage(message) || !currentChat.value) {
    return 'sent';
  }

  const chat = currentChat.value;

  // Для приватных чатов
  if (chat.type === 'private') {
    // Находим второго участника (не отправителя)
    const otherParticipant = chat.participants.find((p) => {
      const participantId = typeof p === 'string' ? p : p.id;
      return participantId !== chatStore.user?.id;
    });

    if (!otherParticipant) {
      return 'delivered'; // Сообщение доставлено (в приватном чате всегда доставлено после отправки)
    }

    const otherParticipantId = typeof otherParticipant === 'string' ? otherParticipant : otherParticipant.id;

    // Если другой участник прочитал сообщение - две синие галочки
    if (message.readBy.includes(otherParticipantId)) {
      return 'read';
    }

    // Сообщение доставлено, но не прочитано - две серые галочки
    return 'delivered';
  }

  // Для групповых чатов
  if (chat.type === 'group') {
    // Получаем всех участников кроме отправителя
    const otherParticipants = chat.participants.filter((p) => {
      const participantId = typeof p === 'string' ? p : p.id;
      return participantId !== chatStore.user?.id;
    });

    if (otherParticipants.length === 0) {
      return 'delivered'; // Сообщение доставлено (в группе всегда доставлено после отправки)
    }

    // Проверяем, прочитали ли все участники
    const allRead = otherParticipants.every((p) => {
      const participantId = typeof p === 'string' ? p : p.id;
      return message.readBy.includes(participantId);
    });

    // Если все прочитали - две синие галочки
    if (allRead) {
      return 'read';
    }

    // Сообщение доставлено всем, но не все прочитали - две серые галочки
    return 'delivered';
  }

  return 'delivered';
};

const emit = defineEmits<{(e: 'back'): void;
}>();

const handleBack = (): void => {
  emit('back');
};

const handleGroupUpdated = (updatedChat: any): void => {
  chatStore.updateChat(updatedChat);
};

const handleGroupDeleted = (): void => {
  showGroupSettings.value = false;
  chatStore.setCurrentChat(null);
  router.push('/');
};

interface MessageContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  icon?: 'reply' | 'copy' | 'edit' | 'delete' | 'trash' | 'select' | 'pin' | 'unpin';
}

const getMessageContextMenuActions = (message: Message): MessageContextAction[] => {
  const actions: MessageContextAction[] = [];
  if (message.type !== 'system') {
    if (currentChat.value?.type !== 'private' || isOwnMessage(message)) {
      actions.push({ id: 'select', label: 'Выбрать', icon: 'select' });
    }
  }
  if (message.type !== 'system') {
    actions.push({ id: 'reply', label: 'Ответить', icon: 'reply' });
  }
  if (message.content) {
    actions.push({ id: 'copy', label: 'Копировать', icon: 'copy' });
  }
  if (message.type !== 'system') {
    if (currentChat.value?.pinnedMessage?._id === message._id) {
      actions.push({ id: 'unpin', label: 'Открепить', icon: 'unpin' });
    } else {
      actions.push({ id: 'pin', label: 'Закрепить', icon: 'pin' });
    }
  }
  if (canEditMessage(message)) {
    actions.push({ id: 'edit', label: 'Редактировать', icon: 'edit' });
  }
  if (canDeleteMessage(message)) {
    actions.push({ id: 'delete', label: 'Удалить', icon: 'delete' });
  }
  return actions;
};

const onMessageContextMenu = (message: Message, e: MouseEvent): void => {
  const actions = getMessageContextMenuActions(message);
  if (actions.length === 0) return;
  e.preventDefault();
  contextMenuMessage.value = message;
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  contextMenuVisible.value = true;
};

const copyMessageToClipboard = async (message: Message): Promise<void> => {
  const text = message.content || '';
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    notifySuccess('Сообщение скопировано');
  } catch {
    notifyError('Не удалось скопировать');
  }
};

const hasLinks = (content: string): boolean => {
  if (!content) return false;
  // Регулярное выражение для обнаружения URL
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;
  return urlRegex.test(content);
};

const renderMessageContent = (content: string): string => {
  if (!content) return '';
  
  let result = content;
  
  // Сначала заменяем [icq:filename.gif] на временные плейсхолдеры, чтобы не обрабатывать их как ссылки
  const icqPlaceholders: string[] = [];
  result = result.replace(
    /\[icq:([^\]]+\.gif)\]/g,
    (_match, filename) => {
      const placeholder = `__ICQ_PLACEHOLDER_${icqPlaceholders.length}__`;
      icqPlaceholders.push(`<img src="/images/icq_smiles_hd/${filename}" alt="${filename}" class="chat-window__icq-smile" />`);
      return placeholder;
    },
  );
  
  // Затем заменяем URL на ссылки
  // Регулярное выражение для обнаружения URL (http, https, www, или домены)
  const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}[^\s<>"']*)/gi;
  
  result = result.replace(urlRegex, (url) => {
    // Пропускаем плейсхолдеры ICQ
    if (url.includes('__ICQ_PLACEHOLDER')) {
      return url;
    }
    
    // Если URL уже внутри тега, не обрабатываем
    if (/<[^>]*>/.test(url)) {
      return url;
    }
    
    // Добавляем протокол если его нет
    let href = url;
    if (!url.match(/^https?:\/\//i)) {
      href = url.match(/^www\./i) ? `http://${url}` : `https://${url}`;
    }
    
    // Экранируем HTML для безопасности
    const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-window__message-link">${escapedUrl}</a>`;
  });
  
  // Возвращаем ICQ смайлы обратно
  icqPlaceholders.forEach((placeholder, index) => {
    result = result.replace(`__ICQ_PLACEHOLDER_${index}__`, placeholder);
  });
  
  return result;
};

const hasIcqSmiles = (content: string): boolean => {
  return /\[icq:[^\]]+\.gif\]/.test(content || '');
};

const isOnlyEmojis = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false;
  
  const trimmedContent = content.trim();
  if (!trimmedContent) return false;
  
  // Убираем все ICQ смайлы из текста
  let text = trimmedContent.replace(/\[icq:[^\]]+\.gif\]/g, '');
  
  // Убираем все пробелы, переносы строк и другие пробельные символы
  text = text.replace(/\s+/g, '');
  
  // Если после удаления ICQ смайлов и пробелов ничего не осталось,
  // значит сообщение состояло только из ICQ смайлов (и пробелов)
  if (!text) {
    // Проверяем, что были ICQ смайлы
    return /\[icq:[^\]]+\.gif\]/.test(trimmedContent);
  }
  
  // Проверяем наличие обычных символов (буквы, цифры, знаки препинания кроме эмоджи)
  // Если есть обычные символы, значит это не только эмоджи
  const hasRegularChars = /[a-zA-Z0-9\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0021-\u007E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/.test(text);
  
  if (hasRegularChars) {
    return false;
  }
  
  // Проверяем, что все оставшиеся символы являются эмоджи
  // Используем Unicode свойства для эмоджи
  try {
    const emojiPattern = /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{FE0F}\u{200D}]+$/u;
    return emojiPattern.test(text);
  } catch {
    // Fallback: если регулярное выражение не поддерживается, проверяем вручную
    // Проверяем, что нет обычных печатных символов
    return !/[!-~]/.test(text);
  }
};

/** Проверяет, является ли сообщение стикером (изображение из папки stickers) */
const isSticker = (message: Message): boolean => {
  if (message.type !== 'image' || !message.fileUrl) return false;
  const url = typeof message.fileUrl === 'string' ? message.fileUrl : '';
  // Проверяем путь к стикеру в URL (для загруженных стикеров)
  if (url.includes('/stickers/')) return true;
  // Если fileUrl это base64 (отправленные стикеры), проверяем content на числовое имя файла
  if (url.startsWith('data:image')) {
    const content = message.content || '';
    const trimmedContent = content.trim();
    // Проверяем, что content это имя файла стикера (числовое имя типа "1.png", "2.png" и т.д.)
    return /^\d+\.png$/.test(trimmedContent) || trimmedContent === 'sticker.png';
  }
  return false;
};

/** Проверяет, содержит ли сообщение только стикер или только эмоджи */
const isOnlyStickerOrEmoji = (message: Message): boolean => {
  // Если это стикер
  if (isSticker(message)) {
    const content = message.content || '';
    const url = typeof message.fileUrl === 'string' ? message.fileUrl : '';
    const filename = url.includes('/') && !url.startsWith('data:') ? url.split('/').pop() : '';
    // Если контент пустой, равен только имени файла стикера, или это числовое имя (1.png, 2.png и т.д.)
    // Также проверяем, что нет дополнительного текста кроме имени файла
    const trimmedContent = content.trim();
    return !trimmedContent || 
           trimmedContent === filename || 
           trimmedContent === 'sticker.png' ||
           /^\d+\.png$/.test(trimmedContent);
  }
  // Если это текстовое сообщение только с эмоджи
  if (message.type === 'text') {
    return isOnlyEmojis(message.content || '');
  }
  return false;
};

const enterSelectionMode = (initialMessage?: Message): void => {
  selectionMode.value = true;
  const next = new Set<string>();
  if (initialMessage && canDeleteMessage(initialMessage)) {
    next.add(initialMessage._id);
  }
  selectedMessageIds.value = next;
};

const exitSelectionMode = (): void => {
  selectionMode.value = false;
  selectedMessageIds.value = new Set();
};

const isMessageSelected = (message: Message): boolean => selectedMessageIds.value.has(message._id);

const toggleMessageSelection = (message: Message): void => {
  if (!canDeleteMessage(message)) return;
  const next = new Set(selectedMessageIds.value);
  if (next.has(message._id)) {
    next.delete(message._id);
  } else {
    next.add(message._id);
  }
  selectedMessageIds.value = next;
};

const selectedCount = computed(() => selectedMessageIds.value.size);

const deleteSelectedMessages = async (): Promise<void> => {
  if (!currentChat.value || selectedCount.value === 0) return;
  const { confirm } = useConfirm();
  const confirmed = await confirm(`Удалить выбранные сообщения (${selectedCount.value})?`);
  if (!confirmed) return;
  try {
    const chatId = currentChat.value._id;
    for (const messageId of selectedMessageIds.value) {
      await chatStore.deleteMessage(chatId, messageId);
    }
    notifySuccess(`Удалено сообщений: ${selectedCount.value}`);
    exitSelectionMode();
  } catch (err: any) {
    notifyError(err.response?.data?.error || 'Не удалось удалить сообщения');
  }
};

const onContextMenuSelect = async (action: MessageContextAction): Promise<void> => {
  const msg = contextMenuMessage.value;
  if (!msg) return;
  if (action.id === 'select') enterSelectionMode(msg);
  else if (action.id === 'reply') handleReplyToMessage(msg);
  else if (action.id === 'copy') copyMessageToClipboard(msg);
  else if (action.id === 'pin' && currentChat.value) {
    try {
      await chatStore.updatePinnedMessage(currentChat.value._id, msg._id);
      notifySuccess('Сообщение закреплено');
    } catch {
      notifyError('Не удалось закрепить');
    }
  } else if (action.id === 'unpin' && currentChat.value) {
    try {
      await chatStore.updatePinnedMessage(currentChat.value._id, null);
      notifySuccess('Сообщение откреплено');
    } catch {
      notifyError('Не удалось открепить');
    }
  } else if (action.id === 'edit') handleEditMessage(msg);
  else if (action.id === 'delete') handleDeleteMessage(msg);
};

const contextMenuActions = computed(() => (contextMenuMessage.value ? getMessageContextMenuActions(contextMenuMessage.value) : []));

const handleReplyToMessage = (message: Message): void => {
  // Не позволяем отвечать на системные сообщения
  if (message.type === 'system') {
    return;
  }
  replyToMessage.value = message;
};

const clearReplyToMessage = (): void => {
  replyToMessage.value = null;
};

const scrollToPinnedMessage = async (): Promise<void> => {
  const pinned = currentChat.value?.pinnedMessage;
  if (!pinned || !currentChat.value) return;
  const chatId = currentChat.value._id;
  const isInList = chatStore.messages.some((m) => m._id === pinned._id);
  if (!isInList) {
    const loaded = await chatStore.loadMessagesIncluding(chatId, pinned._id);
    if (!loaded) {
      notifyError('Не удалось загрузить закреплённое сообщение');
      return;
    }
    await nextTick();
  }
  if (!messagesContainer.value) return;
  const messageElId = `message-${pinned._id}`;
  const messageElement = document.getElementById(messageElId);
  if (messageElement) {
    const container = messagesContainer.value;
    const pinnedBar = container.querySelector('.chat-window__pinned-bar') as HTMLElement | null;
    const topOffset = pinnedBar ? pinnedBar.getBoundingClientRect().height + 12 : 20;
    const doScroll = (): void => {
      const containerRect = container.getBoundingClientRect();
      const elementRect = messageElement.getBoundingClientRect();
      const { scrollTop } = container;
      const elementTop = elementRect.top - containerRect.top + scrollTop;
      container.scrollTo({ top: Math.max(0, elementTop - topOffset), behavior: 'smooth' });
    };
    doScroll();
    setTimeout(doScroll, 150);
    messageElement.classList.add('chat-window__message-wrapper--highlighted');
    setTimeout(() => messageElement.classList.remove('chat-window__message-wrapper--highlighted'), 2000);
  }
};

const unpinMessage = async (): Promise<void> => {
  if (!currentChat.value) return;
  try {
    await chatStore.updatePinnedMessage(currentChat.value._id, null);
    notifySuccess('Сообщение откреплено');
  } catch {
    notifyError('Не удалось открепить');
  }
};

const scrollToRepliedMessage = (replyTo: Message | string): void => {
  if (typeof replyTo === 'string') {
    return;
  }
  if (!replyTo._id) {
    return;
  }

  const messageId = `message-${replyTo._id}`;
  const messageElement = document.getElementById(messageId);

  if (messageElement && messagesContainer.value) {
    // Вычисляем позицию элемента относительно контейнера
    const containerRect = messagesContainer.value.getBoundingClientRect();
    const elementRect = messageElement.getBoundingClientRect();
    const { scrollTop } = messagesContainer.value;
    const elementTop = elementRect.top - containerRect.top + scrollTop;

    // Скроллим к элементу с небольшим отступом сверху
    messagesContainer.value.scrollTo({
      top: elementTop - 20,
      behavior: 'smooth',
    });

    // Добавляем визуальное выделение
    messageElement.classList.add('chat-window__message-wrapper--highlighted');
    setTimeout(() => {
      messageElement.classList.remove('chat-window__message-wrapper--highlighted');
    }, 2000);
  }
};

const getReplyToSenderName = (replyTo: Message | string): string => {
  if (typeof replyTo === 'string') {
    return 'Пользователь';
  }
  if (!replyTo.senderId) {
    return 'Пользователь';
  }
  if (!isSenderIdUser(replyTo.senderId)) {
    return 'Пользователь';
  }
  const senderId = replyTo.senderId.id;
  const isOwn = senderId === chatStore.user?.id;
  return isOwn ? 'Вы' : (replyTo.senderId.username || 'Пользователь');
};

const getReplyToText = (replyTo: Message | string): string => {
  if (typeof replyTo === 'string') {
    return '';
  }
  if (replyTo.type === 'image') {
    return '📷 Фото';
  }
  if (replyTo.type === 'file') {
    return '📎 Файл';
  }
  return getTruncatedText(replyTo.content || '');
};

// Функция больше не используется, так как кнопка удалена
// Оставлена для возможного использования в будущем
// Обработчик клика на сообщение для мобильных устройств
const handleMessageClick = (message: Message, event: MouseEvent): void => {
  if (selectionMode.value) {
    toggleMessageSelection(message);
    return;
  }
  // Игнорируем клики на кнопки и интерактивные элементы
  const target = event.target as HTMLElement;
  if (target.closest('.chat-window__reaction')
      || target.closest('.chat-window__reaction-menu')
      || target.closest('a')) {
    return;
  }

  // На мобильных устройствах показываем меню реакций при клике на сообщение (только для чужих сообщений)
  if (isMobile.value && !isOwnMessage(message)) {
    event.stopPropagation();
    if (showReactionMenu.value === message._id) {
      // Очищаем inline styles при закрытии меню
      const menuEl = messagesContainer.value?.querySelector('.chat-window__reaction-menu--visible') as HTMLElement | null;
      if (menuEl) {
        menuEl.style.top = '';
        menuEl.style.bottom = '';
        menuEl.style.left = '';
      }
      showReactionMenu.value = null;
    } else {
      showReactionMenu.value = message._id;
      reactionMenuPosition.value = 'below';
      nextTick(() => updateReactionMenuPosition(message));
    }
  }
};

const VIEWPORT_EDGE_MARGIN = 50;

const updateReactionMenuPosition = (message: Message): void => {
  if (!messagesContainer.value || !isMobile.value) return;
  const contentEl = messagesContainer.value.querySelector(`[data-message-id="${message._id}"]`) as HTMLElement | null;
  const menuEl = messagesContainer.value.querySelector('.chat-window__reaction-menu--visible') as HTMLElement | null;
  if (!contentEl || !menuEl) return;
  const rect = contentEl.getBoundingClientRect();
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const gap = 8; // 0.5rem
  const menuHeight = menuEl.getBoundingClientRect().height;
  // Учитываем высоту header (примерно 73px на мобильных + safe area)
  const headerHeight = 73 + (window.visualViewport ? 0 : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0', 10));
  const spaceAbove = rect.top - gap - menuHeight - headerHeight;
  const spaceBelow = vh - rect.bottom - gap - menuHeight;
  const canShowAbove = spaceAbove >= VIEWPORT_EDGE_MARGIN;
  const canShowBelow = spaceBelow >= VIEWPORT_EDGE_MARGIN;
  
  // Устанавливаем позицию через inline styles для fixed positioning
  if (canShowAbove && !canShowBelow) {
    reactionMenuPosition.value = 'above';
    menuEl.style.top = 'auto';
    menuEl.style.bottom = `${vh - rect.top + gap}px`;
    menuEl.style.left = `${rect.left}px`;
  } else if (!canShowAbove && canShowBelow) {
    reactionMenuPosition.value = 'below';
    menuEl.style.top = `${rect.bottom + gap}px`;
    menuEl.style.bottom = 'auto';
    menuEl.style.left = `${rect.left}px`;
  } else {
    if (spaceBelow >= spaceAbove) {
      reactionMenuPosition.value = 'below';
      menuEl.style.top = `${rect.bottom + gap}px`;
      menuEl.style.bottom = 'auto';
      menuEl.style.left = `${rect.left}px`;
    } else {
      reactionMenuPosition.value = 'above';
      menuEl.style.top = 'auto';
      menuEl.style.bottom = `${vh - rect.top + gap}px`;
      menuEl.style.left = `${rect.left}px`;
    }
  }
};

const handleReactionClick = async (message: Message, emoji: string): Promise<void> => {
  if (!currentChat.value || isOwnMessage(message)) {
    return;
  }
  
  // Очищаем inline styles после выбора реакции
  if (isMobile.value) {
    const menuEl = messagesContainer.value?.querySelector('.chat-window__reaction-menu--visible') as HTMLElement | null;
    if (menuEl) {
      menuEl.style.top = '';
      menuEl.style.bottom = '';
      menuEl.style.left = '';
    }
  }

  try {
    await chatStore.toggleReaction(currentChat.value._id, message._id, emoji);
    showReactionMenu.value = null;
  } catch (error: any) {
    console.error('Ошибка добавления реакции:', error);
  }
};

const hasUserReaction = (message: Message, emoji: string): boolean => {
  if (!message.reactions || !chatStore.user) {
    return false;
  }
  const userIds = message.reactions[emoji] || [];
  return userIds.includes(chatStore.user.id);
};

const getReactionsArray = (message: Message): Array<{ emoji: string; count: number; hasUser: boolean }> => {
  if (!message.reactions) {
    return [];
  }
  return Object.entries(message.reactions)
    .map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      hasUser: hasUserReaction(message, emoji),
    }))
    .filter((reaction) => reaction.count > 0)
    .sort((a, b) => b.count - a.count);
};

/** User IDs, поставившие реакцию emoji на сообщение */
const getReactionUserIds = (message: Message, emoji: string): string[] => {
  return message.reactions?.[emoji] ?? [];
};

/** Участники, поставившие реакцию (id + отображаемое имя из чата) */
const getReactionUsers = (message: Message, emoji: string): Array<{ id: string; username: string }> => {
  const chat = currentChat.value;
  if (!chat) return [];
  const ids = getReactionUserIds(message, emoji);
  return ids.map((userId) => {
    const p = chat.participants.find((participant) => (typeof participant === 'string' ? participant : participant.id) === userId);
    const username = p && typeof p !== 'string' ? p.username : (userId.slice(0, 8) + '…');
    return { id: userId, username };
  });
};

const reactionPopover = ref<{ messageId: string; emoji: string } | null>(null);
const reactionPopoverTrigger = ref<HTMLElement | null>(null);
const reactionPopoverEl = ref<HTMLElement | null>(null);
const REACTION_POPOVER_SHOW_MS = 400;
const REACTION_POPOVER_HIDE_MS = 150;
let reactionPopoverShowTimeout: ReturnType<typeof setTimeout> | null = null;
let reactionPopoverHideTimeout: ReturnType<typeof setTimeout> | null = null;

const onReactionPopoverTriggerEnter = (message: Message, emoji: string, e: MouseEvent): void => {
  const trigger = e.currentTarget as HTMLElement | null;
  if (trigger) showReactionPopover(message, emoji, trigger);
};

const showReactionPopover = (message: Message, emoji: string, trigger: HTMLElement): void => {
  if (reactionPopoverHideTimeout) {
    clearTimeout(reactionPopoverHideTimeout);
    reactionPopoverHideTimeout = null;
  }
  reactionPopoverShowTimeout = setTimeout(() => {
    reactionPopoverShowTimeout = null;
    reactionPopoverTrigger.value = trigger;
    reactionPopover.value = { messageId: message._id, emoji };
    nextTick(() => updateReactionPopoverPosition());
  }, REACTION_POPOVER_SHOW_MS);
};

const hideReactionPopover = (): void => {
  if (reactionPopoverShowTimeout) {
    clearTimeout(reactionPopoverShowTimeout);
    reactionPopoverShowTimeout = null;
  }
  reactionPopoverHideTimeout = setTimeout(() => {
    reactionPopoverHideTimeout = null;
    reactionPopover.value = null;
    reactionPopoverTrigger.value = null;
  }, REACTION_POPOVER_HIDE_MS);
};

const cancelHideReactionPopover = (): void => {
  if (reactionPopoverHideTimeout) {
    clearTimeout(reactionPopoverHideTimeout);
    reactionPopoverHideTimeout = null;
  }
};

const updateReactionPopoverPosition = (): void => {
  if (!reactionPopoverEl.value || !reactionPopoverTrigger.value) return;
  const rect = reactionPopoverTrigger.value.getBoundingClientRect();
  const pop = reactionPopoverEl.value;
  const popRect = pop.getBoundingClientRect();
  const padding = 8;
  let top = rect.top - popRect.height - 8;
  let left = rect.left + rect.width / 2 - popRect.width / 2;
  if (left < padding) left = padding;
  if (left + popRect.width > window.innerWidth - padding) left = window.innerWidth - popRect.width - padding;
  if (top < padding) top = padding;
  if (top + popRect.height > window.innerHeight - padding) top = window.innerHeight - popRect.height - padding;
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
};

const reactionPopoverUsers = computed(() => {
  if (!reactionPopover.value) return [];
  const message = messages.value.find((m) => m._id === reactionPopover.value!.messageId);
  return message ? getReactionUsers(message, reactionPopover.value!.emoji) : [];
});
</script>

<template>
	<div class="chat-window">
		<div v-if="currentChat" ref="headerRef" class="chat-window__header">
			<button
				v-if="isMobile"
				@click="handleBack"
				class="chat-window__back-button"
				aria-label="Назад"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</button>
			<div class="chat-window__header-info">
				<div
					class="chat-window__avatar"
					role="button"
					tabindex="0"
					@click="handleHeaderAvatarClick"
					@keydown.enter="handleHeaderAvatarClick"
					@keydown.space.prevent="handleHeaderAvatarClick"
				>
					<img
						v-if="getAvatar()"
						:src="getAvatar()"
						:alt="getChatName()"
					/>
					<div v-else class="chat-window__avatar-placeholder">
						{{ getChatName().charAt(0).toUpperCase() }}
					</div>
					<span
						v-if="currentChat && currentChat.type === 'private' && getOtherParticipant()"
						:class="['chat-window__status-indicator', `chat-window__status-indicator--${getComputedStatus(getOtherParticipant())}`]"
					/>
				</div>
				<div
					class="chat-window__header-text"
					:class="{ 'chat-window__header-text--clickable': currentChat && isGroupChat }"
					role="button"
					tabindex="0"
					:aria-label="currentChat && isGroupChat ? 'Настройки группы' : undefined"
					@click="handleHeaderTitleClick"
					@keydown.enter.prevent="handleHeaderTitleClick"
					@keydown.space.prevent="handleHeaderTitleClick"
				>
					<h3>{{ getChatName() }}</h3>
					<span v-if="getStatus()" class="chat-window__status">{{ getStatus() }}</span>
				</div>
			</div>
		<Tooltip text="Голосовой звонок" position="bottom">
			<button
				v-if="currentChat && currentChat.type === 'private' && getOtherParticipant()"
				:disabled="callStore.isConnecting || !!callStore.activeCall"
				class="chat-window__call-button"
				aria-label="Голосовой звонок"
				@click="handleStartCall"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
				</svg>
			</button>
		</Tooltip>
		<Tooltip text="Видеозвонок" position="bottom">
			<button
				v-if="currentChat && currentChat.type === 'private' && getOtherParticipant()"
				:disabled="callStore.isConnecting || !!callStore.activeCall"
				class="chat-window__call-button"
				aria-label="Видеозвонок"
				@click="handleStartVideoCall"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M23 7l-7 5 7 5V7z"></path>
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
				</svg>
			</button>
		</Tooltip>
		<Tooltip text="Начать групповой звонок" position="bottom">
			<button
				v-if="currentChat && isGroupChat && !callStore.activeCall && (!callStore.groupCallAvailable || callStore.groupCallAvailable.chatId !== currentChat._id)"
				@click="handleStartGroupCall"
				:disabled="callStore.isConnecting"
				class="chat-window__call-button"
				aria-label="Групповой звонок"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
				</svg>
			</button>
		</Tooltip>
		<Tooltip text="Начать групповой видеозвонок" position="bottom">
			<button
				v-if="currentChat && isGroupChat && !callStore.activeCall && (!callStore.groupCallAvailable || callStore.groupCallAvailable.chatId !== currentChat._id)"
				:disabled="callStore.isConnecting"
				class="chat-window__call-button"
				aria-label="Групповой видеозвонок"
				@click="handleStartGroupVideoCall"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M23 7l-7 5 7 5V7z"></path>
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
				</svg>
			</button>
		</Tooltip>
		</div>

		<div v-else-if="isNewChat && newChatUser" class="chat-window__empty">
			<div class="chat-window__new-chat-info">
				<div class="chat-window__new-chat-avatar">
					<img v-if="getAvatar()" :src="getAvatar()" :alt="getChatName()" />
					<div v-else class="chat-window__new-chat-avatar-placeholder">
						{{ getChatName().charAt(0).toUpperCase() }}
					</div>
					<span
						v-if="getOtherParticipant()"
						:class="['chat-window__new-chat-status-indicator', `chat-window__new-chat-status-indicator--${getComputedStatus(getOtherParticipant())}`]"
					></span>
				</div>
				<div class="chat-window__new-chat-details">
					<h3>{{ getChatName() }}</h3>
					<p class="chat-window__new-chat-status">{{ getStatus() }}</p>
				</div>
			</div>
			<p class="chat-window__new-chat-message">Напишите первое сообщение</p>
		</div>
		<div v-else class="chat-window__empty">
			<p>Напишите первое сообщение</p>
		</div>

		<!-- Входящий звонок -->
		<div v-if="callStore.incomingCall" class="chat-window__incoming-call">
			<div class="chat-window__incoming-call-info">
				<span class="chat-window__incoming-call-label">{{ callStore.incomingCall.isVideo ? 'Входящий видеозвонок' : 'Входящий звонок' }}</span>
				<span class="chat-window__incoming-call-name">{{ callStore.incomingCall.caller?.username || 'Пользователь' }}</span>
			</div>
			<div class="chat-window__incoming-call-actions">
				<button type="button" class="chat-window__call-action chat-window__call-action--reject" @click="handleRejectCall" aria-label="Отклонить">
					<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
					</svg>
				</button>
				<button type="button" class="chat-window__call-action chat-window__call-action--accept" @click="handleAcceptCall" aria-label="Принять">
					<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
					</svg>
				</button>
			</div>
		</div>

		<!-- Можно присоединиться к групповому созвону (показываем всегда, если есть активный созвон) -->
		<div v-if="callStore.groupCallAvailable" class="chat-window__incoming-call">
			<div class="chat-window__incoming-call-info">
				<span class="chat-window__incoming-call-label">{{ callStore.groupCallAvailable.isVideo ? 'Групповой видеосозвон' : 'Групповой созвон' }}</span>
				<span class="chat-window__incoming-call-name">{{ getChatNameById(callStore.groupCallAvailable.chatId) }} · Участников: {{ callStore.groupCallAvailable.participants.length }}</span>
			</div>
			<div class="chat-window__incoming-call-actions">
				<button type="button" class="chat-window__call-action chat-window__call-action--accept" @click="handleJoinGroupCall" :disabled="callStore.isConnecting" aria-label="Присоединиться">
					<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
					</svg>
				</button>
			</div>
		</div>

		<!-- Активный звонок (всегда виден, пока пользователь в созвоне) -->
		<div v-if="callStore.activeCall && !callStore.isVideoCall" class="chat-window__active-call">
			<span class="chat-window__active-call-label">
				{{ callStore.isGroupCall
					? `${getChatNameById(callStore.activeCall.chatId)} · Групповой звонок (${callStore.activeCall.participants.length})`
					: `Звонок · ${getChatNameById(callStore.activeCall.chatId)}`
				}}
			</span>
			<button type="button" :class="['chat-window__call-action', { 'chat-window__call-action--muted': callStore.isMuted }]" @click="callStore.setMuted(!callStore.isMuted)" aria-label="Микрофон">
				<svg v-if="!callStore.isMuted" width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
				<svg v-else width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path></svg>
			</button>
			<button type="button" class="chat-window__call-action chat-window__call-action--hangup" @click="callStore.hangUp()" aria-label="Завершить">
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
			</button>
		</div>

		<!-- Видеозвонок: полноэкранная панель с видео -->
		<div v-if="callStore.activeCall && callStore.isVideoCall" class="chat-window__video-call">
			<div
			class="chat-window__video-call-remote"
			:class="{ 'chat-window__video-call-remote--grid': callStore.isGroupCall }"
			:style="callStore.isGroupCall ? groupVideoGridStyle : undefined"
		>
				<template v-if="callStore.isGroupCall">
					<div
						v-for="userId in Object.keys(callStore.remoteStreams)"
						:key="userId"
						class="chat-window__video-call-tile"
					>
						<video
							:ref="(el) => setRemoteVideoEl(userId, el)"
							autoplay
							playsinline
							class="chat-window__video-call-video"
						/>
						<span
							v-if="callStore.activeCall?.chatId"
							class="chat-window__video-call-tile-label"
						>{{ getParticipantUsername(callStore.activeCall.chatId, userId) }}</span>
					</div>
					<div v-if="Object.keys(callStore.remoteStreams).length === 0" class="chat-window__video-call-placeholder">
						<svg width="64" height="64" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
						<span>Ожидание видео...</span>
					</div>
				</template>
				<template v-else>
					<div class="chat-window__video-call-tile chat-window__video-call-tile--single">
						<video ref="remoteVideoRef" autoplay playsinline class="chat-window__video-call-video" />
						<span
							v-if="callStore.activeCall?.chatId && callStore.activeCall?.peerUserId"
							class="chat-window__video-call-tile-label"
						>{{ getParticipantUsername(callStore.activeCall.chatId, callStore.activeCall.peerUserId) }}</span>
					</div>
					<div v-if="!callStore.activeCall?.peerUserId || !callStore.remoteStreams[callStore.activeCall.peerUserId]" class="chat-window__video-call-placeholder">
						<svg width="64" height="64" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
						<span>Ожидание видео...</span>
					</div>
				</template>
			</div>
			<div class="chat-window__video-call-local">
				<video ref="localVideoRef" autoplay muted playsinline class="chat-window__video-call-video chat-window__video-call-video--local" />
			</div>
			<div class="chat-window__video-call-controls">
				<div class="chat-window__video-call-device-group">
					<button type="button" :class="['chat-window__call-action', { 'chat-window__call-action--muted': callStore.isMuted }]" @click="callStore.setMuted(!callStore.isMuted)" aria-label="Микрофон">
						<svg v-if="!callStore.isMuted" width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
						<svg v-else width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path></svg>
					</button>
					<button type="button" class="chat-window__video-call-device-trigger" :class="{ 'chat-window__video-call-device-trigger--open': videoCallMicDropdownOpen }" aria-label="Выбор микрофона" @click="videoCallMicDropdownOpen = !videoCallMicDropdownOpen; videoCallCameraDropdownOpen = false">
						<svg width="12" height="12" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</button>
					<div v-if="videoCallMicDropdownOpen" class="chat-window__video-call-device-dropdown">
						<button type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': !callStore.selectedMicId }" @click="callStore.switchAudioInput(null); videoCallMicDropdownOpen = false">По умолчанию</button>
						<button v-for="dev in callStore.audioDevices" :key="dev.deviceId" type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': callStore.selectedMicId === dev.deviceId }" @click="callStore.switchAudioInput(dev.deviceId); videoCallMicDropdownOpen = false">{{ dev.label || `Микрофон ${dev.deviceId.slice(0, 8)}` }}</button>
					</div>
				</div>

				<div v-if="callStore.activeCall?.isVideo" class="chat-window__video-call-device-group">
					<button type="button" :class="['chat-window__call-action', { 'chat-window__call-action--muted': callStore.isVideoOff }]" @click="callStore.setVideoOff(!callStore.isVideoOff)" aria-label="Камера">
						<svg v-if="!callStore.isVideoOff" width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
						<svg v-else width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
					</button>
					<button type="button" class="chat-window__video-call-device-trigger" :class="{ 'chat-window__video-call-device-trigger--open': videoCallCameraDropdownOpen }" aria-label="Выбор камеры" @click="videoCallCameraDropdownOpen = !videoCallCameraDropdownOpen; videoCallMicDropdownOpen = false">
						<svg width="12" height="12" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</button>
					<div v-if="videoCallCameraDropdownOpen" class="chat-window__video-call-device-dropdown">
						<button type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': !callStore.selectedCameraId }" @click="callStore.switchVideoInput(null); videoCallCameraDropdownOpen = false">По умолчанию</button>
						<button v-for="dev in callStore.videoDevices" :key="dev.deviceId" type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': callStore.selectedCameraId === dev.deviceId }" @click="callStore.switchVideoInput(dev.deviceId); videoCallCameraDropdownOpen = false">{{ dev.label || `Камера ${dev.deviceId.slice(0, 8)}` }}</button>
					</div>
				</div>

				<Tooltip :text="callStore.isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'" position="top">
					<button
						v-if="callStore.activeCall?.isVideo"
						type="button"
						:class="['chat-window__call-action', { 'chat-window__call-action--active': callStore.isScreenSharing }]"
						@click="callStore.toggleScreenShare()"
						aria-label="Демонстрация экрана"
					>
						<svg width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
							<line x1="8" y1="21" x2="16" y2="21"></line>
							<line x1="12" y1="17" x2="12" y2="21"></line>
						</svg>
					</button>
				</Tooltip>

				<button type="button" class="chat-window__call-action chat-window__call-action--hangup" @click="callStore.hangUp()" aria-label="Завершить">
					<svg width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
				</button>
			</div>
		</div>

		<audio ref="remoteAudioRef" autoplay />

		<div v-if="currentChat" class="chat-window__messages" :class="{ 'chat-window__messages--with-pinned': currentChat.pinnedMessage }" ref="messagesContainer" @scroll="onMessagesScroll">
			<div v-if="currentChat.pinnedMessage" class="chat-window__pinned-bar">
				<div class="chat-window__pinned-content" @click="scrollToPinnedMessage">
					<span class="chat-window__pinned-label">Закреплено</span>
					<span class="chat-window__pinned-sender">{{ getReplyToSenderName(currentChat.pinnedMessage) }}</span>
					<span class="chat-window__pinned-text">{{ getReplyToText(currentChat.pinnedMessage) || 'Сообщение' }}</span>
				</div>
				<div class="chat-window__pinned-actions">
					<button type="button" class="chat-window__pinned-btn" @click.stop="scrollToPinnedMessage">Перейти</button>
					<button type="button" class="chat-window__pinned-btn chat-window__pinned-btn--unpin" @click.stop="unpinMessage" aria-label="Открепить">Открепить</button>
				</div>
			</div>
			<div v-if="chatStore.loadingMessages" class="chat-window__messages-loader">
				<div class="chat-window__messages-loader-spinner" aria-hidden="true" />
				<span class="chat-window__messages-loader-text">Загрузка сообщений...</span>
			</div>

			<template v-for="message in messages" :key="message._id">
				<!-- Системное сообщение -->
				<div
					v-if="message.type === 'system'"
					class="chat-window__message chat-window__message--system"
				>
					<div class="chat-window__system-message">
						<span class="chat-window__system-text">{{ message.content }}</span>
						<span class="chat-window__system-time">{{ formatMessageTime(message.createdAt) }}</span>
					</div>
				</div>
				<!-- Обычное сообщение (не системное) -->
				<div
					v-else
					:id="`message-${message._id}`"
					:class="['chat-window__message-wrapper', {
						'chat-window__message-wrapper_me': isOwnMessage(message),
						'chat-window__message-wrapper--selected': selectionMode && isMessageSelected(message),
						'chat-window__message-wrapper--selectable': selectionMode && canDeleteMessage(message)
					}]"
					@dblclick="!selectionMode && handleReplyToMessage(message)"
					@click="handleMessageClick(message, $event)"
					@contextmenu.prevent="onMessageContextMenu(message, $event)"
				>
					<div
						v-if="selectionMode && canDeleteMessage(message)"
						class="chat-window__message-select-checkbox"
						@click.stop="toggleMessageSelection(message)"
					>
						<svg v-if="isMessageSelected(message)" class="chat-window__message-select-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
						<span v-else class="chat-window__message-select-box"></span>
					</div>
					<div
						:class="['chat-window__message', {
							'chat-window__message_me': isOwnMessage(message),
							'chat-window__message--unread': isUnreadMessage(message)
						}]"
					>
						<div
							v-if="isGroupChat"
							class="chat-window__message-avatar"
							@click="openUserInfo(message)"
						>
							<img
								v-if="getMessageAvatar(message)"
								:src="getMessageAvatar(message)"
								:alt="getMessageSender(message)"
							/>
							<div v-else class="chat-window__message-avatar-placeholder">
								{{ getMessageSender(message).charAt(0).toUpperCase() }}
							</div>
							<span
								v-if="isMessageSenderUser(message)"
								:class="['chat-window__status-indicator', `chat-window__status-indicator--${getMessageSenderStatus(message)}`]"
							/>
						</div>
						<div class="chat-window__message-content" :data-message-id="message._id">
							<div class="chat-window__message-header">
								<div
									class="chat-window__message-sender"
									@click="openUserInfo(message)"
								>
									{{ getMessageSender(message) }}
								</div>
								<div class="chat-window__message-time">
									{{ formatMessageTime(message.createdAt) }}
								</div>
							</div>
							<div 
								class="chat-window__message-bubble"
								:class="{ 'chat-window__message-bubble--transparent': isOnlyStickerOrEmoji(message) }"
							>
								<!-- Ответ на сообщение -->
								<div v-if="message.replyTo" class="chat-window__message-reply">
									<div class="chat-window__message-reply-line"></div>
									<div
										class="chat-window__message-reply-content"
										@click="scrollToRepliedMessage(message.replyTo)"
									>
										<span class="chat-window__message-reply-sender">
											{{ getReplyToSenderName(message.replyTo) }}
										</span>
										<span class="chat-window__message-reply-text">
											{{ getReplyToText(message.replyTo) }}
										</span>
									</div>
								</div>
								<div v-if="message.type === 'image' && message.fileUrl" class="chat-window__message-image" @click.stop="openMessageView(message)">
									<img :src="getImageUrl(message.fileUrl) || message.fileUrl" :alt="message.content" />
								</div>
								<div v-else-if="message.type === 'file' && message.fileUrl" class="chat-window__message-file">
									<a :href="getImageUrl(message.fileUrl) || message.fileUrl" target="_blank">{{ message.content }}</a>
								</div>
								<div v-else class="chat-window__message-text-wrapper">
									<div
										class="chat-window__message-text"
										:class="{
											'chat-window__message-text--html': hasIcqSmiles(message.content || '') || hasLinks(message.content || ''),
											'chat-window__message-text--only-emojis': isOnlyEmojis(message.content || '')
										}"
									>
										<span
											v-if="hasIcqSmiles(message.content || '') || hasLinks(message.content || '')"
											v-html="renderMessageContent(shouldTruncateMessage(message) ? getTruncatedText(message.content) : (message.content || ''))"
										/>
										<span v-else>
											{{ shouldTruncateMessage(message) ? getTruncatedText(message.content) : message.content }}
										</span>
									</div>
									<button
										v-if="shouldTruncateMessage(message)"
										class="chat-window__message-expand-button"
										@click.stop="openMessageView(message)"
										type="button"
									>
										Открыть полностью
									</button>
								</div>
								<div v-if="isOwnMessage(message)" class="chat-window__message-footer">
									<div class="chat-window__message-footer-right">
										<div class="chat-window__message-status" :class="`chat-window__message-status--${getReadStatus(message)}`">
											<!-- Одна галочка (отправлено) -->
											<svg v-if="getReadStatus(message) === 'sent'" width="16" height="16" viewBox="0 0 16 16" style="fill: none">
												<path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
											<!-- Две галочки (доставлено/прочитано) -->
											<svg v-else width="16" height="16" viewBox="0 0 16 16" style="fill: none">
												<path d="M2 8L5 11L12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
												<path d="M6 8L9 11L16 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</div>
									</div>
								</div>
								<!-- Реакции на сообщение -->
								<div v-if="getReactionsArray(message).length > 0" class="chat-window__reactions-list">
									<div
										v-for="reaction in getReactionsArray(message)"
										:key="reaction.emoji"
										class="chat-window__reaction-popover-trigger"
										@mouseenter="(e) => onReactionPopoverTriggerEnter(message, reaction.emoji, e)"
										@mouseleave="hideReactionPopover()"
									>
										<button
											:class="['chat-window__reaction', { 'chat-window__reaction--active': reaction.hasUser }]"
											@click="!isOwnMessage(message) && handleReactionClick(message, reaction.emoji)"
											:title="`${reaction.count} ${reaction.count === 1 ? 'реакция' : 'реакций'}`"
											:disabled="isOwnMessage(message)"
											:style="isOwnMessage(message) ? { cursor: 'default', opacity: 1 } : {}"
										>
											<span class="chat-window__reaction-emoji">{{ reaction.emoji }}</span>
											<span class="chat-window__reaction-count">{{ reaction.count }}</span>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Меню выбора реакции (только для чужих сообщений) -->
					<!-- На десктопе показывается через CSS :hover, на мобильных через v-if -->
					<div
						v-if="!isOwnMessage(message)"
						:class="['chat-window__reaction-menu', {
							'chat-window__reaction-menu--visible': showReactionMenu === message._id,
							'chat-window__reaction-menu--above': showReactionMenu === message._id && reactionMenuPosition === 'above'
						}]"
					>
						<button
							v-for="emoji in availableReactions"
							:key="emoji"
							class="chat-window__reaction-menu-item"
							@click="handleReactionClick(message, emoji)"
						>
							{{ emoji }}
						</button>
					</div>
				</div>
			</template>

			<div v-if="typingUsers.size > 0" class="chat-window__typing">
				<span>{{ getTypingText() }}</span>
			</div>
		</div>

		<button
			v-if="currentChat && showScrollToBottom"
			type="button"
			class="chat-window__scroll-to-bottom"
			aria-label="К последнему сообщению"
			@click="scrollToBottom"
		>
			<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>

		<Teleport to="body">
			<div
				v-if="reactionPopover && reactionPopoverUsers.length > 0"
				ref="reactionPopoverEl"
				class="chat-window__reaction-popover"
				role="tooltip"
				@mouseenter="cancelHideReactionPopover"
				@mouseleave="hideReactionPopover"
			>
				<ul class="chat-window__reaction-popover-list">
					<li
						v-for="user in reactionPopoverUsers"
						:key="user.id"
						class="chat-window__reaction-popover-item"
					>
						{{ user.username }}
					</li>
				</ul>
				<span class="chat-window__reaction-popover-arrow" aria-hidden="true" />
			</div>
		</Teleport>

		<!-- Панель массовых действий при выборе сообщений -->
		<div v-if="currentChat && selectionMode" class="chat-window__selection-bar">
			<button
				type="button"
				class="chat-window__selection-bar-delete"
				:disabled="selectedCount === 0"
				@click="deleteSelectedMessages"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="3 6 5 6 21 6"></polyline>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
					<line x1="10" y1="11" x2="10" y2="17"></line>
					<line x1="14" y1="11" x2="14" y2="17"></line>
				</svg>
				Удалить выбранные ({{ selectedCount }})
			</button>
			<button type="button" class="chat-window__selection-bar-cancel" @click="exitSelectionMode">
				Отмена
			</button>
		</div>

		<MessageInput
			ref="messageInputRef"
			v-if="(currentChat || isNewChat) && !selectionMode"
			:chat-id="currentChat?._id"
			:user-id="isNewChat ? newChatUserId : undefined"
			:reply-to="replyToMessage"
			:edit-message="editMessage"
			@clear-reply="clearReplyToMessage"
			@clear-edit="clearEditMessage"
			@start-edit-last="handleStartEditLast"
		/>

		<ContextMenu
			v-model="contextMenuVisible"
			:x="contextMenuX"
			:y="contextMenuY"
			:actions="contextMenuActions"
			@select="onContextMenuSelect"
		/>

		<UserInfoModal
			:is-open="showUserInfo"
			:user="selectedUser"
			@close="closeUserInfo"
			@send-message="handleSendMessage"
		/>

		<GroupSettingsModal
			v-if="currentChat && isGroupChat"
			:is-open="showGroupSettings"
			:chat="currentChat"
			@close="showGroupSettings = false"
			@updated="handleGroupUpdated"
			@deleted="handleGroupDeleted"
		/>

		<MessageViewModal
			:is-open="showMessageView"
			:message="selectedMessage"
			@close="closeMessageView"
		/>
	</div>
</template>

<style scoped lang="scss">
.chat-window {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: -webkit-fill-available;
  background: var(--bg-primary);
  /* Предотвращаем изменение высоты при открытии клавиатуры на мобильных */
  @media (max-width: 768px) {
    height: 100dvh;
    height: -webkit-fill-available;
    max-height: 100dvh;
    /* Не используем overflow: hidden, чтобы не блокировать прокрутку сообщений */
    position: relative;
    /* Фиксируем контейнер, чтобы он не менял размер при открытии клавиатуры */
    touch-action: pan-y;
  }

  &__header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--surface, var(--bg-secondary));
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 10;

    @media (max-width: 768px) {
      /* JavaScript будет управлять позиционированием через inline стили */
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      width: 100%;
      /* Создаем новый слой композиции для надежной работы на мобильных */
      transform: translateZ(0);
      backface-visibility: hidden;
      will-change: transform, top;
      /* Учитываем safe area для устройств с вырезом */
      padding-top: calc(1rem + env(safe-area-inset-top, 0px));
      padding-bottom: 1rem;
      padding-left: calc(1rem + env(safe-area-inset-left, 0px));
      padding-right: calc(1rem + env(safe-area-inset-right, 0px));
    }
  }

  &__back-button {
    display: none;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: background 0.2s;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-primary);
    }

    @media (max-width: 768px) {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &__header-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  &__call-button {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.2s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      background: var(--bg-primary);
      color: var(--accent-color);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: visible;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    cursor: pointer;

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
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary);
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
  }

  &__header-text {
    flex: 1;
    min-width: 0;

    &--clickable {
      cursor: pointer;

      &:hover h3 {
        color: var(--accent-color);
      }
    }

    h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-heading-size, 1rem);
      font-weight: var(--font-heading-weight, 600);
      transition: color 0.2s;
    }
  }

  &__status {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  &__incoming-call {
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;

    @media (max-width: 768px) {
      position: sticky;
      top: calc(73px + env(safe-area-inset-top, 0px));
      z-index: 99;
      transform: translateZ(0);
    }
  }

  &__incoming-call-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__incoming-call-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  &__incoming-call-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  &__incoming-call-actions {
    display: flex;
    gap: 0.5rem;
  }

  &__active-call {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;

    @media (max-width: 768px) {
      position: sticky;
      top: calc(73px + env(safe-area-inset-top, 0px));
      z-index: 99;
      transform: translateZ(0);
    }
  }

  &__active-call-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    flex: 1;
  }

  &__call-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-primary);
    background: var(--bg-primary);

    &:hover {
      opacity: 0.9;
    }

    &--accept {
      background: #22c55e;
      color: #fff;
    }

    &--reject {
      background: #ef4444;
      color: #fff;
    }

    &--hangup {
      background: #ef4444;
      color: #fff;
    }

    &--muted {
      background: var(--text-secondary);
      color: var(--bg-primary);
    }

    &--active {
      background: var(--accent-color);
      color: #fff;
    }
  }

  &__video-call {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
  }

  &__video-call-remote {
    flex: 1;
    position: relative;
    background: #000;
    min-height: 0;

    &--grid {
      display: grid;
      grid-template-columns: repeat(var(--grid-cols, 2), 1fr);
      grid-auto-rows: 1fr;
      gap: 0.75rem;
      padding: 0.75rem;
      align-content: center;
      align-items: center;
      justify-items: center;
    }
  }

  &__video-call-tile {
    position: relative;
    width: 100%;
    max-width: 100%;
    aspect-ratio: 4 / 3;
    background: #111;
    border-radius: 8px;
    overflow: hidden;
    min-height: 0;

    &--single {
      position: absolute;
      inset: 0;
      aspect-ratio: auto;
    }

    .chat-window__video-call-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
  }

  &__video-call-tile-label {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    max-width: calc(100% - 1rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  &__video-call-video {
    width: 100%;
    height: 100%;
    object-fit: contain;

    &--local {
      object-fit: cover;
    }
  }

  &__video-call-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__video-call-local {
    position: absolute;
    right: 1rem;
    bottom: 5rem;
    width: 120px;
    height: 90px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--border-color);
    background: #000;
  }

  &__video-call-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  }

  &__video-call-device-group {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 24px;

    .chat-window__call-action {
      border-radius: 50%;
    }
  }

  &__video-call-device-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    margin-right: 2px;
    color: rgba(255, 255, 255, 0.9);
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    svg {
      transition: transform 0.2s;
    }

    &--open svg {
      transform: rotate(180deg);
    }
  }

  &__video-call-device-dropdown {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    left: 0;
    min-width: 200px;
    max-height: 240px;
    overflow-y: auto;
    padding: 0.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 30;
  }

  &__video-call-device-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    text-align: left;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background: var(--bg-primary);
    }

    &--active {
      background: var(--bg-primary);
      font-weight: 500;
    }
  }

  &__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    padding: 2rem;
  }

  &__new-chat-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  &__new-chat-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: visible;
    position: relative;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__new-chat-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 3rem;
    border-radius: 50%;
  }

  &__new-chat-status-indicator {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid var(--bg-primary);
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

  &__new-chat-details {
    text-align: center;
  }

  &__new-chat-details h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  &__new-chat-status {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__new-chat-message {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }

  &__messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;

    @media (max-width: 768px) {
      overflow-x: hidden;
      padding: calc(0.75rem + 73px + env(safe-area-inset-top, 0px)) 0.75rem calc(100px + env(safe-area-inset-bottom, 0px));
      //gap: 0.5rem;
      margin-top: 0;
      scroll-padding-top: calc(73px + env(safe-area-inset-top, 0px));
    }

    &--with-pinned {
      padding-top: calc(1rem + 80px);

      @media (max-width: 768px) {
        padding-top: calc(0.75rem + 73px + 80px + env(safe-area-inset-top, 0px));
      }
    }
  }

  &__messages-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    min-height: 120px;
  }

  &__messages-loader-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: chat-window-loader-spin 0.8s linear infinite;
  }

  &__messages-loader-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  @keyframes chat-window-loader-spin {
    to {
      transform: rotate(360deg);
    }
  }

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

  &__message-wrapper {
		position: relative;
    width: 100%;
    display: flex;
    padding: 0.25rem 1rem;
    cursor: pointer;
    justify-content: flex-start;
    transition: background 0.2s;
    border-radius: 8px;

    &:hover {
      background: var(--bg-secondary);
    }

    @media (max-width: 768px) {
      padding: 0.25rem 0.75rem;
    }

    &_me {
      justify-content: flex-end;
			text-align: right;
    }

    &--highlighted {
      background: rgba(59, 130, 246, 0.15);
      animation: highlight-pulse 2s ease-out;
    }

    &--selected {
      background: rgba(59, 130, 246, 0.12);
    }

    &--selectable {
      cursor: pointer;
    }
  }

  &__message-select-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    margin-right: 0.5rem;
    align-self: center;
    color: var(--accent-color);
  }

  &__message-select-check {
    flex-shrink: 0;
  }

  &__message-select-box {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    display: block;
  }

  &__selection-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  &__selection-bar-delete {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__selection-bar-cancel {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-primary);
    }
  }

  @keyframes highlight-pulse {
    0% {
      background: rgba(59, 130, 246, 0.3);
    }
    100% {
      background: transparent;
    }
  }

  &__message {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    max-width: 70%;
    align-self: flex-start;

    @media (max-width: 768px) {
      max-width: 85%;
      gap: 0.375rem;
    }

    &--system {
      max-width: 100%;
      align-self: center;
      justify-content: center;
      margin: 0.5rem 0;
    }

    &_me {
      align-self: flex-end;
      flex-direction: row-reverse;

      .chat-window__message-bubble {
        background: var(--accent-color);
        color: white;
        border-bottom-right-radius: 4px;

        &--transparent {
          background: transparent;
        }
      }

      .chat-window__message-footer {
        justify-content: flex-end;
      }

      .chat-window__message-header {
        justify-content: flex-end;
      }

      .chat-window__message-status {
        &--sent,
        &--delivered {
          color: rgba(255, 255, 255, 0.7);
        }

        &--read {
          color: rgba(255, 255, 255, 0.9);
        }
      }

      // В групповых чатах для своих сообщений аватар справа от сообщения
      // При flex-direction: row-reverse аватарка (первая в HTML) будет справа
      .chat-window__message-avatar {
        order: 0;
      }

      .chat-window__message-content {
        order: 0;
      }

			.chat-window__reaction-count {
				color: var(--border-color);
			}
    }

    &--unread {
      .chat-window__message-bubble {
        background: #ff3b30;
        color: white;
        border: 2px solid #ff3b30;

        &--transparent {
          background: transparent;
          border: none;
        }
      }
    }
  }

  &__system-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border-radius: 12px;
    max-width: 80%;
  }

  &__system-text {
    color: var(--text-secondary);
    font-size: 0.85rem;
    text-align: center;
    font-style: italic;
  }

  &__system-time {
    color: var(--text-secondary);
    font-size: 0.75rem;
    opacity: 0.7;
  }

  &__message-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: visible;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.2s;
    position: relative;

    &:hover {
      transform: scale(1.1);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__message-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
		border-radius: 50%;
  }

  &__message-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    position: relative; // Для позиционирования меню реакций
  }

  &__message-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    padding-left: 0.5rem;
    padding-right: 0.25rem;
  }

  &__message-sender {
    color: var(--text-primary);
    font-size: 1rem;
    cursor: pointer;
    transition: color 0.2s;
    flex-shrink: 0;

    &:hover {
      color: var(--accent-color);
      text-decoration: underline;
    }
  }

	&__message-time {
		font-size: 0.75rem;
		opacity: 0.8;
		text-align: right;
		flex-shrink: 0;
	}

  &__message-reply {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.08);
    }
  }

  &__message-reply-line {
    width: 3px;
    background: var(--accent-color);
    border-radius: 2px;
    flex-shrink: 0;
  }

  &__message-reply-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    cursor: pointer;
    min-width: 0;
  }

  &__message-reply-sender {
    font-weight: 600;
    font-size: 0.85rem;
  }

  &__message-reply-text {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
  }

  &__message-bubble {
    padding: 0.5rem 0.75rem;
    background: var(--surface, var(--bg-secondary));
    border-radius: var(--radius-md, 12px) var(--radius-md, 12px) var(--radius-md, 12px) 4px;
    color: var(--text-primary);
    position: relative;
    word-wrap: break-word;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);

    &--transparent {
      background: transparent;
      padding: 0;
      box-shadow: none;
    }
  }

  &__message-text-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__message-text {
    margin-bottom: 0;
    font-size: var(--message-text-size);
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    color: var(--text-primary);

    &--html {
      white-space: normal;
      line-height: 1.5;
    }

    &--only-emojis {
      --message-text-size: 48px;
      font-size: 48px;
      line-height: 1.2;
    }
  }

  &__icq-smile {
    display: inline-block;
    vertical-align: middle;
    width: 24px;
    height: 24px;
    margin: 0 2px;
    object-fit: contain;
    image-rendering: high-quality;
  }

  &__message-link {
    color: inherit;
    text-decoration: underline;
    word-break: break-all;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.8;
    }

    &:visited {
      color: inherit;
      opacity: 0.9;
    }
  }

  &__message-expand-button {
    align-self: flex-start;
    padding: 0.375rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.25rem;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      background: var(--bg-primary);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }

    &:active {
      transform: scale(0.98);
    }

    @media (max-width: 768px) {
      width: 100%;
      align-self: stretch;
      padding: 0.5rem 1rem;
      font-size: 0.9375rem;
    }
  }

  &__message-image {
    max-width: 200px;
    margin-bottom: 0.25rem;
    cursor: pointer;

    img {
      max-width: 100%;
      border-radius: 8px;
    }
  }

  &__message-file {
    margin-bottom: 0.25rem;

    a {
      color: inherit;
      text-decoration: underline;
    }
  }

  &__message-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    margin-top: 0.5rem;
    position: relative;
    z-index: 15; // Выше меню реакций, чтобы кнопка ответа была видна
  }

  &__message-footer-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    position: relative;
    z-index: 15; // Выше меню реакций
		margin-left: 16px;

    @media (max-width: 768px) {
      gap: 0.625rem;
    }
  }

  &__reactions-list {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  &__reaction {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
		color: currentColor;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;

    &:hover:not(:disabled) {
      background: var(--bg-primary);
      border-color: var(--accent-color);
    }

    &:disabled {
      cursor: default;
      opacity: 1;
    }

    &--active {
      background: rgba(var(--accent-color-rgb, 59, 130, 246), 0.1);
      border-color: var(--accent-color);
    }
  }

  &__reaction-emoji {
    font-size: 1rem;
    line-height: 1;
  }

  &__reaction-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--accent-color);
  }

  &__reaction-popover-trigger {
    display: inline-block;
  }

  &__reaction-popover {
    position: fixed;
    z-index: 10000;
    padding: 0.5rem 0;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.4;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    min-width: 120px;
    max-width: 220px;
    max-height: 200px;
    overflow-y: auto;
  }

  &__reaction-popover-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__reaction-popover-item {
    padding: 0.35rem 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__reaction-popover-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 6px 6px 0 6px;
    border-color: var(--bg-secondary) transparent transparent transparent;
  }

  &__reaction-menu {
    position: absolute;
    bottom: 95%;
    right: 0;
    left: auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    flex-wrap: nowrap;
    max-width: calc(100% - 80px);
    transform: translateY(5px);
    transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
    opacity: 0;

    @media (hover: hover) and (pointer: fine) {
      .chat-window__message-wrapper:hover & {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
    }

    // На мобильных устройствах показываем только если явно открыто через клик
    // Позиция выше/ниже сообщения выбирается с отступом 50px от краёв viewport
    @media (max-width: 768px) {
      position: fixed; // Используем fixed positioning для корректного отображения поверх header
      z-index: 1002; // Выше шапки чата (1000) и футера с кнопками (15)
      left: 0;
      right: auto;
      max-width: 200px;
      width: max-content;
      min-width: 0;
      flex-wrap: wrap;
      padding: 0.625rem;
      gap: 0.375rem;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease, transform 0.15s ease;
      box-sizing: border-box;

      // По умолчанию — снизу от сообщения (позиция устанавливается через inline styles)
      top: auto;
      bottom: auto;
      transform: translateY(-6px) scale(0.96);

      &--visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }

      // Вариант: сверху от сообщения (когда снизу не хватает места)
      &--above {
        transform: translateY(6px) scale(0.96);

        &.chat-window__reaction-menu--visible {
          transform: translateY(0) scale(1);
        }
      }
    }

    // На десктопе также учитываем header при позиционировании
    @media (min-width: 769px) {
      // Если меню находится слишком близко к верху (под header), показываем его снизу
      .chat-window__message-wrapper:first-of-type & {
        bottom: auto;
        top: calc(100% + 0.5rem);
        transform: translateY(-5px);
        
        .chat-window__message-wrapper:hover & {
          transform: translateY(0);
        }
      }
    }
  }

  &__reaction-menu-item {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 1.5rem;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-primary);
    }

    @media (max-width: 768px) {
      width: 36px;
      height: 36px;
      font-size: 1.75rem;
      border-radius: 10px;

      &:active {
        background: var(--bg-primary);
        transform: scale(0.95);
      }
    }
  }

  &__message-status {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-left: auto;
    color: var(--text-secondary);
    opacity: 0.7;

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    &--sent {
      color: var(--text-secondary);
      opacity: 0.5;
    }

    &--delivered {
      color: var(--text-secondary);
      opacity: 0.7;
    }

    &--read {
      color: #4a9eff;
      opacity: 1;
    }
  }

  &__typing {
    padding: 0.5rem 1rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-style: italic;
  }

  &__scroll-to-bottom {
    position: absolute;
    bottom: 7.5rem;
    right: 1rem;
    z-index: 20;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    color: var(--text-primary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: opacity 0.2s, transform 0.2s;

    &:hover {
      background: var(--bg-primary);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }

    &:active {
      transform: scale(0.95);
    }

    @media (max-width: 768px) {
      right: 0.75rem;
      width: 48px;
      height: 48px;
    }
  }
}
</style>
