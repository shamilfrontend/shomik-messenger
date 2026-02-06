<template>
  <div v-if="isOpen" class="group-settings-modal" @click.self="close">
    <div class="group-settings-modal__content">
      <div class="group-settings-modal__header">
        <h2>Настройки группы</h2>
        <button @click="close" class="group-settings-modal__close">×</button>
      </div>

      <div class="group-settings-modal__body">
        <!-- Настройки для админа -->
        <template v-if="isCurrentUserAdmin">
          <!-- Аватар группы -->
          <div class="group-settings-modal__section">
            <h3>Аватар группы</h3>
            <div class="group-settings-modal__avatar-section">
              <div class="group-settings-modal__avatar">
                <img v-if="getGroupAvatarUrl()" 
                     :src="getGroupAvatarUrl()" 
                     :alt="chat.groupName || 'Группа'" />
                <div v-else class="group-settings-modal__avatar-placeholder">
                  {{ (chat.groupName || 'Г').charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="group-settings-modal__avatar-controls">
                <FileUpload
                  accept="image/*"
                  @uploaded="handleAvatarUploaded"
                  @error="handleUploadError"
                />
                <button v-if="chat.groupAvatar || avatarPreview" 
                        @click="removeAvatar" 
                        class="group-settings-modal__remove-avatar">
                  Удалить аватар
                </button>
              </div>
            </div>
          </div>

          <!-- Изменение названия группы -->
          <div class="group-settings-modal__section">
            <h3>Название группы</h3>
            <div class="group-settings-modal__field">
              <input
                v-model="groupName"
                type="text"
                placeholder="Название группы"
                @keydown.enter="updateGroupName"
              />
              <button @click="updateGroupName" :disabled="!canUpdateName || updating" class="group-settings-modal__button">
                {{ updating ? 'Сохранение...' : 'Сохранить' }}
              </button>
            </div>
          </div>

          <!-- Участники группы -->
          <div class="group-settings-modal__section">
            <h3>Участники ({{ chat.participants.length }})</h3>
            
            <!-- Список текущих участников -->
            <div class="group-settings-modal__participants">
              <div
                v-for="participant in chat.participants"
                :key="typeof participant === 'string' ? participant : participant.id"
                class="group-settings-modal__participant"
              >
                <div 
                  @click="openChatWithParticipant(participant)"
                  class="group-settings-modal__participant-info group-settings-modal__participant-info--clickable"
                >
                  <div class="group-settings-modal__participant-avatar">
                    <img
                      v-if="typeof participant !== 'string' && getParticipantAvatarUrl(participant)"
                      :src="getParticipantAvatarUrl(participant)"
                      :alt="typeof participant === 'string' ? 'User' : participant.username"
                    />
                    <div v-else class="group-settings-modal__participant-avatar-placeholder">
                      {{ (typeof participant === 'string' ? 'U' : participant.username).charAt(0).toUpperCase() }}
                    </div>
                    <span
                      v-if="typeof participant !== 'string'"
                      :class="['group-settings-modal__status-indicator', `group-settings-modal__status-indicator--${getComputedStatus(participant)}`]"
                    ></span>
                  </div>
                  <div class="group-settings-modal__participant-name">
                    {{ typeof participant === 'string' ? 'Пользователь' : participant.username }}
                    <span v-if="isAdmin(participant)" class="group-settings-modal__admin-badge">Админ</span>
                  </div>
                </div>
                <button
                  v-if="!isAdmin(participant)"
                  @click.stop="removeParticipant(participant)"
                  :disabled="removing"
                  class="group-settings-modal__remove-button"
                  title="Удалить из группы"
                >
                  ×
                </button>
              </div>
            </div>

            <!-- Добавление участников -->
            <div class="group-settings-modal__add-section">
              <h4>Добавить участников</h4>
              <div class="group-settings-modal__search">
                <input
                  v-model="searchQuery"
                  @input="handleSearch"
                  type="text"
                  placeholder="Поиск пользователей..."
                />
              </div>
              <div v-if="searchResults.length > 0" class="group-settings-modal__search-results">
                <div
                  v-for="user in searchResults"
                  :key="user.id"
                  @click="addParticipant(user)"
                  class="group-settings-modal__search-result"
                >
                  <div class="group-settings-modal__participant-avatar">
                    <img v-if="getImageUrl(user.avatar)" :src="getImageUrl(user.avatar)" :alt="user.username" />
                    <div v-else class="group-settings-modal__participant-avatar-placeholder">
                      {{ user.username.charAt(0).toUpperCase() }}
                    </div>
                    <span
                      :class="['group-settings-modal__status-indicator', `group-settings-modal__status-indicator--${getComputedStatus(user)}`]"
                    ></span>
                  </div>
                  <div class="group-settings-modal__participant-name">{{ user.username }}</div>
                  <button class="group-settings-modal__add-button">+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Удаление группы -->
          <div class="group-settings-modal__section group-settings-modal__section--danger">
            <h3>Опасная зона</h3>
            <button
              @click="confirmDelete"
              :disabled="deleting"
              class="group-settings-modal__delete-button"
            >
              {{ deleting ? 'Удаление...' : 'Удалить группу' }}
            </button>
          </div>
        </template>

        <!-- Настройки для участников (не админов) -->
        <template v-else>
          <!-- Информация о группе -->
          <div class="group-settings-modal__section">
            <h3>{{ chat.groupName }}</h3>
            <p class="group-settings-modal__participants-count">Участников: {{ chat.participants.length }}</p>
          </div>

          <!-- Участники группы -->
          <div class="group-settings-modal__section">
            <h3>Участники ({{ chat.participants.length }})</h3>
            
            <!-- Список текущих участников -->
            <div class="group-settings-modal__participants">
              <div
                v-for="participant in chat.participants"
                :key="typeof participant === 'string' ? participant : participant.id"
                class="group-settings-modal__participant"
              >
                <div 
                  @click="openChatWithParticipant(participant)"
                  class="group-settings-modal__participant-info group-settings-modal__participant-info--clickable"
                >
                  <div class="group-settings-modal__participant-avatar">
                    <img
                      v-if="typeof participant !== 'string' && getParticipantAvatarUrl(participant)"
                      :src="getParticipantAvatarUrl(participant)"
                      :alt="typeof participant === 'string' ? 'User' : participant.username"
                    />
                    <div v-else class="group-settings-modal__participant-avatar-placeholder">
                      {{ (typeof participant === 'string' ? 'U' : participant.username).charAt(0).toUpperCase() }}
                    </div>
                    <span
                      v-if="typeof participant !== 'string'"
                      :class="['group-settings-modal__status-indicator', `group-settings-modal__status-indicator--${getComputedStatus(participant)}`]"
                    ></span>
                  </div>
                  <div class="group-settings-modal__participant-name">
                    {{ typeof participant === 'string' ? 'Пользователь' : participant.username }}
                    <span v-if="isAdmin(participant)" class="group-settings-modal__admin-badge">Админ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Выход из группы -->
          <div class="group-settings-modal__section">
            <button
              @click="confirmLeave"
              :disabled="leaving"
              class="group-settings-modal__leave-button"
            >
              {{ leaving ? 'Выход...' : 'Выйти из группы' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useChat } from '../composables/useChat';
import { useNotifications } from '../composables/useNotifications';
import { useConfirm } from '../composables/useConfirm';
import FileUpload from './FileUpload.vue';
import { Chat, User } from '../types';
import { getImageUrl } from '../utils/image';
import { getComputedStatus } from '../utils/status';

const props = defineProps<{
  isOpen: boolean;
  chat: Chat;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated', chat: Chat): void;
  (e: 'deleted'): void;
}>();

const router = useRouter();
const chatStore = useChatStore();
const authStore = useAuthStore();
const { searchUsers } = useChat();
const { success: notifySuccess, error: notifyError } = useNotifications();
const { confirm } = useConfirm();

const groupName = ref(props.chat.groupName || '');
const searchQuery = ref('');
const searchResults = ref<User[]>([]);
const updating = ref(false);
const removing = ref(false);
const deleting = ref(false);
const leaving = ref(false);
const avatarPreview = ref<string | null>(null);
const updatingAvatar = ref(false);

const canUpdateName = computed(() => {
  return groupName.value.trim().length > 0 && groupName.value.trim() !== props.chat.groupName;
});

// Обновляем название группы при изменении пропса
watch(() => props.chat.groupName, (newName) => {
  groupName.value = newName || '';
});

const getGroupAvatarUrl = (): string | undefined => {
  if (avatarPreview.value) {
    return getImageUrl(avatarPreview.value);
  }
  return getImageUrl(props.chat.groupAvatar);
};

const getParticipantAvatarUrl = (participant: User): string | undefined => {
  return getImageUrl(participant.avatar);
};

// Обновляем аватар при изменении пропса
watch(() => props.chat.groupAvatar, (newAvatar) => {
  if (!avatarPreview.value) {
    avatarPreview.value = null;
  }
});

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const handleSearch = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      const results = await searchUsers(searchQuery.value.trim());
      // Фильтруем уже добавленных участников
      const participantIds = props.chat.participants.map(p => 
        typeof p === 'string' ? p : p.id
      );
      searchResults.value = results.filter(u => !participantIds.includes(u.id));
    } else {
      searchResults.value = [];
    }
  }, 500);
};

const isAdmin = (participant: User | string): boolean => {
  if (!props.chat.admin) return false;
  const participantId = typeof participant === 'string' ? participant : participant.id;
  const adminId = typeof props.chat.admin === 'string' ? props.chat.admin : props.chat.admin.id;
  return participantId === adminId;
};

const isCurrentUserAdmin = computed((): boolean => {
  if (!authStore.user || !props.chat.admin) return false;
  const adminId = typeof props.chat.admin === 'string' ? props.chat.admin : props.chat.admin.id;
  return authStore.user.id === adminId;
});

const updateGroupName = async (): Promise<void> => {
  if (!canUpdateName.value || updating.value) return;

  updating.value = true;
  try {
    const updatedChat = await chatStore.updateGroupName(props.chat._id, groupName.value.trim());
    notifySuccess('Название группы обновлено');
    emit('updated', updatedChat);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка обновления названия';
    notifyError(errorMsg);
  } finally {
    updating.value = false;
  }
};

const addParticipant = async (user: User): Promise<void> => {
  try {
    const updatedChat = await chatStore.addParticipants(props.chat._id, [user.id]);
    notifySuccess(`${user.username} добавлен в группу`);
    emit('updated', updatedChat);
    searchQuery.value = '';
    searchResults.value = [];
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка добавления участника';
    notifyError(errorMsg);
  }
};

const removeParticipant = async (participant: User | string): Promise<void> => {
  if (removing.value) return;

  const participantId = typeof participant === 'string' ? participant : participant.id;
  const participantName = typeof participant === 'string' ? 'участника' : participant.username;

  const confirmed = await confirm(`Удалить ${participantName} из группы?`);
  if (!confirmed) {
    return;
  }

  removing.value = true;
  try {
    const updatedChat = await chatStore.removeParticipants(props.chat._id, [participantId]);
    notifySuccess(`${participantName} удален из группы`);
    emit('updated', updatedChat);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка удаления участника';
    notifyError(errorMsg);
  } finally {
    removing.value = false;
  }
};

const confirmLeave = async (): Promise<void> => {
  const confirmed = await confirm('Вы уверены, что хотите выйти из группы?');
  if (!confirmed) {
    return;
  }
  leaveGroup();
};

const openChatWithParticipant = async (participant: User | string): Promise<void> => {
  try {
    const participantId = typeof participant === 'string' ? participant : participant.id;
    
    // Проверяем, что это не текущий пользователь
    if (!participantId || participantId === authStore.user?.id) {
      return;
    }

    // Создаем или открываем приватный чат с выбранным участником
    const chat = await chatStore.createChat('private', [participantId]);
    
    // Закрываем модальное окно настроек группы
    emit('close');
    
    // Открываем созданный чат
    router.push(`/chat/${chat._id}`);
  } catch (error: any) {
    console.error('Ошибка создания чата:', error);
    const errorMsg = error.response?.data?.error || 'Ошибка создания чата';
    notifyError(errorMsg);
  }
};

const leaveGroup = async (): Promise<void> => {
  if (leaving.value) return;

  leaving.value = true;
  try {
    await chatStore.leaveGroup(props.chat._id);
    notifySuccess('Вы вышли из группы');
    emit('close');
    emit('deleted');
    // Редирект на главный экран
    router.push('/');
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка выхода из группы';
    notifyError(errorMsg);
  } finally {
    leaving.value = false;
  }
};

const confirmDelete = async (): Promise<void> => {
  const confirmed = await confirm({
    title: 'Удаление группы',
    message: 'Вы уверены, что хотите удалить группу? Это действие нельзя отменить.',
    confirmText: 'Удалить',
    cancelText: 'Отмена'
  });
  if (!confirmed) {
    return;
  }
  deleteGroup();
};

const deleteGroup = async (): Promise<void> => {
  if (deleting.value) return;

  deleting.value = true;
  try {
    await chatStore.deleteChat(props.chat._id);
    notifySuccess('Группа удалена');
    emit('deleted');
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка удаления группы';
    notifyError(errorMsg);
  } finally {
    deleting.value = false;
  }
};

const handleAvatarUploaded = async (data: { url: string; filename: string; type: string }): Promise<void> => {
  avatarPreview.value = data.url;
  updatingAvatar.value = true;
  try {
    const updatedChat = await chatStore.updateGroupAvatar(props.chat._id, data.url);
    notifySuccess('Аватар группы обновлен');
    emit('updated', updatedChat);
    avatarPreview.value = null;
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка обновления аватара';
    notifyError(errorMsg);
    avatarPreview.value = null;
  } finally {
    updatingAvatar.value = false;
  }
};

const handleUploadError = (error: string): void => {
  notifyError(error);
};

const removeAvatar = async (): Promise<void> => {
  const confirmed = await confirm('Удалить аватар группы?');
  if (!confirmed) return;
  updatingAvatar.value = true;
  try {
    const updatedChat = await chatStore.updateGroupAvatar(props.chat._id, '');
    notifySuccess('Аватар группы удален');
    emit('updated', updatedChat);
    avatarPreview.value = null;
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Ошибка удаления аватара';
    notifyError(errorMsg);
  } finally {
    updatingAvatar.value = false;
  }
};

const close = (): void => {
  groupName.value = props.chat.groupName || '';
  searchQuery.value = '';
  searchResults.value = [];
  avatarPreview.value = null;
  emit('close');
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && props.isOpen) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped lang="scss">
.group-settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  @media (max-width: 768px) {
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
  }

  &__content {
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    background: var(--bg-secondary);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @media (max-width: 768px) {
      width: 100%;
      max-width: none;
      height: 100%;
      max-height: none;
      min-height: 100dvh;
      min-height: 100vh;
      border-radius: 0;
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);

    @media (max-width: 768px) {
      padding: 0.75rem;
    }

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.25rem;

      @media (max-width: 768px) {
        font-size: 1.1rem;
      }
    }
  }

  &__close {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;

    &:hover {
      color: var(--text-primary);
    }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (max-width: 768px) {
      padding: 0.75rem;
      gap: 1rem;
    }
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    &--danger {
      border-top: 1px solid var(--border-color);
      padding-top: 1rem;
    }

    h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.1rem;
    }

    h4 {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  &__avatar-section {
    display: flex;
    align-items: center;
    gap: 1.5rem;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
  }

  &__avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid var(--border-color);

    @media (max-width: 768px) {
      width: 240px;
      height: 240px;
			margin-left: auto;
			margin-right: auto;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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
    font-size: 2.5rem;

    @media (max-width: 768px) {
      font-size: 2rem;
    }
  }

  &__avatar-controls {
    display: flex;
    flex-direction: column;
		align-items: center;
    gap: 0.75rem;
		width: 100%;
  }

  &__remove-avatar {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-secondary);
      border-color: var(--text-secondary);
    }
  }

  &__field {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    input {
      flex: 1;
      padding: 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 1rem;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }
    }
  }

  &__button {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    transition: opacity 0.2s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__participants {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  &__participant {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--bg-primary);
    border-radius: 8px;
    gap: 0.75rem;
  }

  &__participant-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;

    &--clickable {
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.7;
      }
    }
  }

  &__participant-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: visible;
    flex-shrink: 0;
    position: relative;

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
    border: 2px solid var(--bg-secondary);
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
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__admin-badge {
    font-size: 0.75rem;
    color: var(--accent-color);
    background: rgba(82, 136, 193, 0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
  }

  &__remove-button {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.2s;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      background: rgba(255, 59, 48, 0.1);
      color: #ff3b30;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__add-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  &__search {
    input {
      width: 100%;
      padding: 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.9rem;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }
    }
  }

  &__search-results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  &__search-result {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-primary);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-secondary);
    }
  }

  &__add-button {
    width: 28px;
    height: 28px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.1);
    }
  }

  &__participants-count {
    margin: 0.5rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__leave-button {
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--bg-secondary);
      border-color: var(--text-secondary);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__delete-button {
    padding: 0.75rem 1.5rem;
    background: #ff3b30;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}
</style>
