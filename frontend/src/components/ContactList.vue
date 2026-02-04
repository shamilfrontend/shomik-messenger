<template>
  <div class="contact-list">
    <div class="contact-list__header">
      <h2>Контакты</h2>
      <button @click="$emit('close')" class="contact-list__close" title="Закрыть">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="contact-list__search">
      <input
        v-model="searchQuery"
        @input="handleSearch"
        type="text"
        placeholder="Поиск пользователей..."
      />
    </div>

    <div v-if="error" class="contact-list__error">{{ error }}</div>
    <div v-else-if="showSkeleton" class="contact-list__items">
      <div
        v-for="i in 5"
        :key="`skeleton-${i}`"
        class="contact-list__item contact-list__item--skeleton"
      >
        <div class="contact-list__avatar contact-list__skeleton-avatar"></div>
        <div class="contact-list__content">
          <div class="contact-list__skeleton-name"></div>
          <div class="contact-list__skeleton-status"></div>
        </div>
        <div class="contact-list__skeleton-button"></div>
      </div>
    </div>
    <div v-else-if="searchQuery.trim() && !loading && searchResults.length === 0" class="contact-list__empty">
      Пользователи не найдены
    </div>
    <div v-else-if="!searchQuery.trim()" class="contact-list__empty">
      Введите имя пользователя для поиска
    </div>
    <div v-else class="contact-list__items">
      <div
        v-for="user in searchResults"
        :key="user.id"
        @click="selectUser(user)"
        class="contact-list__item"
      >
        <div class="contact-list__avatar">
          <img v-if="getAvatarUrl(user)" :src="getAvatarUrl(user)" :alt="user.username" />
          <div v-else class="contact-list__avatar-placeholder">
            {{ user.username.charAt(0).toUpperCase() }}
          </div>
          <span
            :class="['contact-list__status-indicator', `contact-list__status-indicator--${getComputedStatus(user)}`]"
          ></span>
        </div>
        <div class="contact-list__content">
          <div class="contact-list__name">{{ user.username }}</div>
          <div class="contact-list__status">
            <span :class="['contact-list__status-dot', `contact-list__status-dot--${getComputedStatus(user)}`]"></span>
            {{ isUserOnline(user) ? 'в сети' : 'не в сети' }}
          </div>
        </div>
        <button 
          @click.stop="addContact(user.id)" 
          :disabled="addingContact === user.id"
          class="contact-list__add-button"
          :class="{ 'contact-list__add-button--loading': addingContact === user.id }"
        >
          <span v-if="addingContact === user.id">...</span>
          <span v-else>+</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useChat } from '../composables/useChat';
import { useNotifications } from '../composables/useNotifications';
import { User } from '../types';
import { getImageUrl } from '../utils/image';
import { isUserOnline, getComputedStatus } from '../utils/status';

const emit = defineEmits<{
  (e: 'select-user', user: User): void;
  (e: 'close'): void;
}>();

const { searchUsers, loading, error, addContact: addContactToBackend } = useChat();
const { success: notifySuccess, error: notifyError } = useNotifications();
const searchQuery = ref('');
const searchResults = ref<User[]>([]);
const showSkeleton = ref(false);
const isLoading = ref(false);
const addingContact = ref<string | null>(null);

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

const getAvatarUrl = (user: User): string | undefined => {
  return getImageUrl(user.avatar);
};

const selectUser = (user: User): void => {
  emit('select-user', user);
};

const addContact = async (userId: string): Promise<void> => {
  if (addingContact.value === userId) {
    return; // Предотвращаем повторные клики
  }

  addingContact.value = userId;
  try {
    await addContactToBackend(userId);
    notifySuccess('Контакт успешно добавлен');
    // Удаляем пользователя из списка результатов после успешного добавления
    searchResults.value = searchResults.value.filter(user => user.id !== userId);
  } catch (err: any) {
    const errorMessage = err.response?.data?.error || 'Ошибка добавления контакта';
    notifyError(errorMessage);
  } finally {
    addingContact.value = null;
  }
};
</script>

<style scoped lang="scss">
.contact-list {
  width: 350px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);

  @media (max-width: 768px) {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
  }

  &__header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;

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
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
    flex-shrink: 0;

    svg {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__search {
    padding: 0.75rem;

    input {
      width: 100%;
      padding: 0.5rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      color: var(--text-primary);
      font-size: 0.9rem;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }
    }
  }

  &__error {
    padding: 1rem;
    text-align: center;
    color: #ff3b30;
  }

  &__empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__items {
    flex: 1;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid var(--border-color);

    @media (max-width: 768px) {
      padding: 0.625rem;
      gap: 0.5rem;
    }

    &:hover {
      background: var(--bg-primary);
    }
  }

  &__avatar {
    width: 50px;
    height: 50px;
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
    width: 12px;
    height: 12px;
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

  &__avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 1.25rem;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  &__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-secondary);

    &--online {
      background: #34c759;
    }
  }

  &__add-button {
    width: 32px;
    height: 32px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      transform: scale(1.1);
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &--loading {
      opacity: 0.7;
    }
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

  &__skeleton-button {
    width: 32px;
    height: 32px;
    background: linear-gradient(90deg, var(--bg-primary) 25%, var(--bg-secondary) 50%, var(--bg-primary) 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__item--skeleton {
    cursor: default;
    pointer-events: none;

    &:hover {
      background: transparent;
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
