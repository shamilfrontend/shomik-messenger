import { onMounted, onUnmounted } from 'vue';
import { useChatStore } from '../stores/chat.store';
import websocketService from '../services/websocket';
import { Message } from '../types';

export const useWebSocket = () => {
  const chatStore = useChatStore();

  const setupListeners = (): void => {
    websocketService.on('message:new', (message: Message) => {
      chatStore.addMessage(message);
    });

    websocketService.on('typing:update', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      chatStore.setTypingUser(data.chatId, data.userId, data.isTyping);
    });

    websocketService.on('user:status', (data: { userId: string; status: string }) => {
      chatStore.chats.forEach(chat => {
        const participant = chat.participants.find(p => 
          (typeof p === 'string' ? p : p.id) === data.userId
        );
        if (participant && typeof participant !== 'string') {
          participant.status = data.status as 'online' | 'offline' | 'away';
        }
      });
    });

    websocketService.on('message:read', (data: { messageId: string; userId: string }) => {
      chatStore.markMessageAsRead(data.messageId, data.userId);
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
  });
};
