<script setup lang="ts">
import {
  computed, watch, ref, nextTick, onMounted, onUnmounted,
} from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { useChatStore } from '../stores/chat.store';
import { useCallStore } from '../stores/call.store';
import ChatHeader from './ChatHeader.vue';
import ChatCallOverlay from './ChatCallOverlay.vue';
import ChatMessageList from './ChatMessageList.vue';
import MessageInput from './MessageInput.vue';
import UserInfoModal from './UserInfoModal.vue';
import GroupSettingsModal from './GroupSettingsModal.vue';
import MessageViewModal from './MessageViewModal.vue';
import { Message, User } from '../types';
import { getComputedStatus } from '../utils/status';
import { useNotifications } from '../composables/useNotifications';
import api from '../services/api';
import { getChatName as resolveChatName, getChatAvatar, getOtherParticipant as resolveOther, getChatStatusLabel } from '../utils/chatDisplay';

const chatStore = useChatStore();
const callStore = useCallStore();
const { error: notifyError } = useNotifications();

const showUserInfo = ref(false);
const selectedUser = ref<User | null>(null);
const showGroupSettings = ref(false);
const replyToMessage = ref<Message | null>(null);
const editMessage = ref<Message | null>(null);
const selectionMode = ref(false);
const isMobile = ref(window.innerWidth <= 768);
const showMessageView = ref(false);
const selectedMessage = ref<Message | null>(null);
const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null);
const messageListRef = ref<{
  scrollToBottom:(smooth?: boolean) => void;
  selectionMode: boolean;
} | null>(null);

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

const currentChat = computed(() => chatStore.currentChat);

const isSenderIdUser = (senderId: User | string): senderId is User => typeof senderId === 'object' && senderId !== null && 'id' in senderId;

const getMessageSenderId = (message: Message): string => (isSenderIdUser(message.senderId) ? message.senderId.id : message.senderId);

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

onMounted(() => {
  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', handleGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('keydown', handleGlobalKeyDown);
});

const isGroupChat = computed(() => currentChat.value?.type === 'group');

watch(currentChat, (newChat, oldChat) => {
  const chatIdChanged = !oldChat || !newChat || oldChat._id !== newChat._id;
  if (chatIdChanged) {
    showGroupSettings.value = false;
    showUserInfo.value = false;
    selectedUser.value = null;
    replyToMessage.value = null;
    editMessage.value = null;
  }
});

const scrollToBottom = (smooth = true): void => {
  messageListRef.value?.scrollToBottom(smooth);
};

defineExpose({ scrollToBottom });

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

const getChatName = (): string => resolveChatName(
  currentChat.value,
  chatStore.user?.id,
  isNewChat.value ? newChatUser.value : null,
);

const getAvatar = (): string | undefined => getChatAvatar(
  currentChat.value,
  chatStore.user?.id,
  isNewChat.value ? newChatUser.value : null,
);

const getOtherParticipant = (): User | null => {
  if (isNewChat.value && newChatUser.value) return newChatUser.value;
  return resolveOther(currentChat.value, chatStore.user?.id);
};

const getStatus = (): string => getChatStatusLabel(
  currentChat.value,
  chatStore.user?.id,
  isNewChat.value ? newChatUser.value : null,
);

const handleEditMessage = (message: Message): void => {
  replyToMessage.value = null;
  editMessage.value = message;
  nextTick(() => messageInputRef.value?.focusInput());
};

const handleReplyToMessage = (message: Message): void => {
  replyToMessage.value = message;
};

const handleOpenUser = (user: User): void => {
  selectedUser.value = user;
  showUserInfo.value = true;
};

const handleOpenMessage = (message: Message): void => {
  selectedMessage.value = message;
  showMessageView.value = true;
};

const clearEditMessage = (): void => {
  editMessage.value = null;
};

const handleStartEditLast = (): void => {
  if (!currentChat.value || !chatStore.user) return;
  const ownId = chatStore.user.id;
  const list = chatStore.messages;
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

const closeMessageView = (): void => {
  showMessageView.value = false;
  selectedMessage.value = null;
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

const clearReplyToMessage = (): void => {
  replyToMessage.value = null;
};
</script>

<template>
	<div class="chat-window">
		<ChatHeader
			v-if="currentChat"
			:is-mobile="isMobile"
			@back="handleBack"
			@avatar-click="handleHeaderAvatarClick"
			@title-click="handleHeaderTitleClick"
			@start-call="handleStartCall"
			@start-video="handleStartVideoCall"
			@start-group-call="handleStartGroupCall"
			@start-group-video="handleStartGroupVideoCall"
		/>

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

		<ChatCallOverlay />

		<ChatMessageList
			ref="messageListRef"
			:is-mobile="isMobile"
			@reply="handleReplyToMessage"
			@edit="handleEditMessage"
			@open-user="handleOpenUser"
			@open-message="handleOpenMessage"
			@selection-mode="selectionMode = $event"
		/>

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

}
</style>
