import { onMounted, onUnmounted } from 'vue';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import websocketService from '../services/websocket';
import { Message, Chat, User } from '../types';

export const useWebSocket = () => {
  const chatStore = useChatStore();
  const authStore = useAuthStore();

  const setupListeners = (): void => {
    websocketService.on('message:new', (message: Message) => {
      chatStore.addMessage(message);
    });

    websocketService.on('typing:update', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      chatStore.setTypingUser(data.chatId, data.userId, data.isTyping);
    });

    websocketService.on('user:status', (data: { userId: string; status: string; lastSeen?: string | Date }) => {
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
    });

    websocketService.on('message:read', (data: { messageId: string; userId: string }) => {
      chatStore.markMessageAsRead(data.messageId, data.userId);
    });

    websocketService.on('chat:created', (chat: Chat) => {
      chatStore.addChat(chat);
    });

    websocketService.on('chat:updated', (chat: Chat) => {
      chatStore.updateChat(chat);
    });

    websocketService.on('chat:deleted', (data: { chatId: string }) => {
      chatStore.removeChatFromList(data.chatId);
    });

    websocketService.on('user:updated', (user: User) => {
      // Обновляем данные пользователя в чатах
      chatStore.updateUserInChats(user);
      
      // Если это текущий пользователь, обновляем его данные в auth store
      if (authStore.user && authStore.user.id === user.id) {
        authStore.updateUser(user);
      }
    });
  };

  onMounted(() => {
    setupListeners();
  });

  onUnmounted(() => {
    websocketService.off('message:new', () => {});
    websocketService.off('typing:update', () => {});
    websocketService.off('user:status', () => {});
    websocketService.off('message:read', () => {});
    websocketService.off('chat:created', () => {});
    websocketService.off('chat:updated', () => {});
    websocketService.off('chat:deleted', () => {});
    websocketService.off('user:updated', () => {});
  });
};
