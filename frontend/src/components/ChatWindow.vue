<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';

import { useChatStore } from '../stores/chat.store';
import MessageInput from './MessageInput.vue';
import UserInfoModal from './UserInfoModal.vue';
import type { Message, User } from '../types';

const chatStore = useChatStore();
const messagesContainer = ref<HTMLElement | null>(null);
const showUserInfo = ref(false);
const selectedUser = ref<User | null>(null);

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
    return currentChat.value.groupAvatar;
  }
  const otherParticipant = currentChat.value.participants.find(p =>
    typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id
  );
  return typeof otherParticipant === 'string' ? undefined : otherParticipant?.avatar;
};

const getStatus = (): string => {
  if (!currentChat.value || currentChat.value.type === 'group') return '';
  const otherParticipant = currentChat.value.participants.find(p => 
    typeof p === 'string' ? p !== chatStore.user?.id : p.id !== chatStore.user?.id
  );
  if (typeof otherParticipant === 'string') return '';
  return otherParticipant?.status === 'online' ? 'в сети' : 'не в сети';
};

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
  return message.senderId.username;
};

const getMessageAvatar = (message: Message): string | undefined => {
  if (typeof message.senderId === 'string') {
    return undefined;
  }
  return message.senderId.avatar;
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
</script>

<template>
	<div class="chat-window">
		<div v-if="currentChat" class="chat-window__header">
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
				</div>
				<div class="chat-window__header-text">
					<h3>{{ getChatName() }}</h3>
					<span v-if="getStatus()" class="chat-window__status">{{ getStatus() }}</span>
				</div>
			</div>
		</div>

		<div v-else class="chat-window__empty">
			<p>Выберите чат для начала общения</p>
		</div>

		<div v-if="currentChat" class="chat-window__messages" ref="messagesContainer">
			<div
				v-for="message in messages"
				:key="message._id"
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
						<div v-if="message.type === 'image' && message.fileUrl" class="chat-window__message-image">
							<img :src="message.fileUrl" :alt="message.content" />
						</div>
						<div v-else-if="message.type === 'file' && message.fileUrl" class="chat-window__message-file">
							<a :href="message.fileUrl" target="_blank">{{ message.content }}</a>
						</div>
						<div v-else class="chat-window__message-text">{{ message.content }}</div>
						<div class="chat-window__message-time">
							{{ formatMessageTime(message.createdAt) }}
						</div>
					</div>
				</div>
			</div>

			<div v-if="typingUsers.size > 0" class="chat-window__typing">
				<span>{{ getTypingText() }}</span>
			</div>
		</div>

		<MessageInput v-if="currentChat" :chat-id="currentChat._id" />

		<UserInfoModal
			:is-open="showUserInfo"
			:user="selectedUser"
			@close="closeUserInfo"
			@send-message="handleSendMessage"
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
  }

  &__header-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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
  }

  &__message {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    max-width: 70%;
    align-self: flex-start;

    &_me {
      align-self: flex-end;
      flex-direction: row-reverse;

      .chat-window__message-bubble {
        background: var(--accent-color);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .chat-window__message-time {
        text-align: right;
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

  &__message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.1);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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

  &__message-time {
    font-size: 0.7rem;
    opacity: 0.7;
    text-align: left;
    margin-top: 0.25rem;
  }

  &__typing {
    padding: 0.5rem 1rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-style: italic;
  }
}
</style>
