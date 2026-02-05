import { onMounted, onUnmounted } from 'vue';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import websocketService from '../services/websocket';
import { Message, Chat, User } from '../types';

export const useWebSocket = () => {
  const chatStore = useChatStore();
  const authStore = useAuthStore();

  // Сохраняем ссылки на обработчики для правильной отписки
  const messageNewHandler = (message: Message) => {
    chatStore.addMessage(message);
  };

  const typingUpdateHandler = (data: { chatId: string; userId: string; isTyping: boolean }) => {
    chatStore.setTypingUser(data.chatId, data.userId, data.isTyping);
  };

  const userStatusHandler = (data: { userId: string; status: string; lastSeen?: string | Date }) => {
    chatStore.chats.forEach(chat => {
      const participant = chat.participants.find(p => 
        (typeof p === 'string' ? p : p.id) === data.userId
      );
      if (participant && typeof participant !== 'string') {
        participant.status = data.status as 'online' | 'offline' | 'away';
        if (data.lastSeen) {
          participant.lastSeen = data.lastSeen;
        }
      }
    });
    
    // Обновляем данные отправителя во всех сообщениях
    chatStore.messages.forEach(message => {
      if (typeof message.senderId !== 'string' && message.senderId && message.senderId.id === data.userId) {
        message.senderId.status = data.status as 'online' | 'offline' | 'away';
        if (data.lastSeen) {
          message.senderId.lastSeen = data.lastSeen;
        }
      }
    });
  };

  const messageReadHandler = (data: { messageId: string; userId: string }) => {
    chatStore.markMessageAsRead(data.messageId, data.userId);
  };

  const chatCreatedHandler = (chat: Chat) => {
    chatStore.addChat(chat);
  };

  const chatUpdatedHandler = (chat: Chat) => {
    chatStore.updateChat(chat);
  };

  const chatDeletedHandler = (data: { chatId: string }) => {
    chatStore.removeChatFromList(data.chatId);
  };

  const userUpdatedHandler = (user: User) => {
    // Обновляем данные пользователя в чатах
    chatStore.updateUserInChats(user);
    
    // Если это текущий пользователь, обновляем его данные в auth store
    if (authStore.user && authStore.user.id === user.id) {
      authStore.updateUser(user);
    }
  };

  const messageReactionHandler = (data: { messageId: string; reactions: { [emoji: string]: string[] } }) => {
    chatStore.updateMessageReactions(data.messageId, data.reactions);
  };

  onMounted(() => {
    websocketService.on('message:new', messageNewHandler);
    websocketService.on('typing:update', typingUpdateHandler);
    websocketService.on('user:status', userStatusHandler);
    websocketService.on('message:read', messageReadHandler);
    websocketService.on('chat:created', chatCreatedHandler);
    websocketService.on('chat:updated', chatUpdatedHandler);
    websocketService.on('chat:deleted', chatDeletedHandler);
    websocketService.on('user:updated', userUpdatedHandler);
    websocketService.on('message:reaction', messageReactionHandler);
  });

  onUnmounted(() => {
    websocketService.off('message:new', messageNewHandler);
    websocketService.off('typing:update', typingUpdateHandler);
    websocketService.off('user:status', userStatusHandler);
    websocketService.off('message:read', messageReadHandler);
    websocketService.off('chat:created', chatCreatedHandler);
    websocketService.off('chat:updated', chatUpdatedHandler);
    websocketService.off('chat:deleted', chatDeletedHandler);
    websocketService.off('user:updated', userUpdatedHandler);
    websocketService.off('message:reaction', messageReactionHandler);
  });
};
