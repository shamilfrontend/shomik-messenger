<script setup lang="ts">
import {
  computed, ref, nextTick, onMounted, onUnmounted,
} from 'vue';

import { useChatStore } from '../stores/chat.store';
import { useCallStore } from '../stores/call.store';
import Tooltip from './Tooltip.vue';
import { getChatName, getChatAvatar, getOtherParticipant, getChatStatusLabel } from '../utils/chatDisplay';
import { getComputedStatus } from '../utils/status';

const props = defineProps<{
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'avatar-click'): void;
  (e: 'title-click'): void;
  (e: 'start-call'): void;
  (e: 'start-video'): void;
  (e: 'start-group-call'): void;
  (e: 'start-group-video'): void;
}>();

const chatStore = useChatStore();
const callStore = useCallStore();
const headerRef = ref<HTMLElement | null>(null);

const currentChat = computed(() => chatStore.currentChat);
const isGroupChat = computed(() => currentChat.value?.type === 'group');

const getName = (): string => getChatName(currentChat.value, chatStore.user?.id);
const getAvatar = (): string | undefined => getChatAvatar(currentChat.value, chatStore.user?.id);
const otherParticipant = (): ReturnType<typeof getOtherParticipant> => (
  getOtherParticipant(currentChat.value, chatStore.user?.id)
);
const getStatus = (): string => getChatStatusLabel(currentChat.value, chatStore.user?.id);

let rafId: number | null = null;
let lastViewportTop = 0;

const handleViewportResize = (): void => {
  if (!props.isMobile || !headerRef.value) return;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  rafId = requestAnimationFrame(() => {
    if (!headerRef.value) return;

    const { visualViewport } = window;
    let viewportTop = 0;

    if (visualViewport) {
      viewportTop = visualViewport.offsetTop;
    } else {
      const currentHeight = window.innerHeight;
      const screenHeight = window.screen.height;
      if (currentHeight < screenHeight * 0.75) {
        viewportTop = 0;
      }
    }

    if (viewportTop !== lastViewportTop) {
      lastViewportTop = viewportTop;

      headerRef.value.style.position = 'fixed';
      headerRef.value.style.top = `${viewportTop}px`;
      headerRef.value.style.left = '0';
      headerRef.value.style.right = '0';
      headerRef.value.style.zIndex = '1000';
      headerRef.value.style.width = '100%';
      headerRef.value.style.transform = 'translateZ(0)';
      headerRef.value.style.webkitTransform = 'translateZ(0)';
    }

    rafId = null;
  });
};

const handleInputFocus = (): void => {
  if (props.isMobile && headerRef.value) {
    setTimeout(() => handleViewportResize(), 50);
    setTimeout(() => handleViewportResize(), 150);
    setTimeout(() => handleViewportResize(), 300);
  }
};

const handleInputBlur = (): void => {
  if (props.isMobile && headerRef.value) {
    setTimeout(() => handleViewportResize(), 50);
    setTimeout(() => handleViewportResize(), 150);
    setTimeout(() => handleViewportResize(), 300);
  }
};

const onFocusIn = (e: FocusEvent): void => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    handleInputFocus();
  }
};

const onFocusOut = (e: FocusEvent): void => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    handleInputBlur();
  }
};

let checkInterval: number | null = null;
const startHeaderPositionCheck = (): void => {
  if (checkInterval !== null) return;

  checkInterval = window.setInterval(() => {
    if (props.isMobile && headerRef.value) {
      handleViewportResize();
    }
  }, 500);
};

const stopHeaderPositionCheck = (): void => {
  if (checkInterval !== null) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};

onMounted(() => {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
  }
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('orientationchange', handleViewportResize);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);

  nextTick(() => {
    handleViewportResize();
    if (props.isMobile) {
      startHeaderPositionCheck();
    }
  });
});

onUnmounted(() => {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportResize);
    window.visualViewport.removeEventListener('scroll', handleViewportResize);
  }
  window.removeEventListener('resize', handleViewportResize);
  window.removeEventListener('orientationchange', handleViewportResize);
  document.removeEventListener('focusin', onFocusIn);
  document.removeEventListener('focusout', onFocusOut);

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  stopHeaderPositionCheck();
});
</script>

<template>
	<div v-if="currentChat" ref="headerRef" class="chat-window__header">
			<button
				v-if="isMobile"
				@click="emit('back')"
				class="chat-window__back-button"
				aria-label="Назад"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</button>
			<div class="chat-window__header-info">
				<div
					class="chat-window__avatar"
					role="button"
					tabindex="0"
					@click="emit('avatar-click')"
					@keydown.enter="emit('avatar-click')"
					@keydown.space.prevent="emit('avatar-click')"
				>
					<img
						v-if="getAvatar()"
						:src="getAvatar()"
						:alt="getName()"
					/>
					<div v-else class="chat-window__avatar-placeholder">
						{{ getName().charAt(0).toUpperCase() }}
					</div>
					<span
						v-if="currentChat && currentChat.type === 'private' && otherParticipant()"
						:class="['chat-window__status-indicator', `chat-window__status-indicator--${getComputedStatus(otherParticipant())}`]"
					/>
				</div>
				<div
					class="chat-window__header-text"
					:class="{ 'chat-window__header-text--clickable': currentChat && isGroupChat }"
					role="button"
					tabindex="0"
					:aria-label="currentChat && isGroupChat ? 'Настройки группы' : undefined"
					@click="emit('title-click')"
					@keydown.enter.prevent="emit('title-click')"
					@keydown.space.prevent="emit('title-click')"
				>
					<h3>{{ getName() }}</h3>
					<span v-if="getStatus()" class="chat-window__status">{{ getStatus() }}</span>
				</div>
			</div>
		<Tooltip text="Голосовой звонок" position="bottom">
			<button
				v-if="currentChat && currentChat.type === 'private' && otherParticipant()"
				:disabled="callStore.isConnecting || !!callStore.activeCall"
				class="chat-window__call-button"
				aria-label="Голосовой звонок"
				@click="emit('start-call')"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
				</svg>
			</button>
		</Tooltip>
		<Tooltip text="Видеозвонок" position="bottom">
			<button
				v-if="currentChat && currentChat.type === 'private' && otherParticipant()"
				:disabled="callStore.isConnecting || !!callStore.activeCall"
				class="chat-window__call-button"
				aria-label="Видеозвонок"
				@click="emit('start-video')"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M23 7l-7 5 7 5V7z"></path>
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
				</svg>
			</button>
		</Tooltip>
		<Tooltip text="Начать групповой звонок" position="bottom">
			<button
				v-if="currentChat && isGroupChat && !callStore.activeCall && (!callStore.groupCallAvailable || callStore.groupCallAvailable.chatId !== currentChat._id)"
				@click="emit('start-group-call')"
				:disabled="callStore.isConnecting"
				class="chat-window__call-button"
				aria-label="Групповой звонок"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
				</svg>
			</button>
		</Tooltip>
		<Tooltip text="Начать групповой видеозвонок" position="bottom">
			<button
				v-if="currentChat && isGroupChat && !callStore.activeCall && (!callStore.groupCallAvailable || callStore.groupCallAvailable.chatId !== currentChat._id)"
				:disabled="callStore.isConnecting"
				class="chat-window__call-button"
				aria-label="Групповой видеозвонок"
				@click="emit('start-group-video')"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M23 7l-7 5 7 5V7z"></path>
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
				</svg>
			</button>
		</Tooltip>
		</div>
</template>

<style scoped lang="scss">
.chat-window {
  &__header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--surface, var(--bg-secondary));
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 10;

    @media (max-width: 768px) {
      /* JavaScript будет управлять позиционированием через inline стили */
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      width: 100%;
      /* Создаем новый слой композиции для надежной работы на мобильных */
      transform: translateZ(0);
      backface-visibility: hidden;
      will-change: transform, top;
      /* Учитываем safe area для устройств с вырезом */
      padding-top: calc(1rem + env(safe-area-inset-top, 0px));
      padding-bottom: 1rem;
      padding-left: calc(1rem + env(safe-area-inset-left, 0px));
      padding-right: calc(1rem + env(safe-area-inset-right, 0px));
    }
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

  &__call-button {
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

    &:hover:not(:disabled) {
      background: var(--bg-primary);
      color: var(--accent-color);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: visible;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    cursor: pointer;

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
    min-width: 0;

    &--clickable {
      cursor: pointer;

      &:hover h3 {
        color: var(--accent-color);
      }
    }

    h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-heading-size, 1rem);
      font-weight: var(--font-heading-weight, 600);
      transition: color 0.2s;
    }
  }

  &__status {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
}
</style>
