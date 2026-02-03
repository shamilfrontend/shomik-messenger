import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Chat, Message, User } from '../types';
import api from '../services/api';
import websocketService from '../services/websocket';
import { useAuthStore } from './auth.store';

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore();
  const chats = ref<Chat[]>([]);
  const currentChat = ref<Chat | null>(null);
  const messages = ref<Message[]>([]);
  const typingUsers = ref<Map<string, Set<string>>>(new Map());
  const unreadCounts = ref<Map<string, number>>(new Map());

  const user = computed(() => authStore.user);

  const loadChats = async (): Promise<void> => {
    try {
      const response = await api.get('/chats');
      chats.value = response.data;
      // Подсчитываем непрочитанные сообщения для каждого чата на основе lastMessage
      chats.value.forEach(chat => {
        if (chat.lastMessage && user.value) {
          const senderId = typeof chat.lastMessage.senderId === 'string' 
            ? chat.lastMessage.senderId 
            : chat.lastMessage.senderId.id;
          const isUnread = senderId !== user.value.id && !chat.lastMessage.readBy.includes(user.value.id);
          if (isUnread) {
            // Устанавливаем счетчик на 1 для непрочитанного чата
            unreadCounts.value.set(chat._id, 1);
          } else {
            unreadCounts.value.set(chat._id, 0);
          }
        }
      });
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    }
  };

  const createChat = async (
      type: 'private' | 'group',
      participantIds: string[],
      groupName?: string
  ): Promise<Chat> => {
    console.log('4 type', type);
    console.log('5 participantIds', participantIds);
    console.log('6 groupName', groupName);
    console.log('Создание чата:', { type, participantIds, groupName });
    // debugger;

    try {
      const response = await api.post('/chats', { type, participantIds, groupName });
      const newChat = response.data;
      chats.value.unshift(newChat);
      return newChat;
    } catch (error: any) {
      console.error('Ошибка создания чата:', error.response?.data || error.message);
      throw error;
    }
  };

  const loadMessages = async (chatId: string): Promise<void> => {
    try {
      const response = await api.get(`/chats/${chatId}/messages`);
      messages.value = response.data;
      // Помечаем все сообщения как прочитанные при открытии чата
      markChatAsRead(chatId);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const sendMessage = async (chatId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string): Promise<void> => {
    websocketService.send('message:send', { chatId, content, type, fileUrl });
  };

  const setCurrentChat = (chat: Chat | null): void => {
    currentChat.value = chat;
    if (chat) {
      loadMessages(chat._id);
    } else {
      messages.value = [];
    }
  };

  const addMessage = (message: Message): void => {
    if (currentChat.value && message.chatId === currentChat.value._id) {
      messages.value.push(message);
      // Если сообщение не от текущего пользователя, помечаем как прочитанное автоматически
      const senderId = typeof message.senderId === 'string' 
        ? message.senderId 
        : message.senderId.id;
      if (senderId !== user.value?.id) {
        markAsRead(message._id);
      }
    } else {
      // Если чат не открыт, увеличиваем счетчик непрочитанных
      const senderId = typeof message.senderId === 'string' 
        ? message.senderId 
        : message.senderId.id;
      if (senderId !== user.value?.id) {
        const currentCount = unreadCounts.value.get(message.chatId) || 0;
        unreadCounts.value.set(message.chatId, currentCount + 1);
      }
    }

    const chat = chats.value.find(c => c._id === message.chatId);
    if (chat) {
      chat.lastMessage = message;
      chats.value = chats.value.filter(c => c._id !== chat._id);
      chats.value.unshift(chat);
    }
  };

  const markAsRead = (messageId: string): void => {
    websocketService.send('message:read', { messageId });
  };

  const markChatAsRead = (chatId: string): void => {
    // Помечаем все непрочитанные сообщения как прочитанные
    const unreadMessages = messages.value.filter(msg => {
      const senderId = typeof msg.senderId === 'string' 
        ? msg.senderId 
        : msg.senderId.id;
      return senderId !== user.value?.id && !msg.readBy.includes(user.value?.id || '');
    });

    unreadMessages.forEach(msg => {
      markAsRead(msg._id);
      // Добавляем текущего пользователя в readBy
      if (!msg.readBy.includes(user.value?.id || '')) {
        msg.readBy.push(user.value?.id || '');
      }
    });

    // Сбрасываем счетчик непрочитанных для этого чата
    unreadCounts.value.set(chatId, 0);
  };

  const markMessageAsRead = (messageId: string, userId: string): void => {
    // Обновляем статус прочитанности сообщения
    const message = messages.value.find(m => m._id === messageId);
    if (message && !message.readBy.includes(userId)) {
      message.readBy.push(userId);
    }

    // Если это сообщение из текущего чата и от другого пользователя, уменьшаем счетчик
    if (currentChat.value && message && message.chatId === currentChat.value._id) {
      const senderId = typeof message.senderId === 'string' 
        ? message.senderId 
        : message.senderId.id;
      if (senderId !== user.value?.id) {
        const currentCount = unreadCounts.value.get(message.chatId) || 0;
        if (currentCount > 0) {
          unreadCounts.value.set(message.chatId, currentCount - 1);
        }
      }
    }
  };

  const getUnreadCount = (chatId: string): number => {
    return unreadCounts.value.get(chatId) || 0;
  };

  const isMessageUnread = (message: Message): boolean => {
    if (!user.value) return false;
    const senderId = typeof message.senderId === 'string' 
      ? message.senderId 
      : message.senderId.id;
    // Сообщение непрочитанное, если оно не от текущего пользователя и не в списке readBy
    return senderId !== user.value.id && !message.readBy.includes(user.value.id);
  };

  const startTyping = (chatId: string): void => {
    websocketService.send('typing:start', { chatId });
  };

  const stopTyping = (chatId: string): void => {
    websocketService.send('typing:stop', { chatId });
  };

  const setTypingUser = (chatId: string, userId: string, isTyping: boolean): void => {
    if (!typingUsers.value.has(chatId)) {
      typingUsers.value.set(chatId, new Set());
    }
    const users = typingUsers.value.get(chatId)!;
    if (isTyping) {
      users.add(userId);
    } else {
      users.delete(userId);
    }
  };

  return {
    chats,
    currentChat,
    messages,
    typingUsers,
    unreadCounts,
    user,
    loadChats,
    createChat,
    loadMessages,
    sendMessage,
    setCurrentChat,
    addMessage,
    markAsRead,
    markChatAsRead,
    markMessageAsRead,
    getUnreadCount,
    isMessageUnread,
    startTyping,
    stopTyping,
    setTypingUser
  };
});
