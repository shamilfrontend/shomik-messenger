import { ref } from 'vue';
import { useChatStore } from '../stores/chat.store';
import api from '../services/api';

export const useChat = () => {
  const chatStore = useChatStore();
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

  const addContact = async (contactId: string): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      await api.post('/users/contacts', { contactId });
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Ошибка добавления контакта';
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    searchUsers,
    addContact
  };
};
