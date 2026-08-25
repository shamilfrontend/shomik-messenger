<script setup lang="ts">
import {
  computed, watch, ref, nextTick, onMounted, onUnmounted,
} from 'vue';

import { useChatStore } from '../stores/chat.store';
import { useCallStore } from '../stores/call.store';
import Tooltip from './Tooltip.vue';
import { useNotifications } from '../composables/useNotifications';
import { getChatNameById as resolveChatNameById, getParticipantUsername as resolveParticipantUsername } from '../utils/chatDisplay';

const chatStore = useChatStore();
const callStore = useCallStore();
const { error: notifyError } = useNotifications();

const remoteAudioRef = ref<HTMLAudioElement | null>(null);
const localVideoRef = ref<HTMLVideoElement | null>(null);
const remoteVideoRef = ref<HTMLVideoElement | null>(null);
/** Элементы <video> для удалённых потоков по userId (групповой видеозвонок) */
const remoteVideoEls: Record<string, HTMLVideoElement | null> = {};
const videoCallMicDropdownOpen = ref(false);
const videoCallCameraDropdownOpen = ref(false);

const getChatNameById = (chatId: string): string => (
  resolveChatNameById(chatStore.chats, chatId, chatStore.user?.id)
);

const getParticipantUsername = (chatId: string, userId: string): string => (
  resolveParticipantUsername(chatStore.chats, chatId, userId)
);

/** Число колонок сетки группового видеозвонка по количеству участников (≈ квадратная сетка) */
const groupVideoGridStyle = computed(() => {
  const n = Math.max(1, Object.keys(callStore.remoteStreams).length);
  const cols = Math.ceil(Math.sqrt(n));
  return { '--grid-cols': String(cols) };
});

const handleAcceptCall = async (): Promise<void> => {
  if (!callStore.incomingCall) return;
  try {
    await callStore.acceptCall(callStore.incomingCall.chatId, callStore.incomingCall.fromUserId);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось принять звонок');
  }
};

const handleRejectCall = (): void => {
  if (!callStore.incomingCall) return;
  callStore.rejectCall(callStore.incomingCall.chatId, callStore.incomingCall.fromUserId);
};

const handleJoinGroupCall = async (): Promise<void> => {
  const chatId = callStore.groupCallAvailable?.chatId ?? chatStore.currentChat?._id;
  if (!chatId) return;
  try {
    await callStore.joinGroupCall(chatId);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось присоединиться к созвону');
  }
};

const handleClickOutside = (event: MouseEvent): void => {
  const target = event.target as HTMLElement;
  if (!target.closest('.chat-window__video-call-device-group')) {
    videoCallMicDropdownOpen.value = false;
    videoCallCameraDropdownOpen.value = false;
  }
};

watch(
  () => (callStore.remoteStreams && callStore.activeCall?.peerUserId
    ? callStore.remoteStreams[callStore.activeCall.peerUserId]
    : null),
  (stream) => {
    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = stream || null;
    }
  },
  { immediate: true },
);

/** Привязка элемента видео к удалённому потоку по userId (для группового видеозвонка) */
function setRemoteVideoEl(userId: string, el: unknown): void {
  if (!el || !(el instanceof HTMLVideoElement)) {
    delete remoteVideoEls[userId];
    return;
  }
  remoteVideoEls[userId] = el;
  el.srcObject = callStore.remoteStreams[userId] || null;
}

watch(
  () => callStore.remoteStreams,
  () => {
    Object.entries(remoteVideoEls).forEach(([uid, video]) => {
      if (video) video.srcObject = callStore.remoteStreams[uid] || null;
    });
  },
  { deep: true },
);

watch(
  () => callStore.activeCall?.isVideo === true,
  (isVideo) => {
    if (isVideo) {
      nextTick(() => {
        callStore.setLocalVideoRef(localVideoRef.value);
      });
    } else {
      callStore.setLocalVideoRef(null);
    }
  },
);

watch(
  () => Boolean(callStore.activeCall && callStore.isVideoCall),
  (isVideoCallActive) => {
    if (isVideoCallActive) callStore.loadDevices();
  },
);

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  nextTick(() => {
    callStore.setRemoteAudioRef(remoteAudioRef.value);
    callStore.setLocalVideoRef(localVideoRef.value);
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  callStore.setRemoteAudioRef(null);
  callStore.setLocalVideoRef(null);
});
</script>

<template>
		<!-- Входящий звонок -->
		<div v-if="callStore.incomingCall" class="chat-window__incoming-call">
			<div class="chat-window__incoming-call-info">
				<span class="chat-window__incoming-call-label">{{ callStore.incomingCall.isVideo ? 'Входящий видеозвонок' : 'Входящий звонок' }}</span>
				<span class="chat-window__incoming-call-name">{{ callStore.incomingCall.caller?.username || 'Пользователь' }}</span>
			</div>
			<div class="chat-window__incoming-call-actions">
				<button type="button" class="chat-window__call-action chat-window__call-action--reject" @click="handleRejectCall" aria-label="Отклонить">
					<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
					</svg>
				</button>
				<button type="button" class="chat-window__call-action chat-window__call-action--accept" @click="handleAcceptCall" aria-label="Принять">
					<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
					</svg>
				</button>
			</div>
		</div>

		<!-- Можно присоединиться к групповому созвону (показываем всегда, если есть активный созвон) -->
		<div v-if="callStore.groupCallAvailable" class="chat-window__incoming-call">
			<div class="chat-window__incoming-call-info">
				<span class="chat-window__incoming-call-label">{{ callStore.groupCallAvailable.isVideo ? 'Групповой видеосозвон' : 'Групповой созвон' }}</span>
				<span class="chat-window__incoming-call-name">{{ getChatNameById(callStore.groupCallAvailable.chatId) }} · Участников: {{ callStore.groupCallAvailable.participants.length }}</span>
			</div>
			<div class="chat-window__incoming-call-actions">
				<button type="button" class="chat-window__call-action chat-window__call-action--accept" @click="handleJoinGroupCall" :disabled="callStore.isConnecting" aria-label="Присоединиться">
					<svg width="24" height="24" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
					</svg>
				</button>
			</div>
		</div>

		<!-- Активный звонок (всегда виден, пока пользователь в созвоне) -->
		<div v-if="callStore.activeCall && !callStore.isVideoCall" class="chat-window__active-call">
			<span class="chat-window__active-call-label">
				{{ callStore.isGroupCall
					? `${getChatNameById(callStore.activeCall.chatId)} · Групповой звонок (${callStore.activeCall.participants.length})`
					: `Звонок · ${getChatNameById(callStore.activeCall.chatId)}`
				}}
			</span>
			<button type="button" :class="['chat-window__call-action', { 'chat-window__call-action--muted': callStore.isMuted }]" @click="callStore.setMuted(!callStore.isMuted)" aria-label="Микрофон">
				<svg v-if="!callStore.isMuted" width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
				<svg v-else width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path></svg>
			</button>
			<button type="button" class="chat-window__call-action chat-window__call-action--hangup" @click="callStore.hangUp()" aria-label="Завершить">
				<svg width="20" height="20" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
			</button>
		</div>

		<!-- Видеозвонок: полноэкранная панель с видео -->
		<div v-if="callStore.activeCall && callStore.isVideoCall" class="chat-window__video-call">
			<div
			class="chat-window__video-call-remote"
			:class="{ 'chat-window__video-call-remote--grid': callStore.isGroupCall }"
			:style="callStore.isGroupCall ? groupVideoGridStyle : undefined"
		>
				<template v-if="callStore.isGroupCall">
					<div
						v-for="userId in Object.keys(callStore.remoteStreams)"
						:key="userId"
						class="chat-window__video-call-tile"
					>
						<video
							:ref="(el) => setRemoteVideoEl(userId, el)"
							autoplay
							playsinline
							class="chat-window__video-call-video"
						/>
						<span
							v-if="callStore.activeCall?.chatId"
							class="chat-window__video-call-tile-label"
						>{{ getParticipantUsername(callStore.activeCall.chatId, userId) }}</span>
					</div>
					<div v-if="Object.keys(callStore.remoteStreams).length === 0" class="chat-window__video-call-placeholder">
						<svg width="64" height="64" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
						<span>Ожидание видео...</span>
					</div>
				</template>
				<template v-else>
					<div class="chat-window__video-call-tile chat-window__video-call-tile--single">
						<video ref="remoteVideoRef" autoplay playsinline class="chat-window__video-call-video" />
						<span
							v-if="callStore.activeCall?.chatId && callStore.activeCall?.peerUserId"
							class="chat-window__video-call-tile-label"
						>{{ getParticipantUsername(callStore.activeCall.chatId, callStore.activeCall.peerUserId) }}</span>
					</div>
					<div v-if="!callStore.activeCall?.peerUserId || !callStore.remoteStreams[callStore.activeCall.peerUserId]" class="chat-window__video-call-placeholder">
						<svg width="64" height="64" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
						<span>Ожидание видео...</span>
					</div>
				</template>
			</div>
			<div class="chat-window__video-call-local">
				<video ref="localVideoRef" autoplay muted playsinline class="chat-window__video-call-video chat-window__video-call-video--local" />
			</div>
			<div class="chat-window__video-call-controls">
				<div class="chat-window__video-call-device-group">
					<button type="button" :class="['chat-window__call-action', { 'chat-window__call-action--muted': callStore.isMuted }]" @click="callStore.setMuted(!callStore.isMuted)" aria-label="Микрофон">
						<svg v-if="!callStore.isMuted" width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
						<svg v-else width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path></svg>
					</button>
					<button type="button" class="chat-window__video-call-device-trigger" :class="{ 'chat-window__video-call-device-trigger--open': videoCallMicDropdownOpen }" aria-label="Выбор микрофона" @click="videoCallMicDropdownOpen = !videoCallMicDropdownOpen; videoCallCameraDropdownOpen = false">
						<svg width="12" height="12" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</button>
					<div v-if="videoCallMicDropdownOpen" class="chat-window__video-call-device-dropdown">
						<button type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': !callStore.selectedMicId }" @click="callStore.switchAudioInput(null); videoCallMicDropdownOpen = false">По умолчанию</button>
						<button v-for="dev in callStore.audioDevices" :key="dev.deviceId" type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': callStore.selectedMicId === dev.deviceId }" @click="callStore.switchAudioInput(dev.deviceId); videoCallMicDropdownOpen = false">{{ dev.label || `Микрофон ${dev.deviceId.slice(0, 8)}` }}</button>
					</div>
				</div>

				<div v-if="callStore.activeCall?.isVideo" class="chat-window__video-call-device-group">
					<button type="button" :class="['chat-window__call-action', { 'chat-window__call-action--muted': callStore.isVideoOff }]" @click="callStore.setVideoOff(!callStore.isVideoOff)" aria-label="Камера">
						<svg v-if="!callStore.isVideoOff" width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
						<svg v-else width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
					</button>
					<button type="button" class="chat-window__video-call-device-trigger" :class="{ 'chat-window__video-call-device-trigger--open': videoCallCameraDropdownOpen }" aria-label="Выбор камеры" @click="videoCallCameraDropdownOpen = !videoCallCameraDropdownOpen; videoCallMicDropdownOpen = false">
						<svg width="12" height="12" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</button>
					<div v-if="videoCallCameraDropdownOpen" class="chat-window__video-call-device-dropdown">
						<button type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': !callStore.selectedCameraId }" @click="callStore.switchVideoInput(null); videoCallCameraDropdownOpen = false">По умолчанию</button>
						<button v-for="dev in callStore.videoDevices" :key="dev.deviceId" type="button" class="chat-window__video-call-device-item" :class="{ 'chat-window__video-call-device-item--active': callStore.selectedCameraId === dev.deviceId }" @click="callStore.switchVideoInput(dev.deviceId); videoCallCameraDropdownOpen = false">{{ dev.label || `Камера ${dev.deviceId.slice(0, 8)}` }}</button>
					</div>
				</div>

				<Tooltip :text="callStore.isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'" position="top">
					<button
						v-if="callStore.activeCall?.isVideo"
						type="button"
						:class="['chat-window__call-action', { 'chat-window__call-action--active': callStore.isScreenSharing }]"
						@click="callStore.toggleScreenShare()"
						aria-label="Демонстрация экрана"
					>
						<svg width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
							<line x1="8" y1="21" x2="16" y2="21"></line>
							<line x1="12" y1="17" x2="12" y2="21"></line>
						</svg>
					</button>
				</Tooltip>

				<button type="button" class="chat-window__call-action chat-window__call-action--hangup" @click="callStore.hangUp()" aria-label="Завершить">
					<svg width="22" height="22" viewBox="0 0 24 24" style="fill: none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
				</button>
			</div>
		</div>

		<audio ref="remoteAudioRef" autoplay />
</template>

<style scoped lang="scss">
.chat-window {
  &__incoming-call {
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;

    @media (max-width: 768px) {
      position: sticky;
      top: calc(73px + env(safe-area-inset-top, 0px));
      z-index: 99;
      transform: translateZ(0);
    }
  }

  &__incoming-call-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__incoming-call-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  &__incoming-call-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  &__incoming-call-actions {
    display: flex;
    gap: 0.5rem;
  }

  &__active-call {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;

    @media (max-width: 768px) {
      position: sticky;
      top: calc(73px + env(safe-area-inset-top, 0px));
      z-index: 99;
      transform: translateZ(0);
    }
  }

  &__active-call-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    flex: 1;
  }

  &__call-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-primary);
    background: var(--bg-primary);

    &:hover {
      opacity: 0.9;
    }

    &--accept {
      background: #22c55e;
      color: #fff;
    }

    &--reject {
      background: #ef4444;
      color: #fff;
    }

    &--hangup {
      background: #ef4444;
      color: #fff;
    }

    &--muted {
      background: var(--text-secondary);
      color: var(--bg-primary);
    }

    &--active {
      background: var(--accent-color);
      color: #fff;
    }
  }

  &__video-call {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
  }

  &__video-call-remote {
    flex: 1;
    position: relative;
    background: #000;
    min-height: 0;

    &--grid {
      display: grid;
      grid-template-columns: repeat(var(--grid-cols, 2), 1fr);
      grid-auto-rows: 1fr;
      gap: 0.75rem;
      padding: 0.75rem;
      align-content: center;
      align-items: center;
      justify-items: center;
    }
  }

  &__video-call-tile {
    position: relative;
    width: 100%;
    max-width: 100%;
    aspect-ratio: 4 / 3;
    background: #111;
    border-radius: 8px;
    overflow: hidden;
    min-height: 0;

    &--single {
      position: absolute;
      inset: 0;
      aspect-ratio: auto;
    }

    .chat-window__video-call-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
  }

  &__video-call-tile-label {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    max-width: calc(100% - 1rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  &__video-call-video {
    width: 100%;
    height: 100%;
    object-fit: contain;

    &--local {
      object-fit: cover;
    }
  }

  &__video-call-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__video-call-local {
    position: absolute;
    right: 1rem;
    bottom: 5rem;
    width: 120px;
    height: 90px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--border-color);
    background: #000;
  }

  &__video-call-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  }

  &__video-call-device-group {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 24px;

    .chat-window__call-action {
      border-radius: 50%;
    }
  }

  &__video-call-device-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    margin-right: 2px;
    color: rgba(255, 255, 255, 0.9);
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    svg {
      transition: transform 0.2s;
    }

    &--open svg {
      transform: rotate(180deg);
    }
  }

  &__video-call-device-dropdown {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    left: 0;
    min-width: 200px;
    max-height: 240px;
    overflow-y: auto;
    padding: 0.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 30;
  }

  &__video-call-device-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    text-align: left;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background: var(--bg-primary);
    }

    &--active {
      background: var(--bg-primary);
      font-weight: 500;
    }
  }
}
</style>
