<script setup lang="ts">
import { computed } from 'vue';
import type { TaskItem } from '../stores/sidebar.store';

const props = defineProps<{
  tasks: TaskItem[];
  search: string;
  activeId?: string;
  enabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', task: TaskItem): void;
}>();

const formatTaskDueDate = (date: Date): string => {
  const d = new Date(date);
  const now = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / 86400000);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  if (days === -1) return 'Вчера';
  if (days > 0 && days < 7) return `Через ${days} дн.`;
  if (days < 0) return `${Math.abs(days)} дн. назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const filteredTasks = computed(() => {
  if (!props.search) return props.tasks;
  const query = props.search.toLowerCase();
  return props.tasks.filter((task) => (
    task.title.toLowerCase().includes(query)
    || (task.description || '').toLowerCase().includes(query)
  ));
});
</script>

<template>
  <div v-if="!enabled" class="chat-list__tasks-disabled">
    <p class="chat-list__tasks-disabled-text">Раздел «Задачи» отключён.</p>
    <router-link to="/profile/advanced-features" class="chat-list__tasks-disabled-link">Включить в настройках</router-link>
  </div>
  <template v-else>
    <div
      v-for="task in filteredTasks"
      :key="task.id"
      :class="['chat-list__item', 'chat-list__item--task', { 'chat-list__item--active': activeId === task.id, 'chat-list__item--completed': task.completed }]"
      @click="emit('select', task)"
    >
      <div class="chat-list__task-checkbox">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="task.completed" d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      </div>
      <div class="chat-list__content">
        <div class="chat-list__header-row">
          <span :class="['chat-list__name', { 'chat-list__name--completed': task.completed }]">
            {{ task.title }}
          </span>
          <span
            v-if="task.dueDate"
            :class="['chat-list__task-due', { 'chat-list__task-due--overdue': !task.completed && new Date(task.dueDate) < new Date() }]"
          >
            {{ formatTaskDueDate(task.dueDate) }}
          </span>
        </div>
        <div v-if="task.description" class="chat-list__task-description">
          {{ task.description }}
        </div>
        <div class="chat-list__task-meta">
          <span :class="['chat-list__task-priority', `chat-list__task-priority--${task.priority}`]">
            {{ task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий' }}
          </span>
        </div>
      </div>
    </div>
  </template>
</template>
