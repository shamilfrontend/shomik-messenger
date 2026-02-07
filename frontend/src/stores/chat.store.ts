import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Chat, Message, User } from '../types';
import api from '../services/api';
import websocketService from '../services/websocket';
import { useAuthStore } from './auth.store';
import { playNotificationSound } from '../utils/sound';

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore();
  const chats = ref<Chat[]>([]);
  const currentChat = ref<Chat | null>(null);
  const messages = ref<Message[]>([]);
  const typingUsers = ref<Map<string, Set<string>>>(new Map());
  const unreadCounts = ref<Map<string, number>>(new Map());
  const loadingOlderMessages = ref(false);
  const hasMoreOlderMessages = ref(true);
  const MESSAGES_PAGE_SIZE = 50;

  const user = computed(() => authStore.user);

  const loadChats = async (): Promise<void> => {
    try {
      const response = await api.get('/chats');
      // Поддерживаем старый формат (массив чатов) и новый (объект с chats и activeGroupCalls)
      const responseData = response.data;
      if (Array.isArray(responseData)) {
        chats.value = responseData;
      } else {
        chats.value = responseData.chats || responseData;
        // Обрабатываем информацию об активных групповых звонках
        if (responseData.activeGroupCalls && Array.isArray(responseData.activeGroupCalls)) {
          // Используем динамический импорт, чтобы избежать циклических зависимостей
          const callStoreModule = await import('./call.store');
          const callStore = callStoreModule.useCallStore();
          responseData.activeGroupCalls.forEach((call: { chatId: string; participants: string[]; isVideo?: boolean }) => {
            callStore.setGroupCallStarted(call.chatId, call.participants, call.isVideo);
          });
        }
      }
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
      // Не добавляем чат здесь, он будет добавлен через WebSocket событие
      // Но если WebSocket не сработал, добавляем локально
      if (!chats.value.find(c => c._id === newChat._id)) {
        chats.value.unshift(newChat);
      }
      return newChat;
    } catch (error: any) {
      console.error('Ошибка создания чата:', error.response?.data || error.message);
      throw error;
    }
  };

  const addChat = (chat: Chat): void => {
    // Проверяем, нет ли уже такого чата
    if (!chats.value.find(c => c._id === chat._id)) {
      chats.value.unshift(chat);
      // Инициализируем счетчик непрочитанных
      unreadCounts.value.set(chat._id, 0);
    }
  };

  const loadMessages = async (chatId: string): Promise<void> => {
    try {
      hasMoreOlderMessages.value = true;
      const response = await api.get(`/chats/${chatId}/messages`, {
        params: { limit: MESSAGES_PAGE_SIZE }
      });
      if (currentChat.value?._id !== chatId) return;
      const list = (response.data as Message[]).map((msg: Message) => ({
        ...msg,
        reactions: msg.reactions || {}
      }));
      messages.value = list;
      if (list.length < MESSAGES_PAGE_SIZE) {
        hasMoreOlderMessages.value = false;
      }
      markChatAsRead(chatId);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const loadOlderMessages = async (chatId: string): Promise<boolean> => {
    if (loadingOlderMessages.value || !hasMoreOlderMessages.value || currentChat.value?._id !== chatId) {
      return false;
    }
    const oldest = messages.value[0];
    if (!oldest?.createdAt) return false;
    const before = typeof oldest.createdAt === 'string' ? oldest.createdAt : oldest.createdAt.toISOString();
    loadingOlderMessages.value = true;
    try {
      const response = await api.get(`/chats/${chatId}/messages`, {
        params: { limit: MESSAGES_PAGE_SIZE, before }
      });
      if (currentChat.value?._id !== chatId) return false;
      const list = (response.data as Message[]).map((msg: Message) => ({
        ...msg,
        reactions: msg.reactions || {}
      }));
      if (list.length < MESSAGES_PAGE_SIZE) {
        hasMoreOlderMessages.value = false;
      }
      messages.value = [...list, ...messages.value];
      return true;
    } catch (error) {
      console.error('Ошибка загрузки старых сообщений:', error);
      return false;
    } finally {
      loadingOlderMessages.value = false;
    }
  };

  const sendMessage = async (chatId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string, replyTo?: string): Promise<void> => {
    websocketService.send('message:send', { chatId, content, type, fileUrl, replyTo });
  };

  const setCurrentChat = (chat: Chat | null): void => {
    currentChat.value = chat;
    hasMoreOlderMessages.value = true;
    messages.value = [];
    if (chat) {
      loadMessages(chat._id);
    }
  };

  const addMessage = (message: Message): void => {
    const senderId = typeof message.senderId === 'string' 
      ? message.senderId 
      : message.senderId.id;
    
    const isFromCurrentUser = senderId === user.value?.id;
    const isCurrentChatOpen = currentChat.value && message.chatId === currentChat.value._id;
    const isSystemMessage = message.type === 'system';
    
    // Проверяем, нет ли уже такого сообщения в массиве
    const messageExists = messages.value.some(msg => msg._id === message._id);
    if (messageExists) {
      return; // Сообщение уже существует, не добавляем дубликат
    }
    
    // Воспроизводим звук только для обычных сообщений не от текущего пользователя
    if (!isFromCurrentUser && !isSystemMessage) {
      // Воспроизводим звук всегда для входящих сообщений
      try {
        playNotificationSound();
      } catch (error) {
        console.error('Ошибка воспроизведения звука:', error);
      }
    }
    
    if (isCurrentChatOpen) {
      // Инициализируем реакции если их нет
      const messageWithReactions = {
        ...message,
        reactions: message.reactions || {}
      };
      messages.value.push(messageWithReactions);
      // Если сообщение не от текущего пользователя, помечаем как прочитанное автоматически
      if (!isFromCurrentUser) {
        markAsRead(message._id);
      }
    } else {
      // Если чат не открыт, увеличиваем счетчик непрочитанных
      if (!isFromCurrentUser) {
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

  const totalUnreadCount = computed(() => {
    let total = 0;
    unreadCounts.value.forEach((count) => {
      total += count;
    });
    return total;
  });

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

  const toggleReaction = async (chatId: string, messageId: string, emoji: string): Promise<void> => {
    try {
      const response = await api.post(`/chats/${chatId}/messages/${messageId}/reactions`, { emoji });
      // Сразу обновляем локальное состояние для мгновенного отображения
      if (response.data?.reactions) {
        updateMessageReactions(messageId, response.data.reactions);
      }
    } catch (error: any) {
      console.error('Ошибка добавления реакции:', error.response?.data?.error || error.message);
      throw error;
    }
  };

  const deleteMessage = async (chatId: string, messageId: string): Promise<void> => {
    try {
      await api.delete(`/chats/${chatId}/messages/${messageId}`);
      removeMessage(messageId);
    } catch (error: any) {
      console.error('Ошибка удаления сообщения:', error.response?.data?.error || error.message);
      throw error;
    }
  };

  const editMessage = async (chatId: string, messageId: string, content: string): Promise<void> => {
    try {
      const response = await api.patch(`/chats/${chatId}/messages/${messageId}`, { content: content.trim() });
      updateMessageContent(messageId, response.data);
    } catch (error: any) {
      console.error('Ошибка редактирования сообщения:', error.response?.data?.error || error.message);
      throw error;
    }
  };

  const updateMessageContent = (messageId: string, updated: Partial<Message>): void => {
    const index = messages.value.findIndex(msg => msg._id === messageId);
    if (index !== -1) {
      const msg = messages.value[index];
      if (updated.content !== undefined) msg.content = updated.content;
      if (updated.updatedAt !== undefined) msg.updatedAt = updated.updatedAt;
      if (updated.reactions !== undefined) msg.reactions = updated.reactions || {};
    }
    chats.value.forEach(chat => {
      if (chat.lastMessage && chat.lastMessage._id === messageId && updated.content !== undefined) {
        chat.lastMessage.content = updated.content;
        if (updated.updatedAt !== undefined) chat.lastMessage.updatedAt = updated.updatedAt;
      }
    });
  };

  const removeMessage = (messageId: string): void => {
    // Удаляем сообщение из списка сообщений
    const index = messages.value.findIndex(msg => msg._id === messageId);
    if (index !== -1) {
      messages.value.splice(index, 1);
    }
    
    // Если это было последнее сообщение, обновляем lastMessage в чатах
    chats.value.forEach(chat => {
      if (chat.lastMessage && chat.lastMessage._id === messageId) {
        // Находим новое последнее сообщение в текущем чате
        const chatMessages = messages.value.filter(msg => msg.chatId === chat._id);
        if (chatMessages.length > 0) {
          const lastMsg = chatMessages[chatMessages.length - 1];
          chat.lastMessage = {
            _id: lastMsg._id,
            content: lastMsg.content,
            senderId: lastMsg.senderId,
            type: lastMsg.type,
            createdAt: lastMsg.createdAt,
            readBy: lastMsg.readBy,
            reactions: lastMsg.reactions || {}
          };
        } else {
          chat.lastMessage = undefined;
        }
      }
    });
  };

  const updateMessageReactions = (messageId: string, reactions: { [emoji: string]: string[] }): void => {
    const messageIndex = messages.value.findIndex(msg => msg._id === messageId);
    if (messageIndex !== -1) {
      // Прямо обновляем свойство reactions для правильной реактивности Vue 3
      const message = messages.value[messageIndex];
      if (message) {
        message.reactions = reactions || {};
      }
    }
    // Также обновляем реакции в lastMessage чатов, если сообщение является последним
    chats.value.forEach(chat => {
      if (chat.lastMessage && chat.lastMessage._id === messageId) {
        chat.lastMessage.reactions = reactions || {};
      }
    });
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

  const updateGroupName = async (chatId: string, groupName: string): Promise<Chat> => {
    try {
      const response = await api.patch(`/chats/${chatId}/name`, { groupName });
      const updatedChat = response.data;
      // Обновляем чат в списке
      const index = chats.value.findIndex(c => c._id === chatId);
      if (index !== -1) {
        chats.value[index] = updatedChat;
      }
      // Обновляем текущий чат если он открыт
      if (currentChat.value && currentChat.value._id === chatId) {
        currentChat.value = updatedChat;
      }
      return updatedChat;
    } catch (error: any) {
      console.error('Ошибка обновления названия группы:', error.response?.data || error.message);
      throw error;
    }
  };

  const updateGroupAvatar = async (chatId: string, groupAvatar: string): Promise<Chat> => {
    try {
      const response = await api.patch(`/chats/${chatId}/avatar`, { groupAvatar });
      const updatedChat = response.data;
      // Обновляем чат в списке
      const index = chats.value.findIndex(c => c._id === chatId);
      if (index !== -1) {
        chats.value[index] = updatedChat;
      }
      // Обновляем текущий чат если он открыт
      if (currentChat.value && currentChat.value._id === chatId) {
        currentChat.value = updatedChat;
      }
      return updatedChat;
    } catch (error: any) {
      console.error('Ошибка обновления аватара группы:', error.response?.data || error.message);
      throw error;
    }
  };

  const addParticipants = async (chatId: string, participantIds: string[]): Promise<Chat> => {
    try {
      const response = await api.post(`/chats/${chatId}/participants`, { participantIds });
      const updatedChat = response.data;
      // Обновляем чат в списке
      const index = chats.value.findIndex(c => c._id === chatId);
      if (index !== -1) {
        chats.value[index] = updatedChat;
      }
      // Обновляем текущий чат если он открыт
      if (currentChat.value && currentChat.value._id === chatId) {
        currentChat.value = updatedChat;
      }
      return updatedChat;
    } catch (error: any) {
      console.error('Ошибка добавления участников:', error.response?.data || error.message);
      throw error;
    }
  };

  const removeParticipants = async (chatId: string, participantIds: string[]): Promise<Chat> => {
    try {
      const response = await api.delete(`/chats/${chatId}/participants`, { data: { participantIds } });
      const updatedChat = response.data;
      // Обновляем чат в списке
      const index = chats.value.findIndex(c => c._id === chatId);
      if (index !== -1) {
        chats.value[index] = updatedChat;
      }
      // Обновляем текущий чат если он открыт
      if (currentChat.value && currentChat.value._id === chatId) {
        currentChat.value = updatedChat;
      }
      return updatedChat;
    } catch (error: any) {
      console.error('Ошибка удаления участников:', error.response?.data || error.message);
      throw error;
    }
  };

  const leaveGroup = async (chatId: string): Promise<void> => {
    try {
      await api.post(`/chats/${chatId}/leave`);
    } catch (error: any) {
      console.error('Ошибка выхода из группы:', error.response?.data || error.message);
      throw error;
    }
    // Удаляем чат из списка
    removeChatFromList(chatId);
  };

  const deleteChat = async (chatId: string): Promise<void> => {
    try {
      await api.delete(`/chats/${chatId}`);
    } catch (error: any) {
      console.error('Ошибка удаления группы:', error.response?.data || error.message);
      throw error;
    }
    // Удаляем чат из списка
    removeChatFromList(chatId);
  };

  const removeChatFromList = (chatId: string): void => {
    chats.value = chats.value.filter(c => c._id !== chatId);
    // Если удаленный чат был открыт, закрываем его
    if (currentChat.value && currentChat.value._id === chatId) {
      setCurrentChat(null);
    }
  };

  const updateUserInChats = (updatedUser: User): void => {
    // Обновляем данные пользователя во всех чатах
    chats.value.forEach(chat => {
      // Обновляем участников чата
      chat.participants = chat.participants.map(participant => {
        if (typeof participant === 'string') {
          return participant === updatedUser.id ? updatedUser : participant;
        } else {
          return participant.id === updatedUser.id ? updatedUser : participant;
        }
      });

      // Обновляем админа группы если это он
      if (chat.admin) {
        if (typeof chat.admin === 'string') {
          if (chat.admin === updatedUser.id) {
            chat.admin = updatedUser;
          }
        } else {
          if (chat.admin.id === updatedUser.id) {
            chat.admin = updatedUser;
          }
        }
      }

      // Обновляем отправителей сообщений
      messages.value.forEach(message => {
        // Обновляем senderId сообщения
        if (typeof message.senderId === 'string') {
          if (message.senderId === updatedUser.id) {
            message.senderId = updatedUser;
          }
        } else {
          if (message.senderId && message.senderId.id === updatedUser.id) {
            message.senderId = updatedUser;
          }
        }
        
        // Обновляем senderId в replyTo если есть
        if (message.replyTo && typeof message.replyTo !== 'string') {
          if (message.replyTo.senderId) {
            if (typeof message.replyTo.senderId === 'string') {
              if (message.replyTo.senderId === updatedUser.id) {
                message.replyTo.senderId = updatedUser;
              }
            } else {
              if (message.replyTo.senderId.id === updatedUser.id) {
                message.replyTo.senderId = updatedUser;
              }
            }
          }
        }
      });
    });

    // Обновляем текущий чат если он открыт
    if (currentChat.value) {
      currentChat.value.participants = currentChat.value.participants.map(participant => {
        if (typeof participant === 'string') {
          return participant === updatedUser.id ? updatedUser : participant;
        } else {
          return participant.id === updatedUser.id ? updatedUser : participant;
        }
      });

      if (currentChat.value.admin) {
        if (typeof currentChat.value.admin === 'string') {
          if (currentChat.value.admin === updatedUser.id) {
            currentChat.value.admin = updatedUser;
          }
        } else {
          if (currentChat.value.admin.id === updatedUser.id) {
            currentChat.value.admin = updatedUser;
          }
        }
      }
    }
  };

  const updateChat = (updatedChat: Chat): void => {
    // Проверяем и нормализуем lastMessage.senderId если он есть
    if (updatedChat.lastMessage && updatedChat.lastMessage.senderId) {
      // Если senderId это объект без username, пытаемся найти его в участниках чата
      if (typeof updatedChat.lastMessage.senderId === 'object' && !updatedChat.lastMessage.senderId.username) {
        const senderId = updatedChat.lastMessage.senderId.id || updatedChat.lastMessage.senderId._id;
        if (senderId) {
          const participant = updatedChat.participants.find(p => {
            const pId = typeof p === 'string' ? p : p.id;
            return pId === senderId;
          });
          if (participant && typeof participant !== 'string') {
            updatedChat.lastMessage.senderId = {
              ...updatedChat.lastMessage.senderId,
              username: participant.username || 'Пользователь',
              avatar: participant.avatar,
              status: participant.status,
              lastSeen: participant.lastSeen
            };
          }
        }
      }
    }
    
    // Обновляем чат в списке
    const index = chats.value.findIndex(c => c._id === updatedChat._id);
    if (index !== -1) {
      chats.value[index] = updatedChat;
    } else {
      // Если чата нет в списке (например, для новых участников), добавляем его
      chats.value.unshift(updatedChat);
      // Инициализируем счетчик непрочитанных
      unreadCounts.value.set(updatedChat._id, 0);
    }
    // Обновляем текущий чат если он открыт
    if (currentChat.value && currentChat.value._id === updatedChat._id) {
      currentChat.value = updatedChat;
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
    addChat,
    updateChat,
    loadMessages,
    loadOlderMessages,
    loadingOlderMessages,
    hasMoreOlderMessages,
    sendMessage,
    setCurrentChat,
    addMessage,
    markAsRead,
    markChatAsRead,
    markMessageAsRead,
    getUnreadCount,
    totalUnreadCount,
    isMessageUnread,
    startTyping,
    stopTyping,
    setTypingUser,
    updateGroupName,
    updateGroupAvatar,
    addParticipants,
    removeParticipants,
    leaveGroup,
    deleteChat,
    removeChatFromList,
    updateUserInChats,
    toggleReaction,
    updateMessageReactions,
    deleteMessage,
    editMessage,
    updateMessageContent,
    removeMessage
  };
});
