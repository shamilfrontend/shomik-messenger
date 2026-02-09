<script setup lang="ts">
import {
  ref, watch, nextTick, onMounted, onUnmounted,
} from 'vue';
import { useChat } from '../composables/useChat';
import { User } from '../types';
import { getImageUrl } from '../utils/image';
import { isUserOnline, getComputedStatus } from '../utils/status';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{(e: 'select-user', user: User): void;
  (e: 'close'): void;
}>();

const { searchUsers, loading, error } = useChat();
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const searchResults = ref<User[]>([]);
const showSkeleton = ref(false);
const isLoading = ref(false);

watch(() => props.isOpen, (open) => {
  if (open) {
    nextTick(() => searchInputRef.value?.focus());
  }
});

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let skeletonTimeout: ReturnType<typeof setTimeout> | null = null;

const handleSearch = (): void => {
  // Очищаем предыдущие таймеры
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  if (skeletonTimeout) {
    clearTimeout(skeletonTimeout);
  }

  // Если поле пустое, скрываем скелетон и результаты
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    showSkeleton.value = false;
    isLoading.value = false;
    return;
  }

  // Скрываем скелетон при новом вводе
  showSkeleton.value = false;
  isLoading.value = false;

  // Выполняем поиск через 500 мс
  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      isLoading.value = true;

      // Показываем скелетон через 1500 мс после начала загрузки
      skeletonTimeout = setTimeout(() => {
        if (isLoading.value) {
          showSkeleton.value = true;
        }
      }, 1500);

      try {
        const results = await searchUsers(searchQuery.value.trim());
        searchResults.value = results;
      } finally {
        isLoading.value = false;
        showSkeleton.value = false;
        if (skeletonTimeout) {
          clearTimeout(skeletonTimeout);
        }
      }
    } else {
      searchResults.value = [];
      showSkeleton.value = false;
      isLoading.value = false;
    }
  }, 500);
};

const getAvatarUrl = (user: User): string | undefined => getImageUrl(user.avatar);

const selectUser = (user: User): void => {
  emit('select-user', user);
  close();
};

const close = (): void => {
  searchQuery.value = '';
  searchResults.value = [];
  showSkeleton.value = false;
  isLoading.value = false;
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
  <div v-if="isOpen" class="new-chat-modal" @click.self="close">
    <div class="new-chat-modal__content">
      <div class="new-chat-modal__header">
        <h2>Новый чат</h2>
        <button class="new-chat-modal__close" @click="close">×</button>
      </div>

      <div class="new-chat-modal__body">
        <div class="new-chat-modal__field">
          <label>Поиск пользователей</label>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            @input="handleSearch"
            type="text"
            placeholder="Поиск пользователей..."
          />
        </div>

        <div v-if="error" class="new-chat-modal__error">{{ error }}</div>
        <div v-else-if="showSkeleton" class="new-chat-modal__results">
          <div
            v-for="i in 5"
            :key="`skeleton-${i}`"
            class="new-chat-modal__user new-chat-modal__user--skeleton"
          >
            <div class="new-chat-modal__user-avatar new-chat-modal__skeleton-avatar"></div>
            <div class="new-chat-modal__user-info">
              <div class="new-chat-modal__skeleton-name"></div>
              <div class="new-chat-modal__skeleton-status"></div>
            </div>
          </div>
        </div>
        <div v-else-if="searchQuery.trim() && !loading && searchResults.length === 0" class="new-chat-modal__empty">
          Пользователи не найдены
        </div>
        <div v-else-if="!searchQuery.trim()" class="new-chat-modal__empty">
          Введите имя пользователя для поиска
        </div>
        <div v-else class="new-chat-modal__results">
          <div
            v-for="user in searchResults"
            :key="user.id"
            @click="selectUser(user)"
            class="new-chat-modal__user"
          >
            <div class="new-chat-modal__user-avatar">
              <img v-if="getAvatarUrl(user)" :src="getAvatarUrl(user)" :alt="user.username" />
              <div v-else class="new-chat-modal__user-avatar-placeholder">
                {{ user.username.charAt(0).toUpperCase() }}
              </div>
              <span
                :class="['new-chat-modal__status-indicator', `new-chat-modal__status-indicator--${getComputedStatus(user)}`]"
              ></span>
            </div>
            <div class="new-chat-modal__user-info">
              <span class="new-chat-modal__user-name">{{ user.username }}</span>
              <span class="new-chat-modal__user-status">{{ isUserOnline(user) ? 'в сети' : 'не в сети' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="new-chat-modal__footer">
        <button @click="close" class="new-chat-modal__cancel">Отмена</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.new-chat-modal {
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

  &__empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
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

    &--skeleton {
      cursor: default;
      pointer-events: none;

      &:hover {
        background: var(--bg-primary);
      }
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

  &__skeleton-avatar {
    background: linear-gradient(90deg, var(--bg-primary) 25%, var(--bg-secondary) 50%, var(--bg-primary) 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  &__skeleton-name {
    height: 16px;
    width: 60%;
    background: linear-gradient(90deg, var(--bg-primary) 25%, var(--bg-secondary) 50%, var(--bg-primary) 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  &__skeleton-status {
    height: 12px;
    width: 40%;
    background: linear-gradient(90deg, var(--bg-primary) 25%, var(--bg-secondary) 50%, var(--bg-primary) 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: 4px;
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

  &__cancel {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;
    background: var(--bg-primary);
    color: var(--text-primary);

    &:hover {
      opacity: 0.8;
    }
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
