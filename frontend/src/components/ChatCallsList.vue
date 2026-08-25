<script setup lang="ts">
import { computed } from 'vue';
import type { CallHistory } from '../stores/sidebar.store';
import { formatChatListTime } from '../utils/formatTime';

const props = defineProps<{
  calls: CallHistory[];
  search: string;
  activeId?: string;
}>();

const emit = defineEmits<{
  (e: 'select', call: CallHistory): void;
}>();

const getCallParticipantName = (call: CallHistory): string => {
  const participantName = typeof call.participant === 'object' && 'username' in call.participant
    ? call.participant.username
    : 'Пользователь';
  if (call.participantsCount && call.participantsCount > 1) {
    return `${participantName} и еще ${call.participantsCount - 1}`;
  }
  return participantName;
};

const getCallParticipantAvatar = (call: CallHistory): string | undefined => (
  typeof call.participant === 'object' && 'avatar' in call.participant
    ? call.participant.avatar
    : undefined
);

const formatCallDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const filteredCalls = computed(() => {
  if (!props.search) return props.calls;
  const query = props.search.toLowerCase();
  return props.calls.filter((call) => getCallParticipantName(call).toLowerCase().includes(query));
});
</script>

<template>
  <div
    v-for="call in filteredCalls"
    :key="call.id"
    :class="['chat-list__item', 'chat-list__item--call', { 'chat-list__item--active': activeId === call.id }]"
    @click="emit('select', call)"
  >
    <div class="chat-list__avatar">
      <div v-if="call.participantsCount && call.participantsCount > 1" class="chat-list__avatar-group-icon">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </div>
      <div v-else-if="getCallParticipantAvatar(call)" class="chat-list__avatar-img">
        <img :src="getCallParticipantAvatar(call)" :alt="getCallParticipantName(call)" />
      </div>
      <div v-else class="chat-list__avatar-placeholder">
        {{ getCallParticipantName(call).charAt(0).toUpperCase() }}
      </div>
    </div>
    <div class="chat-list__content">
      <div class="chat-list__header-row">
        <span class="chat-list__name">{{ getCallParticipantName(call) }}</span>
        <span class="chat-list__time">{{ formatChatListTime(call.createdAt) }}</span>
      </div>
      <div class="chat-list__call-details">
        <span
          :class="[
            'chat-list__call-type-icon',
            `chat-list__call-type-icon--${call.type}`,
            `chat-list__call-type-icon--${call.status}`,
          ]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </span>
        <span class="chat-list__call-info">
          {{ call.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок' }}
          <span v-if="call.participantsCount && call.participantsCount > 1" class="chat-list__call-participants">
            · {{ call.participantsCount }} участников
          </span>
          <span v-if="call.duration" class="chat-list__call-duration">
            · {{ formatCallDuration(call.duration) }}
          </span>
        </span>
        <span :class="['chat-list__call-status', `chat-list__call-status--${call.status}`]">
          {{ call.status === 'answered' ? 'Принят' : call.status === 'missed' ? 'Пропущен' : 'Отклонен' }}
        </span>
      </div>
    </div>
  </div>
</template>
