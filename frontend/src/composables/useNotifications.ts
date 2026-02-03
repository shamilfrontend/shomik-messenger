import { ref } from 'vue';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

const notifications = ref<Notification[]>([]);

export const useNotifications = () => {
  const addNotification = (message: string, type: Notification['type'] = 'info', duration = 3000): void => {
    const id = Date.now().toString();
    const notification: Notification = { id, message, type, duration };

    notifications.value.push(notification);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id: string): void => {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  };

  const success = (message: string, duration?: number): void => {
    addNotification(message, 'success', duration);
  };

  const error = (message: string, duration?: number): void => {
    addNotification(message, 'error', duration);
  };

  const info = (message: string, duration?: number): void => {
    addNotification(message, 'info', duration);
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    info
  };
};
