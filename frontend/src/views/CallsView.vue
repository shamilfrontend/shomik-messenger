<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

interface CallHistory {
  id: string;
  type: 'incoming' | 'outgoing';
  callType: 'audio' | 'video';
  status: 'answered' | 'missed' | 'rejected';
  participant: { id: string; username: string; avatar?: string };
  participantsCount?: number;
  participants?: Array<{ id: string; username: string; avatar?: string }>;
  chatId?: string;
  duration?: number;
  createdAt: Date;
}

const props = defineProps<{
  selectedCall: CallHistory | null | undefined;
  callId?: string;
  isNewCall?: boolean;
  isCallsPage?: boolean;
}>();

// Отладочный вывод
watch(() => props.selectedCall, (newCall) => {
  console.log('CallsView: selectedCall changed', newCall);
}, { immediate: true });

watch(() => props.callId, (newId) => {
  console.log('CallsView: callId changed', newId);
}, { immediate: true });

const router = useRouter();

const formatTime = (date: Date): string => {
  const d = new Date(date);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'answered':
      return 'Принят';
    case 'missed':
      return 'Пропущен';
    case 'rejected':
      return 'Отклонен';
    default:
      return status;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'answered':
      return '#52c41a';
    case 'missed':
    case 'rejected':
      return '#ff4d4f';
    default:
      return 'var(--text-secondary)';
  }
};

const getTypeText = (type: string): string => {
  return type === 'incoming' ? 'Входящий' : 'Исходящий';
};

const getCallTypeText = (callType: string): string => {
  return callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок';
};

const getParticipantName = computed(() => {
  if (!props.selectedCall) return 'Пользователь';
  const participant = props.selectedCall.participant;
  if (!participant) return 'Пользователь';
  return typeof participant === 'object' && 'username' in participant
    ? participant.username
    : 'Пользователь';
});

const getParticipantAvatar = computed(() => {
  if (!props.selectedCall) return undefined;
  const participant = props.selectedCall.participant;
  if (!participant || typeof participant !== 'object') return undefined;
  return 'avatar' in participant ? participant.avatar : undefined;
});
</script>

<template>
  <div class="calls-view">
    <div class="calls-view__content">
      <div v-if="props.isNewCall" class="calls-view__new-call">
        <div class="calls-view__new-call-content">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <h2>Создать звонок</h2>
          <p class="calls-view__new-call-text">Функционал создания звонка будет добавлен позже</p>
        </div>
      </div>
      <div v-else-if="!props.selectedCall && props.isCallsPage" class="calls-view__new-call">
        <div class="calls-view__new-call-content">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <h2>Создать звонок</h2>
          <p class="calls-view__new-call-text">Функционал создания звонка будет добавлен позже</p>
        </div>
      </div>
      <div v-else-if="!props.selectedCall" class="calls-view__empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <p class="calls-view__empty">Звонок не найден</p>
      </div>

      <div v-else class="calls-view__details">
        <div class="calls-view__details-header">
          <div class="calls-view__details-avatar">
            <div v-if="props.selectedCall.participantsCount && props.selectedCall.participantsCount > 1" class="calls-view__details-group-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div v-else-if="getParticipantAvatar" class="calls-view__details-avatar-img">
              <img :src="getParticipantAvatar" :alt="getParticipantName" />
            </div>
            <div v-else class="calls-view__details-avatar-placeholder">
              {{ getParticipantName ? getParticipantName.charAt(0).toUpperCase() : 'П' }}
            </div>
          </div>
          <h2 v-if="!props.selectedCall.participantsCount || props.selectedCall.participantsCount <= 1" class="calls-view__details-name">{{ getParticipantName }}</h2>
          <p v-if="props.selectedCall.participantsCount && props.selectedCall.participantsCount > 1" class="calls-view__details-group">
            Групповой звонок · {{ props.selectedCall.participantsCount }} участников
          </p>
        </div>

        <div class="calls-view__details-info">
          <div class="calls-view__info-item">
            <span class="calls-view__info-label">Тип звонка</span>
            <span class="calls-view__info-value">{{ getCallTypeText(props.selectedCall.callType) }}</span>
          </div>

          <div class="calls-view__info-item">
            <span class="calls-view__info-label">Направление</span>
            <span class="calls-view__info-value">{{ getTypeText(props.selectedCall.type) }}</span>
          </div>

          <div class="calls-view__info-item">
            <span class="calls-view__info-label">Статус</span>
            <span class="calls-view__info-value" :style="{ color: getStatusColor(props.selectedCall.status) }">
              {{ getStatusText(props.selectedCall.status) }}
            </span>
          </div>

          <div v-if="props.selectedCall.duration" class="calls-view__info-item">
            <span class="calls-view__info-label">Длительность</span>
            <span class="calls-view__info-value">{{ formatDuration(props.selectedCall.duration) }}</span>
          </div>

          <div class="calls-view__info-item">
            <span class="calls-view__info-label">Дата и время</span>
            <span class="calls-view__info-value">{{ formatTime(props.selectedCall.createdAt) }}</span>
          </div>

          <div v-if="props.selectedCall.participantsCount && props.selectedCall.participantsCount > 1 && props.selectedCall.participants" class="calls-view__participants">
            <h3 class="calls-view__participants-title">Участники ({{ props.selectedCall.participants.length }})</h3>
            <div class="calls-view__participants-list">
              <div
                v-for="participant in props.selectedCall.participants"
                :key="participant.id"
                class="calls-view__participant-item"
              >
                <div class="calls-view__participant-avatar">
                  <div v-if="participant.avatar" class="calls-view__participant-avatar-img">
                    <img :src="participant.avatar" :alt="participant.username" />
                  </div>
                  <div v-else class="calls-view__participant-avatar-placeholder">
                    {{ participant.username.charAt(0).toUpperCase() }}
                  </div>
                </div>
                <span class="calls-view__participant-name">{{ participant.username }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.calls-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);


  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 2rem;

    @media (max-width: 768px) {
      padding: 1rem;
    }
  }

  &__empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;

    svg {
      color: var(--text-secondary);
      opacity: 0.5;
    }
  }

  &__empty {
    color: var(--text-secondary);
    font-size: 0.95rem;
    text-align: center;
  }

  &__new-call {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  &__new-call-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    max-width: 400px;
    text-align: center;

    svg {
      color: var(--accent-color);
      opacity: 0.7;
    }

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.5rem;
      font-weight: 600;
    }
  }

  &__new-call-text {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  &__details {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  &__details-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
  }

  &__details-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;

    @media (max-width: 768px) {
      width: 64px;
      height: 64px;
    }
  }

  &__details-avatar-img {
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__details-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 2rem;
    border-radius: 50%;

    @media (max-width: 768px) {
      font-size: 1.5rem;
    }
  }

  &__details-group-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    color: var(--accent-color);
    border-radius: 50%;
    border: 2px solid var(--accent-color);

    svg {
      width: 100%;
      height: 100%;
      padding: 0.5rem;
    }
  }

  &__details-name {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;

    @media (max-width: 768px) {
      font-size: 1.25rem;
    }
  }

  &__details-group {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
  }

  &__details-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  &__info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    gap: 1rem;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
      padding: 0.75rem;
    }
  }

  &__info-label {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
  }

  &__info-value {
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: right;

    @media (max-width: 768px) {
      text-align: left;
    }
  }

  &__participants {
    margin-top: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  &__participants-title {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 600;
  }

  &__participants-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__participant-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-primary);
    }
  }

  &__participant-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  &__participant-avatar-img {
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__participant-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 1rem;
  }

  &__participant-name {
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 500;
  }
}
</style>
