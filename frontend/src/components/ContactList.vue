<template>
  <div class="contact-list">
    <div class="contact-list__header">
      <h2>Контакты</h2>
    </div>

    <div class="contact-list__search">
      <input
        v-model="searchQuery"
        @input="handleSearch"
        type="text"
        placeholder="Поиск пользователей..."
      />
    </div>

    <div v-if="loading" class="contact-list__loading">Загрузка...</div>
    <div v-else-if="error" class="contact-list__error">{{ error }}</div>
    <div v-else class="contact-list__items">
      <div
        v-for="user in searchResults"
        :key="user.id"
        @click="selectUser(user)"
        class="contact-list__item"
      >
        <div class="contact-list__avatar">
          <img v-if="user.avatar" :src="user.avatar" :alt="user.username" />
          <div v-else class="contact-list__avatar-placeholder">
            {{ user.username.charAt(0).toUpperCase() }}
          </div>
        </div>
        <div class="contact-list__content">
          <div class="contact-list__name">{{ user.username }}</div>
          <div class="contact-list__status">
            <span :class="['contact-list__status-dot', `contact-list__status-dot--${user.status}`]"></span>
            {{ user.status === 'online' ? 'в сети' : 'не в сети' }}
          </div>
        </div>
        <button @click.stop="addContact(user.id)" class="contact-list__add-button">+</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useChat } from '../composables/useChat';
import { User } from '../types';

const emit = defineEmits<{
  (e: 'select-user', user: User): void;
}>();

const { searchUsers, loading, error, addContact: addContactToBackend } = useChat();
const searchQuery = ref('');
const searchResults = ref<User[]>([]);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const handleSearch = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      const results = await searchUsers(searchQuery.value.trim());
      searchResults.value = results;
    } else {
      searchResults.value = [];
    }
  }, 500);
};

const selectUser = (user: User): void => {
  emit('select-user', user);
};

const addContact = async (userId: string): Promise<void> => {
  await addContactToBackend(userId);
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

  &__header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.25rem;
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

  &__loading,
  &__error {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  &__error {
    color: #ff3b30;
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

    &:hover {
      background: var(--bg-primary);
    }
  }

  &__avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;

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
    transition: transform 0.2s;
    flex-shrink: 0;

    &:hover {
      transform: scale(1.1);
    }
  }
}
</style>
