<template>
  <Transition name="confirm">
    <div v-if="isOpen" class="confirm-modal" @click.self="handleCancel">
      <div class="confirm-modal__container">
        <div class="confirm-modal__header">
          <h3 class="confirm-modal__title">{{ title }}</h3>
        </div>
        <div class="confirm-modal__body">
          <p class="confirm-modal__message">{{ message }}</p>
        </div>
        <div class="confirm-modal__footer">
          <button
            class="confirm-modal__button confirm-modal__button--cancel"
            @click="handleCancel"
            type="button"
          >
            {{ cancelText }}
          </button>
          <button
            class="confirm-modal__button confirm-modal__button--confirm"
            @click="handleConfirm"
            type="button"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useConfirm } from '../composables/useConfirm';

const { confirmState, resolveConfirm, rejectConfirm } = useConfirm();

const isOpen = computed(() => confirmState.value !== null);
const title = computed(() => confirmState.value?.title || 'Подтверждение');
const message = computed(() => confirmState.value?.message || '');
const confirmText = computed(() => confirmState.value?.confirmText || 'Подтвердить');
const cancelText = computed(() => confirmState.value?.cancelText || 'Отмена');

const handleConfirm = (): void => {
  resolveConfirm(true);
};

const handleCancel = (): void => {
  rejectConfirm(false);
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && isOpen.value) {
    handleCancel();
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
.confirm-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 1rem;
}

.confirm-modal__container {
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.confirm-modal__header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.confirm-modal__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.confirm-modal__body {
  padding: 1.5rem;
  flex: 1;
}

.confirm-modal__message {
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.confirm-modal__footer {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.confirm-modal__button {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  min-width: 100px;

  &--cancel {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
    }
  }

  &--confirm {
    background: var(--accent-color);
    color: white;

    &:hover {
      opacity: 0.9;
    }

    &:active {
      transform: scale(0.98);
    }
  }
}

// Анимации
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-enter-active .confirm-modal__container,
.confirm-leave-active .confirm-modal__container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-from .confirm-modal__container,
.confirm-leave-to .confirm-modal__container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
