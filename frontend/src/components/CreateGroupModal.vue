<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

import { useChat } from '../composables/useChat';
import { useChatStore } from '../stores/chat.store';
import { useNotifications } from '../composables/useNotifications';
import type { User } from '../types';
import { getImageUrl } from '../utils/image';
import { isUserOnline, getComputedStatus } from '../utils/status';

const props = defineProps<{
	isOpen: boolean;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'created', chatId: string): void;
}>();

const chatStore = useChatStore();
const { searchUsers, loading, error } = useChat();
const { success: notifySuccess, error: notifyError } = useNotifications();

const groupName = ref('');
const searchQuery = ref('');
const searchResults = ref<User[]>([]);
const selectedParticipants = ref<User[]>([]);
const creating = ref(false);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const canCreate = computed(() => {
	return groupName.value.trim().length > 0 && selectedParticipants.value.length > 0 && !creating.value;
});

const handleSearch = (): void => {
	if (searchTimeout) {
		clearTimeout(searchTimeout);
	}

	searchTimeout = setTimeout(async () => {
		if (searchQuery.value.trim()) {
			const results = await searchUsers(searchQuery.value.trim());
			searchResults.value = results.filter((u: unknown) => !isSelected(u.id));
		} else {
			searchResults.value = [];
		}
	}, 500);
};

const toggleParticipant = (user: User): void => {
	const index = selectedParticipants.value.findIndex(p => p.id === user.id);
	if (index === -1) {
		selectedParticipants.value.push(user);
	} else {
		selectedParticipants.value.splice(index, 1);
	}
};

const removeParticipant = (userId: string): void => {
	selectedParticipants.value = selectedParticipants.value.filter(p => p.id !== userId);
};

const isSelected = (userId: string): boolean => {
	return selectedParticipants.value.some(p => p.id === userId);
};

const createGroup = async (): Promise<void> => {
	if (!canCreate.value) return;

	creating.value = true;

	const participantIds = selectedParticipants.value.map(p => p.id);

	try {
		const chat = await chatStore.createChat('group', participantIds, groupName.value.trim());

		notifySuccess(`Группа "${groupName.value.trim()}" создана!`);
		emit('created', chat._id);
		close();
	} catch (err: any) {
		const errorMsg = err.response?.data?.error || 'Ошибка создания группы';
		notifyError(errorMsg);
	} finally {
		creating.value = false;
	}
};

const close = (): void => {
	groupName.value = '';
	searchQuery.value = '';
	searchResults.value = [];
	selectedParticipants.value = [];
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

<template>
  <div v-if="isOpen" class="create-group-modal" @click.self="close">
    <div class="create-group-modal__content">
      <div class="create-group-modal__header">
        <h2>Создать группу</h2>
        <button class="create-group-modal__close" @click="close">×</button>
      </div>

      <div class="create-group-modal__body">
        <div class="create-group-modal__field">
          <label>Название группы</label>
          <input
            v-model="groupName"
            type="text"
            placeholder="Введите название группы"
            maxlength="50"
          />
        </div>

        <div class="create-group-modal__field">
          <label>Поиск участников</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Поиск пользователей..."
            @input="handleSearch"
          />
        </div>

        <div v-if="loading" class="create-group-modal__loading">Загрузка...</div>

        <div v-else-if="searchResults.length > 0" class="create-group-modal__results">
          <div
            v-for="user in searchResults"
            :key="user.id"
            :class="['create-group-modal__user', { 'create-group-modal__user--selected': isSelected(user.id) }]"
            @click="toggleParticipant(user)"
          >
            <div class="create-group-modal__user-avatar">
              <img v-if="getImageUrl(user.avatar)" :src="getImageUrl(user.avatar)" :alt="user.username" />
              <div v-else class="create-group-modal__user-avatar-placeholder">
                {{ user.username.charAt(0).toUpperCase() }}
              </div>
              <span
                :class="['create-group-modal__status-indicator', `create-group-modal__status-indicator--${getComputedStatus(user)}`]"
              ></span>
            </div>
            <div class="create-group-modal__user-info">
              <span class="create-group-modal__user-name">{{ user.username }}</span>
              <span class="create-group-modal__user-status">{{ isUserOnline(user) ? 'в сети' : 'не в сети' }}</span>
            </div>
            <div v-if="isSelected(user.id)" class="create-group-modal__user-check">✓</div>
          </div>
        </div>

        <div v-if="selectedParticipants.length > 0" class="create-group-modal__selected">
          <h3>Выбранные участники ({{ selectedParticipants.length }})</h3>
          <div class="create-group-modal__selected-list">
            <div
              v-for="user in selectedParticipants"
              :key="user.id"
              class="create-group-modal__selected-item"
            >
              <span>{{ user.username }}</span>
              <button @click="removeParticipant(user.id)" class="create-group-modal__remove">×</button>
            </div>
          </div>
        </div>

        <div v-if="error" class="create-group-modal__error">{{ error }}</div>
      </div>

      <div class="create-group-modal__footer">
        <button @click="close" class="create-group-modal__cancel">Отмена</button>
        <button @click="createGroup" :disabled="!canCreate" class="create-group-modal__create">
          Создать
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.create-group-modal {
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

  &__content {
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    background: var(--bg-secondary);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @media (max-width: 768px) {
      width: 95%;
      max-width: none;
      max-height: 90vh;
      border-radius: 8px;
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
    gap: 1rem;

    @media (max-width: 768px) {
      padding: 0.75rem;
      gap: 0.75rem;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    input {
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

  &__loading,
  &__error {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  &__error {
    color: #ff3b30;
  }

  &__results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  &__user {
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

    &--selected {
      background: rgba(82, 136, 193, 0.2);
      border: 1px solid var(--accent-color);
    }
  }

  &__user-avatar {
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

  &__user-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
		border-radius: 50%;
  }

  &__user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__user-name {
    color: var(--text-primary);
    font-weight: 600;
  }

  &__user-status {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  &__user-check {
    color: var(--accent-color);
    font-size: 1.25rem;
  }

  &__selected {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);

    h3 {
      margin: 0 0 0.5rem 0;
      color: var(--text-primary);
      font-size: 1rem;
    }
  }

  &__selected-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  &__selected-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 20px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  &__remove {
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;

    &:hover {
      color: var(--text-primary);
    }
  }

  &__footer {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);

    @media (max-width: 768px) {
      padding: 0.75rem;
      gap: 0.375rem;
    }
  }

  &__cancel,
  &__create {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  &__cancel {
    background: var(--bg-primary);
    color: var(--text-primary);

    &:hover {
      opacity: 0.8;
    }
  }

  &__create {
    background: var(--accent-color);
    color: white;

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
