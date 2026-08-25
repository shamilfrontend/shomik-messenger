import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface CallHistory {
  id: string;
  type: 'incoming' | 'outgoing';
  callType: 'audio' | 'video';
  status: 'answered' | 'missed' | 'rejected';
  participant: { id: string; username: string; avatar?: string };
  participantsCount?: number;
  participants?: Array<{ id: string; username: string; avatar?: string }>;
  chatId?: string;
  duration?: number;
  createdAt: Date;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const extraCalls: CallHistory[] = Array.from({ length: 40 }, (_, i) => {
  const id = i + 11;
  const daysAgo = (i % 30) + 9;
  const types: Array<CallHistory['type']> = ['incoming', 'outgoing'];
  const callTypes: Array<CallHistory['callType']> = ['audio', 'video'];
  const statuses: Array<CallHistory['status']> = ['answered', 'missed', 'rejected'];
  const names = [
    'Андрей Кузнецов', 'Наталья Федорова', 'Владимир Орлов', 'Екатерина Семенова',
    'Михаил Лебедев', 'Юлия Новикова', 'Александр Морозов', 'Ольга Петрова',
  ];
  const type = types[i % types.length];
  const callType = callTypes[i % callTypes.length];
  const status = statuses[i % statuses.length];
  const name = names[i % names.length];
  return {
    id: String(id),
    type,
    callType,
    status,
    participant: { id: String(id + 100), username: name },
    chatId: `chat${id}`,
    duration: status === 'answered' ? 120 + i * 10 : undefined,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  };
});

const initialCalls: CallHistory[] = [
  {
    id: '1',
    type: 'incoming',
    callType: 'video',
    status: 'answered',
    participant: { id: '2', username: 'Анна Петрова' },
    chatId: 'chat1',
    duration: 1250,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '2',
    type: 'outgoing',
    callType: 'audio',
    status: 'answered',
    participant: { id: '3', username: 'Иван Сидоров' },
    chatId: 'chat2',
    duration: 340,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  ...extraCalls,
];

const initialTasks: TaskItem[] = [
  {
    id: '1',
    title: 'Завершить проект мессенджера',
    description: 'Добавить финальные функции и провести тестирование',
    completed: false,
    priority: 'high',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    title: 'Обновить документацию',
    completed: false,
    priority: 'medium',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    title: 'Исправить баги в чате',
    completed: true,
    priority: 'high',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

export const useSidebarStore = defineStore('sidebar', () => {
  const callsHistory = ref<CallHistory[]>(initialCalls);
  const tasks = ref<TaskItem[]>(initialTasks);

  const getCallById = (callId: string): CallHistory | undefined => (
    callsHistory.value.find((call) => call.id === callId)
  );

  const getTaskById = (taskId: string): TaskItem | undefined => (
    tasks.value.find((task) => task.id === taskId)
  );

  return {
    callsHistory,
    tasks,
    getCallById,
    getTaskById,
    getCallsHistory: () => callsHistory.value,
    getTasks: () => tasks.value,
  };
});
