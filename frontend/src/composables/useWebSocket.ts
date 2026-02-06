import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useCallStore } from '../stores/call.store';
import { useNotifications } from './useNotifications';
import websocketService from '../services/websocket';
import { Message, Chat, User } from '../types';

export const useWebSocket = () => {
  const router = useRouter();
  const chatStore = useChatStore();
  const authStore = useAuthStore();
  const callStore = useCallStore();
  const { success: notifySuccess } = useNotifications();

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

  const chatRemovedFromGroupHandler = (data: { chatId: string; groupName: string }) => {
    const wasViewingThisChat = chatStore.currentChat?._id === data.chatId;
    chatStore.removeChatFromList(data.chatId);
    if (wasViewingThisChat) {
      router.push('/');
      notifySuccess(`Вас исключили из группы «${data.groupName}»`);
    }
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

  const messageDeletedHandler = (data: { chatId: string; messageId: string }) => {
    chatStore.removeMessage(data.messageId);
  };

  const messageEditedHandler = (data: { chatId: string; message: Message }) => {
    chatStore.updateMessageContent(data.message._id, {
      content: data.message.content,
      updatedAt: data.message.updatedAt,
      reactions: data.message.reactions
    });
  };

  const callIncomingHandler = (data: { fromUserId: string; chatId: string; isVideo?: boolean; caller: { id: string; username: string; avatar?: string } | null }) => {
    callStore.setIncomingCall(data);
  };

  const callAcceptedHandler = (data: { chatId: string; acceptedByUserId: string }) => {
    callStore.onCallAccepted(data.chatId, data.acceptedByUserId);
  };

  const callRejectedHandler = () => {
    callStore.setCallEnded();
  };

  const callEndedHandler = () => {
    callStore.setCallEnded();
  };

  const callSignalHandler = (data: { fromUserId: string; signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit } }) => {
    callStore.handleRemoteSignal(data.fromUserId, data.signal);
  };

  const callUnavailableHandler = () => {
    callStore.setCallEnded();
  };

  const callStartedHandler = (data: { chatId: string; participants: string[]; isVideo?: boolean }) => {
    callStore.setGroupCallStarted(data.chatId, data.participants, data.isVideo);
  };

  const callJoinedHandler = (data: { chatId: string; participants: string[]; initiatorId?: string; isVideo?: boolean }) => {
    callStore.onCallJoinedGroup(data.chatId, data.participants, data.initiatorId, data.isVideo);
  };

  const callParticipantJoinedHandler = (data: { chatId: string; userId: string }) => {
    callStore.onParticipantJoined(data.chatId, data.userId);
  };

  const callParticipantLeftHandler = (data: { chatId: string; userId: string }) => {
    callStore.onParticipantLeft(data.chatId, data.userId);
  };

  onMounted(() => {
    websocketService.on('message:new', messageNewHandler);
    websocketService.on('typing:update', typingUpdateHandler);
    websocketService.on('user:status', userStatusHandler);
    websocketService.on('message:read', messageReadHandler);
    websocketService.on('chat:created', chatCreatedHandler);
    websocketService.on('chat:updated', chatUpdatedHandler);
    websocketService.on('chat:deleted', chatDeletedHandler);
    websocketService.on('chat:removed-from-group', chatRemovedFromGroupHandler);
    websocketService.on('user:updated', userUpdatedHandler);
    websocketService.on('message:reaction', messageReactionHandler);
    websocketService.on('message:deleted', messageDeletedHandler);
    websocketService.on('message:edited', messageEditedHandler);
    websocketService.on('call:incoming', callIncomingHandler);
    websocketService.on('call:accepted', callAcceptedHandler);
    websocketService.on('call:rejected', callRejectedHandler);
    websocketService.on('call:ended', callEndedHandler);
    websocketService.on('call:signal', callSignalHandler);
    websocketService.on('call:unavailable', callUnavailableHandler);
    websocketService.on('call:started', callStartedHandler);
    websocketService.on('call:joined', callJoinedHandler);
    websocketService.on('call:participant_joined', callParticipantJoinedHandler);
    websocketService.on('call:participant_left', callParticipantLeftHandler);
  });

  onUnmounted(() => {
    websocketService.off('message:new', messageNewHandler);
    websocketService.off('typing:update', typingUpdateHandler);
    websocketService.off('user:status', userStatusHandler);
    websocketService.off('message:read', messageReadHandler);
    websocketService.off('chat:created', chatCreatedHandler);
    websocketService.off('chat:updated', chatUpdatedHandler);
    websocketService.off('chat:deleted', chatDeletedHandler);
    websocketService.off('chat:removed-from-group', chatRemovedFromGroupHandler);
    websocketService.off('user:updated', userUpdatedHandler);
    websocketService.off('message:reaction', messageReactionHandler);
    websocketService.off('message:deleted', messageDeletedHandler);
    websocketService.off('message:edited', messageEditedHandler);
    websocketService.off('call:incoming', callIncomingHandler);
    websocketService.off('call:accepted', callAcceptedHandler);
    websocketService.off('call:rejected', callRejectedHandler);
    websocketService.off('call:ended', callEndedHandler);
    websocketService.off('call:signal', callSignalHandler);
    websocketService.off('call:unavailable', callUnavailableHandler);
    websocketService.off('call:started', callStartedHandler);
    websocketService.off('call:joined', callJoinedHandler);
    websocketService.off('call:participant_joined', callParticipantJoinedHandler);
    websocketService.off('call:participant_left', callParticipantLeftHandler);
  });
};
