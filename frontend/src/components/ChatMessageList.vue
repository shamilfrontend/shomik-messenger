<script setup lang="ts">
import {
  computed, watch, ref, nextTick, onMounted, onUnmounted,
} from 'vue';

import { useChatStore } from '../stores/chat.store';
import ContextMenu from './ContextMenu.vue';
import ChatMessageItem from './ChatMessageItem.vue';
import PinnedMessageBar from './PinnedMessageBar.vue';
import MessageSelectionBar from './MessageSelectionBar.vue';
import { Message, User } from '../types';
import { useNotifications } from '../composables/useNotifications';
import { useConfirm } from '../composables/useConfirm';
import {
  canDeleteMessage,
  canEditMessage,
  getReactionUsers,
  isOwnMessage,
} from '../utils/messageDisplay';
import { participantId } from '../utils/chatDisplay';

const props = defineProps<{
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'reply', message: Message): void;
  (e: 'edit', message: Message): void;
  (e: 'open-user', user: User): void;
  (e: 'open-message', message: Message): void;
  (e: 'selection-mode', value: boolean): void;
}>();

const chatStore = useChatStore();
const { success: notifySuccess, error: notifyError } = useNotifications();

const messagesContainer = ref<HTMLElement | null>(null);
const showReactionMenu = ref<string | null>(null);
const reactionMenuPosition = ref<'above' | 'below'>('below');
const contextMenuVisible = ref(false);
const selectionMode = ref(false);
const selectedMessageIds = ref<Set<string>>(new Set());
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuMessage = ref<Message | null>(null);

const clearReactionMenuStyles = (): void => {
  const menuEl = messagesContainer.value?.querySelector('.chat-window__reaction-menu--visible') as HTMLElement | null;
  if (menuEl) {
    menuEl.style.top = '';
    menuEl.style.bottom = '';
    menuEl.style.left = '';
  }
};

const handleClickOutside = (event: MouseEvent): void => {
  const target = event.target as HTMLElement;
  if (props.isMobile) {
    if (!target.closest('.chat-window__reaction-menu') && !target.closest('.chat-window__message-wrapper')) {
      clearReactionMenuStyles();
      showReactionMenu.value = null;
    }
  }
};

const currentChat = computed(() => chatStore.currentChat);
const messages = computed(() => chatStore.messages);
const typingUsers = computed(() => {
  if (!currentChat.value) return new Set<string>();
  return chatStore.typingUsers.get(currentChat.value._id) || new Set<string>();
});
const currentUserId = computed(() => chatStore.user?.id);

watch(currentChat, (newChat, oldChat) => {
  const chatIdChanged = !oldChat || !newChat || oldChat._id !== newChat._id;
  if (chatIdChanged) {
    showReactionMenu.value = null;
  }
});

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

defineExpose({ scrollToBottom, selectionMode });

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

watch(
  () => chatStore.requestScrollToBottom,
  () => {
    if (currentChat.value && messages.value.length > 0) {
      runInitialScrollToBottom();
    }
  },
  { flush: 'post' },
);

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

const handleEditMessage = (message: Message): void => {
  if (!canEditMessage(message, currentUserId.value)) return;
  emit('edit', message);
};

const handleDeleteMessage = async (message: Message): Promise<void> => {
  if (!currentChat.value || !canDeleteMessage(message, currentChat.value, currentUserId.value)) {
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

interface MessageContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  icon?: 'reply' | 'copy' | 'edit' | 'delete' | 'trash' | 'select' | 'pin' | 'unpin';
}

const getMessageContextMenuActions = (message: Message): MessageContextAction[] => {
  const actions: MessageContextAction[] = [];
  if (message.type !== 'system') {
    if (currentChat.value?.type !== 'private' || isOwnMessage(message, currentUserId.value)) {
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
  if (canEditMessage(message, currentUserId.value)) {
    actions.push({ id: 'edit', label: 'Редактировать', icon: 'edit' });
  }
  if (canDeleteMessage(message, currentChat.value, currentUserId.value)) {
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

const enterSelectionMode = (initialMessage?: Message): void => {
  selectionMode.value = true;
  emit('selection-mode', true);
  const next = new Set<string>();
  if (initialMessage && canDeleteMessage(initialMessage, currentChat.value, currentUserId.value)) {
    next.add(initialMessage._id);
  }
  selectedMessageIds.value = next;
};

const exitSelectionMode = (): void => {
  selectionMode.value = false;
  emit('selection-mode', false);
  selectedMessageIds.value = new Set();
};

const isMessageSelected = (message: Message): boolean => selectedMessageIds.value.has(message._id);

const toggleMessageSelection = (message: Message): void => {
  if (!canDeleteMessage(message, currentChat.value, currentUserId.value)) return;
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
    const count = selectedCount.value;
    const ids = Array.from(selectedMessageIds.value);
    await ids.reduce(async (prev, messageId) => {
      await prev;
      await chatStore.deleteMessage(chatId, messageId);
    }, Promise.resolve());
    notifySuccess(`Удалено сообщений: ${count}`);
    exitSelectionMode();
  } catch (err: any) {
    notifyError(err.response?.data?.error || 'Не удалось удалить сообщения');
  }
};

const handleReplyToMessage = (message: Message): void => {
  if (message.type === 'system') {
    return;
  }
  emit('reply', message);
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

const contextMenuActions = computed(() => (
  contextMenuMessage.value ? getMessageContextMenuActions(contextMenuMessage.value) : []
));

const highlightMessageEl = (messageElement: HTMLElement): void => {
  messageElement.classList.add('chat-window__message-wrapper--highlighted');
  setTimeout(() => messageElement.classList.remove('chat-window__message-wrapper--highlighted'), 2000);
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
    highlightMessageEl(messageElement);
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
  if (typeof replyTo === 'string' || !replyTo._id) {
    return;
  }

  const messageElement = document.getElementById(`message-${replyTo._id}`);

  if (messageElement && messagesContainer.value) {
    const containerRect = messagesContainer.value.getBoundingClientRect();
    const elementRect = messageElement.getBoundingClientRect();
    const { scrollTop } = messagesContainer.value;
    const elementTop = elementRect.top - containerRect.top + scrollTop;

    messagesContainer.value.scrollTo({
      top: elementTop - 20,
      behavior: 'smooth',
    });

    highlightMessageEl(messageElement);
  }
};

const VIEWPORT_EDGE_MARGIN = 50;

const updateReactionMenuPosition = (message: Message): void => {
  if (!messagesContainer.value || !props.isMobile) return;
  const contentEl = messagesContainer.value.querySelector(`[data-message-id="${message._id}"]`) as HTMLElement | null;
  const menuEl = messagesContainer.value.querySelector('.chat-window__reaction-menu--visible') as HTMLElement | null;
  if (!contentEl || !menuEl) return;
  const rect = contentEl.getBoundingClientRect();
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const gap = 8;
  const menuHeight = menuEl.getBoundingClientRect().height;
  const headerHeight = 73 + (window.visualViewport ? 0 : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0', 10));
  const spaceAbove = rect.top - gap - menuHeight - headerHeight;
  const spaceBelow = vh - rect.bottom - gap - menuHeight;
  const canShowAbove = spaceAbove >= VIEWPORT_EDGE_MARGIN;
  const canShowBelow = spaceBelow >= VIEWPORT_EDGE_MARGIN;

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
  } else if (spaceBelow >= spaceAbove) {
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
};

const toggleReactionMenu = (message: Message): void => {
  if (showReactionMenu.value === message._id) {
    clearReactionMenuStyles();
    showReactionMenu.value = null;
  } else {
    showReactionMenu.value = message._id;
    reactionMenuPosition.value = 'below';
    nextTick(() => updateReactionMenuPosition(message));
  }
};

const handleReactionClick = async (message: Message, emoji: string): Promise<void> => {
  if (!currentChat.value || isOwnMessage(message, currentUserId.value)) {
    return;
  }

  if (props.isMobile) {
    clearReactionMenuStyles();
  }

  try {
    await chatStore.toggleReaction(currentChat.value._id, message._id, emoji);
    showReactionMenu.value = null;
  } catch (error: any) {
    console.error('Ошибка добавления реакции:', error);
  }
};

const reactionPopover = ref<{ messageId: string; emoji: string } | null>(null);
const reactionPopoverTrigger = ref<HTMLElement | null>(null);
const reactionPopoverEl = ref<HTMLElement | null>(null);
const REACTION_POPOVER_SHOW_MS = 400;
const REACTION_POPOVER_HIDE_MS = 150;
let reactionPopoverShowTimeout: ReturnType<typeof setTimeout> | null = null;
let reactionPopoverHideTimeout: ReturnType<typeof setTimeout> | null = null;

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

const onReactionPopoverTriggerEnter = (message: Message, emoji: string, e: MouseEvent): void => {
  const trigger = e.currentTarget as HTMLElement | null;
  if (trigger) showReactionPopover(message, emoji, trigger);
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

const reactionPopoverUsers = computed(() => {
  if (!reactionPopover.value) return [];
  const message = messages.value.find((m) => m._id === reactionPopover.value!.messageId);
  return message ? getReactionUsers(message, reactionPopover.value!.emoji, currentChat.value) : [];
});

const handleReactionPopoverUpdatePosition = (): void => {
  if (reactionPopover.value) updateReactionPopoverPosition();
};

const getTypingText = (): string => {
  const ids = Array.from(typingUsers.value);
  if (ids.length === 0) return '';
  const names = ids.map((userId) => {
    if (!currentChat.value) return userId.slice(0, 8);
    const p = currentChat.value.participants.find(
      (participant) => participantId(participant) === userId,
    );
    return p && typeof p !== 'string' ? p.username : userId.slice(0, 8);
  });
  if (names.length === 1) return `${names[0]} печатает`;
  return `${names.join(', ')} печатают`;
};

onMounted(() => {
  window.addEventListener('resize', handleReactionPopoverUpdatePosition);
  window.addEventListener('scroll', handleReactionPopoverUpdatePosition, true);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleReactionPopoverUpdatePosition);
  window.removeEventListener('scroll', handleReactionPopoverUpdatePosition, true);
  if (reactionPopoverShowTimeout) clearTimeout(reactionPopoverShowTimeout);
  if (reactionPopoverHideTimeout) clearTimeout(reactionPopoverHideTimeout);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div
    v-if="currentChat"
    class="chat-window__messages"
    :class="{ 'chat-window__messages--with-pinned': currentChat.pinnedMessage }"
    ref="messagesContainer"
    @scroll="onMessagesScroll"
  >
    <PinnedMessageBar
      v-if="currentChat.pinnedMessage"
      :message="currentChat.pinnedMessage"
      @go="scrollToPinnedMessage"
      @unpin="unpinMessage"
    />
    <div v-if="chatStore.loadingMessages" class="chat-window__messages-loader">
      <div class="chat-window__messages-loader-spinner" aria-hidden="true" />
      <span class="chat-window__messages-loader-text">Загрузка сообщений...</span>
    </div>

    <template v-for="message in messages" :key="message._id">
      <ChatMessageItem
        :message="message"
        :is-mobile="isMobile"
        :selection-mode="selectionMode"
        :selected="isMessageSelected(message)"
        :reaction-menu-open="showReactionMenu === message._id"
        :reaction-menu-position="reactionMenuPosition"
        @reply="handleReplyToMessage"
        @open-user="emit('open-user', $event)"
        @open-message="emit('open-message', $event)"
        @contextmenu="onMessageContextMenu"
        @toggle-select="toggleMessageSelection"
        @toggle-reaction-menu="toggleReactionMenu"
        @reaction="handleReactionClick"
        @reaction-hover="onReactionPopoverTriggerEnter"
        @reaction-leave="hideReactionPopover"
        @jump-reply="scrollToRepliedMessage"
      />
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

  <MessageSelectionBar
    v-if="currentChat && selectionMode"
    :count="selectedCount"
    @delete="deleteSelectedMessages"
    @cancel="exitSelectionMode"
  />

  <ContextMenu
    v-model="contextMenuVisible"
    :x="contextMenuX"
    :y="contextMenuY"
    :actions="contextMenuActions"
    @select="onContextMenuSelect"
  />
</template>

<style scoped lang="scss">
.chat-window {
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
}
</style>
