<script setup lang="ts">
import { useNotifications } from '../composables/useNotifications';

const { notifications, removeNotification } = useNotifications();
</script>

<template>
  <div class="notification-toast">
    <TransitionGroup name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification-toast__item', `notification-toast__item--${notification.type}`]"
      >
        <span class="notification-toast__message">{{ notification.message }}</span>
        <button @click="removeNotification(notification.id)" class="notification-toast__close">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.notification-toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 400px;
}

.notification-toast__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-left: 4px solid;

  &--success {
    border-color: #34c759;
  }

  &--error {
    border-color: #ff3b30;
  }

  &--info {
    border-color: var(--accent-color);
  }
}

.notification-toast__message {
  color: var(--text-primary);
  flex: 1;
}

.notification-toast__close {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;

  &:hover {
    color: var(--text-primary);
  }
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
