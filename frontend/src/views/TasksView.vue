<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const props = defineProps<{
  selectedTask: Task | null | undefined;
  taskId?: string;
  isNewTask?: boolean;
  isTasksPage?: boolean;
}>();

const router = useRouter();

const formatDate = (date: Date): string => {
  const d = new Date(date);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDueDate = (date: Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Сегодня';
  } if (days === 1) {
    return 'Завтра';
  } if (days === -1) {
    return 'Вчера';
  } if (days > 0 && days < 7) {
    return `Через ${days} дн.`;
  } if (days < 0) {
    return `${Math.abs(days)} дн. назад`;
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getPriorityLabel = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'Высокий';
    case 'medium':
      return 'Средний';
    case 'low':
      return 'Низкий';
    default:
      return priority;
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high':
      return '#ff4d4f';
    case 'medium':
      return '#faad14';
    case 'low':
      return '#52c41a';
    default:
      return 'var(--text-secondary)';
  }
};
</script>

<template>
  <div class="tasks-view">
    <div class="tasks-view__content">
      <div v-if="props.isNewTask || (!props.selectedTask && props.isTasksPage)" class="tasks-view__new-task">
        <div class="tasks-view__empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <h2>Создать новую задачу</h2>
          <p>Нажмите на кнопку создания задачи в боковом меню</p>
        </div>
      </div>
      <div v-else-if="!props.selectedTask" class="tasks-view__empty-state">
        <p class="tasks-view__empty">{{ props.selectedTask === undefined ? 'Выберите задачу из списка' : 'Задача не найдена' }}</p>
      </div>
      <div v-else class="tasks-view__details">
        <div class="tasks-view__details-header">
          <div class="tasks-view__details-title-row">
            <div class="tasks-view__details-checkbox">
              <svg
                v-if="props.selectedTask.completed"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              <svg
                v-else
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
            </div>
            <h2 :class="['tasks-view__details-title', { 'tasks-view__details-title--completed': props.selectedTask.completed }]">
              {{ props.selectedTask.title }}
            </h2>
          </div>
          <div v-if="props.selectedTask.description" class="tasks-view__details-description">
            {{ props.selectedTask.description }}
          </div>
        </div>

        <div class="tasks-view__details-info">
          <div class="tasks-view__info-item">
            <span class="tasks-view__info-label">Приоритет:</span>
            <span
              class="tasks-view__info-value tasks-view__info-value--priority"
              :style="{ color: getPriorityColor(props.selectedTask.priority) }"
            >
              {{ getPriorityLabel(props.selectedTask.priority) }}
            </span>
          </div>
          <div v-if="props.selectedTask.dueDate" class="tasks-view__info-item">
            <span class="tasks-view__info-label">Срок выполнения:</span>
            <span
              class="tasks-view__info-value"
              :class="{ 'tasks-view__info-value--overdue': !props.selectedTask.completed && new Date(props.selectedTask.dueDate) < new Date() }"
            >
              {{ formatDueDate(props.selectedTask.dueDate) }}
            </span>
          </div>
          <div class="tasks-view__info-item">
            <span class="tasks-view__info-label">Статус:</span>
            <span class="tasks-view__info-value">
              {{ props.selectedTask.completed ? 'Выполнена' : 'В работе' }}
            </span>
          </div>
          <div class="tasks-view__info-item">
            <span class="tasks-view__info-label">Создана:</span>
            <span class="tasks-view__info-value">
              {{ formatDate(props.selectedTask.createdAt) }}
            </span>
          </div>
          <div class="tasks-view__info-item">
            <span class="tasks-view__info-label">Обновлена:</span>
            <span class="tasks-view__info-value">
              {{ formatDate(props.selectedTask.updatedAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tasks-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;

    @media (max-width: 768px) {
      padding: 1rem;
    }
  }

  &__new-task {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  &__empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);

    svg {
      color: var(--text-secondary);
      opacity: 0.5;
      margin-bottom: 1rem;
    }

    h2 {
      margin: 0.5rem 0;
      color: var(--text-primary);
      font-size: 1.5rem;
    }

    p {
      margin: 0.5rem 0 0;
      font-size: 0.95rem;
    }
  }

  &__empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  &__details {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  &__details-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__details-title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__details-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    color: var(--text-secondary);

    svg {
      width: 32px;
      height: 32px;
    }
  }

  &__details-title {
    margin: 0;
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 600;
    flex: 1;

    @media (max-width: 768px) {
      font-size: 1.5rem;
      padding-right: 4rem;
    }

    &--completed {
      text-decoration: line-through;
      opacity: 0.6;
    }
  }

  &__details-description {
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.6;
    margin-top: 0.5rem;
  }

  &__details-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
  }

  &__info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);

    &:last-child {
      border-bottom: none;
    }
  }

  &__info-label {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__info-value {
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;

    &--priority {
      font-weight: 600;
    }

    &--overdue {
      color: #ff4d4f;
    }
  }
}
</style>
