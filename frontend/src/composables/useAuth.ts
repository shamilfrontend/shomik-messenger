import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import { authService } from '../services/auth.service';
import { useNotifications } from './useNotifications';

export const useAuth = () => {
  const router = useRouter();
  const authStore = useAuthStore();
  const { error: notifyError, success: notifySuccess } = useNotifications();
  const loading = ref(false);
  const error = ref<string | null>(null);

  const register = async (username: string, email: string, password: string): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const response = await authService.register(username, email, password);
      authStore.setAuth(response.token, response.user);
      notifySuccess('Регистрация успешна!');
      router.push('/');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Ошибка регистрации';
      error.value = errorMsg;
      notifyError(errorMsg);
    } finally {
      loading.value = false;
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const response = await authService.login(username, password);
      authStore.setAuth(response.token, response.user);
      notifySuccess('Вход выполнен успешно!');
      router.push('/');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Ошибка входа';
      error.value = errorMsg;
      notifyError(errorMsg);
    } finally {
      loading.value = false;
    }
  };

  const logout = (): void => {
    authStore.logout();
    router.push('/login');
  };

  return {
    loading,
    error,
    register,
    login,
    logout
  };
};
