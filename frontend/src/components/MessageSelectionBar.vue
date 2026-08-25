<script setup lang="ts">
defineProps<{
  count: number;
}>();

defineEmits<{
  (e: 'delete'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <div class="chat-window__selection-bar">
    <button
      type="button"
      class="chat-window__selection-bar-delete"
      :disabled="count === 0"
      @click="$emit('delete')"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
      Удалить выбранные ({{ count }})
    </button>
    <button type="button" class="chat-window__selection-bar-cancel" @click="$emit('cancel')">
      Отмена
    </button>
  </div>
</template>

<style scoped lang="scss">
.chat-window {
  &__selection-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  &__selection-bar-delete {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__selection-bar-cancel {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-primary);
    }
  }
}
</style>
