import { ref } from 'vue';
import api from '../services/api';

export const useChat = () => {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const searchUsers = async (query: string) => {
    try {
      const response = await api.get('/users/search', { params: { query } });
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Ошибка поиска';
      return [];
    }
  };

  return {
    loading,
    error,
    searchUsers,
  };
};
