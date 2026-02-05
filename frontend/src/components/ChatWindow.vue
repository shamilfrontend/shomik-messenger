<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

import { useChatStore } from '../stores/chat.store';
import MessageInput from './MessageInput.vue';
import UserInfoModal from './UserInfoModal.vue';
import GroupSettingsModal from './GroupSettingsModal.vue';
import type { Message, User } from '../types';
import { getImageUrl } from '../utils/image';
import { isUserOnline, getComputedStatus } from '../utils/status';

const chatStore = useChatStore();
const messagesContainer = ref<HTMLElement | null>(null);
const showUserInfo = ref(false);
const selectedUser = ref<User | null>(null);
const showGroupSettings = ref(false);
const replyToMessage = ref<Message | null>(null);
const isMobile = ref(window.innerWidth <= 768);

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const currentChat = computed(() => chatStore.currentChat);
const messages = computed(() => chatStore.messages);
const typingUsers = computed(() => {
  if (!currentChat.value) return new Set();
  return chatStore.typingUsers.get(currentChat.value._id) || new Set();
});

watch(messages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

// Закрываем модальные окна при смене чата
watch(currentChat, () => {
  showGroupSettings.value = false;
  showUserInfo.value = false;
  selectedUser.value = null;
  replyToMessage.value = null;
});

const scrollToBottom = (): void => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const getChatName = (): string => {
  if (!currentChat.value) return '';
  if (currentChat.value.type === 'group') {
    return currentChat.value.groupName || 'Группа';
  }
  const otherParticipant = currentChat.value.participants.find(p =>
    typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id
  );
  return typeof otherParticipant === 'string' ? 'Пользователь' : (otherParticipant?.username || 'Пользователь');
};

const getAvatar = (): string | undefined => {
  if (!currentChat.value) return;
  if (currentChat.value.type === 'group') {
    return getImageUrl(currentChat.value.groupAvatar);
  }
  const otherParticipant = currentChat.value.participants.find(p =>
    typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id
  );
  return typeof otherParticipant === 'string' ? undefined : getImageUrl(otherParticipant?.avatar);
};

const getOtherParticipant = (): User | null => {
  if (!currentChat.value || currentChat.value.type === 'group') {
    return null;
  }
  const otherParticipant = currentChat.value.participants.find(p =>
    typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id
  );
  if (!otherParticipant || typeof otherParticipant === 'string') {
    return null;
  }
  return otherParticipant;
};

const getStatus = (): string => {
  if (!currentChat.value || currentChat.value.type === 'group') return '';
  const otherParticipant = currentChat.value.participants.find(p => 
    typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id
  );
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

const isOwnMessage = (message: Message): boolean => {
  const senderId = typeof message.senderId === 'string' 
    ? message.senderId 
    : message.senderId.id;
  return senderId === chatStore.user?.id;
};

const isUnreadMessage = (message: Message): boolean => {
  return chatStore.isMessageUnread(message);
};

const getMessageSender = (message: Message): string => {
  if (typeof message.senderId === 'string') {
    return 'Пользователь';
  }
  if (!message.senderId) {
    return 'Пользователь';
  }
  return message.senderId.username || 'Пользователь';
};

const getMessageAvatar = (message: Message): string | undefined => {
  if (typeof message.senderId === 'string') {
    return undefined;
  }
  if (!message.senderId) {
    return undefined;
  }
  return getImageUrl(message.senderId.avatar);
};

const shouldShowAvatar = (message: Message): boolean => {
  // В групповых чатах показываем аватар для всех сообщений
  if (currentChat.value?.type === 'group') {
    return true;
  }
  // В приватных чатах показываем аватар только для сообщений не от текущего пользователя
  return !isOwnMessage(message);
};

const shouldShowSender = (message: Message): boolean => {
  // В групповых чатах показываем имя отправителя для всех сообщений
  if (currentChat.value?.type === 'group') {
    return true;
  }
  // В приватных чатах имя отправителя не показываем
  return false;
};

const openUserInfo = (message: Message): void => {
  // Не открываем модальное окно для своих сообщений
  if (isOwnMessage(message)) {
    return;
  }

  // Получаем ID отправителя сообщения
  const senderId = typeof message.senderId === 'string' 
    ? message.senderId 
    : message.senderId.id;

  // Проверяем, что это не текущий пользователь
  if (senderId === chatStore.user?.id) {
    console.error('openUserInfo: попытка открыть информацию о себе');
    return;
  }

  // Получаем информацию о пользователе из сообщения
  if (typeof message.senderId === 'string') {
    // Если senderId - это строка, нужно найти пользователя в участниках чата
    const participant = currentChat.value?.participants.find(p => {
      const participantId = typeof p === 'string' ? p : p.id;
      return participantId === senderId && participantId !== chatStore.user?.id;
    });
    
    if (participant && typeof participant !== 'string') {
      selectedUser.value = participant;
      showUserInfo.value = true;
    } else {
      console.error('openUserInfo: участник не найден для senderId:', senderId);
    }
  } else {
    // Если senderId - это объект User
    // Проверяем, что это не текущий пользователь
    if (message.senderId.id !== chatStore.user?.id) {
      selectedUser.value = message.senderId;
      showUserInfo.value = true;
    } else {
      console.error('openUserInfo: попытка открыть информацию о себе');
    }
  }
};

const closeUserInfo = (): void => {
  showUserInfo.value = false;
  selectedUser.value = null;
};

const router = useRouter();

const handleSendMessage = async (userId: string): Promise<void> => {
  try {
    // Проверяем, что это не текущий пользователь
    if (!userId || userId === chatStore.user?.id) {
      console.error('Нельзя создать чат с самим собой. userId:', userId, 'currentUserId:', chatStore.user?.id);
      return;
    }

    // Создаем приватный чат с выбранным пользователем
    // Backend автоматически добавит текущего пользователя в участники
    const chat = await chatStore.createChat('private', [userId]);
    router.push(`/chat/${chat._id}`);
  } catch (error) {
    console.error('Ошибка создания чата:', error);
  }
};

const formatMessageTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const getTypingText = (): string => {
  const count = typingUsers.value.size;
  if (count === 0) return '';
  if (count === 1) return 'печатает...';
  return `${count} печатают...`;
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
    const otherParticipant = chat.participants.find(p => {
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
    const otherParticipants = chat.participants.filter(p => {
      const participantId = typeof p === 'string' ? p : p.id;
      return participantId !== chatStore.user?.id;
    });
    
    if (otherParticipants.length === 0) {
      return 'delivered'; // Сообщение доставлено (в группе всегда доставлено после отправки)
    }
    
    // Проверяем, прочитали ли все участники
    const allRead = otherParticipants.every(p => {
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

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const handleBack = (): void => {
  emit('back');
};

const handleGroupUpdated = (updatedChat: any): void => {
  chatStore.updateChat(updatedChat);
  showGroupSettings.value = false;
};

const handleGroupDeleted = (): void => {
  showGroupSettings.value = false;
  chatStore.setCurrentChat(null);
  router.push('/');
};

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
    const scrollTop = messagesContainer.value.scrollTop;
    const elementTop = elementRect.top - containerRect.top + scrollTop;
    
    // Скроллим к элементу с небольшим отступом сверху
    messagesContainer.value.scrollTo({
      top: elementTop - 20,
      behavior: 'smooth'
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
  if (typeof replyTo.senderId === 'string') {
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
  return replyTo.content || '';
};
</script>

<template>
	<div class="chat-window">
		<div v-if="currentChat" class="chat-window__header">
			<button 
				v-if="isMobile" 
				@click="handleBack" 
				class="chat-window__back-button"
				aria-label="Назад"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</button>
			<div class="chat-window__header-info">
				<div class="chat-window__avatar">
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
					></span>
				</div>
				<div class="chat-window__header-text">
					<h3>{{ getChatName() }}</h3>
					<span v-if="getStatus()" class="chat-window__status">{{ getStatus() }}</span>
				</div>
			</div>
			<button
				v-if="currentChat && currentChat.type === 'group'"
				@click="showGroupSettings = true"
				class="chat-window__settings-button"
				aria-label="Настройки группы"
				title="Настройки группы"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
					<circle cx="12" cy="12" r="3"></circle>
				</svg>
			</button>
		</div>

		<div v-else class="chat-window__empty">
			<p>Выберите чат для начала общения</p>
		</div>

		<div v-if="currentChat" class="chat-window__messages" ref="messagesContainer">
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
				<!-- Обычное сообщение -->
				<div 
					:id="`message-${message._id}`"
					:class="['chat-window__message-wrapper', {
						'chat-window__message-wrapper_me': isOwnMessage(message)
					}]"
					@dblclick="handleReplyToMessage(message)"
				>
					<div
						:class="['chat-window__message', { 
							'chat-window__message_me': isOwnMessage(message),
							'chat-window__message--unread': isUnreadMessage(message)
						}]"
					>
						<div 
							v-if="shouldShowAvatar(message)" 
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
								v-if="typeof message.senderId !== 'string' && message.senderId"
								:class="['chat-window__status-indicator', `chat-window__status-indicator--${getComputedStatus(message.senderId)}`]"
							></span>
						</div>
						<div class="chat-window__message-content">
							<div 
								v-if="shouldShowSender(message)" 
								class="chat-window__message-sender"
								@click="openUserInfo(message)"
							>
								{{ getMessageSender(message) }}
							</div>
							<div class="chat-window__message-bubble">
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
								<div v-if="message.type === 'image' && message.fileUrl" class="chat-window__message-image">
									<img :src="getImageUrl(message.fileUrl) || message.fileUrl" :alt="message.content" />
								</div>
								<div v-else-if="message.type === 'file' && message.fileUrl" class="chat-window__message-file">
									<a :href="getImageUrl(message.fileUrl) || message.fileUrl" target="_blank">{{ message.content }}</a>
								</div>
								<div v-else class="chat-window__message-text">{{ message.content }}</div>
								<div class="chat-window__message-footer">
									<div class="chat-window__message-time">
										{{ formatMessageTime(message.createdAt) }}
									</div>
									<div v-if="isOwnMessage(message)" class="chat-window__message-status" :class="`chat-window__message-status--${getReadStatus(message)}`">
										<!-- Одна галочка (отправлено) -->
										<svg v-if="getReadStatus(message) === 'sent'" width="16" height="16" viewBox="0 0 16 16" fill="none">
											<path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
										<!-- Две галочки (доставлено/прочитано) -->
										<svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
											<path d="M2 8L5 11L12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
											<path d="M6 8L9 11L16 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<div v-if="typingUsers.size > 0" class="chat-window__typing">
				<span>{{ getTypingText() }}</span>
			</div>
		</div>

		<MessageInput 
			v-if="currentChat" 
			:chat-id="currentChat._id"
			:reply-to="replyToMessage"
			@clear-reply="clearReplyToMessage"
		/>

		<UserInfoModal
			:is-open="showUserInfo"
			:user="selectedUser"
			@close="closeUserInfo"
			@send-message="handleSendMessage"
		/>

		<GroupSettingsModal
			v-if="currentChat && currentChat.type === 'group'"
			:is-open="showGroupSettings"
			:chat="currentChat"
			@close="showGroupSettings = false"
			@updated="handleGroupUpdated"
			@deleted="handleGroupDeleted"
		/>
	</div>
</template>

<style scoped lang="scss">
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);

  &__header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

  &__settings-button {
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

    &:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
    }
  }

  &__avatar {
    width: 40px;
    height: 40px;
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

    h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1rem;
    }
  }

  &__status {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  &__messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    @media (max-width: 768px) {
      padding: 0.75rem;
      gap: 0.5rem;
    }
  }

  &__message-wrapper {
    width: 100%;
    display: flex;
    padding: 0.25rem 1rem;
    cursor: pointer;
    justify-content: flex-start;
    transition: background 0.2s;

    @media (max-width: 768px) {
      padding: 0.25rem 0.75rem;
    }

    &_me {
      justify-content: flex-end;
    }

    &--highlighted {
      background: rgba(59, 130, 246, 0.15);
      animation: highlight-pulse 2s ease-out;
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
    align-items: flex-end;
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
      }

      .chat-window__message-footer {
        justify-content: flex-end;
      }

      .chat-window__message-time {
        text-align: right;
        color: rgba(255, 255, 255, 0.7);
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

      // В групповых чатах для своих сообщений тоже показываем аватар справа
      .chat-window__message-avatar {
        order: 1;
      }
    }

    &--unread {
      .chat-window__message-bubble {
        background: #ff3b30;
        color: white;
        border: 2px solid #ff3b30;
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
  }

  &__message-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__message-sender {
    color: var(--text-secondary);
    font-size: 0.75rem;
    padding-left: 0.5rem;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--accent-color);
      text-decoration: underline;
    }
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
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__message-bubble {
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    border-bottom-left-radius: 4px;
    color: var(--text-primary);
    position: relative;
    word-wrap: break-word;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  &__message-text {
    margin-bottom: 0.25rem;
  }

  &__message-image {
    margin-bottom: 0.25rem;

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
    justify-content: flex-start;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  &__message-time {
    font-size: 0.7rem;
    opacity: 0.7;
    text-align: left;
    flex-shrink: 0;
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
}
</style>
