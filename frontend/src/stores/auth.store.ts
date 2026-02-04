import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { User } from '../types';
import { authService } from '../services/auth.service';
import websocketService from '../services/websocket';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('token'));
  const isLoading = ref(false);
  // Проверяем только токен, так как пользователь загружается асинхронно
  const isAuthenticated = computed(() => !!token.value);

  const setAuth = (authToken: string, userData: User): void => {
    token.value = authToken;
    user.value = userData;
    localStorage.setItem('token', authToken);
    websocketService.connect(authToken).catch(console.error);
  };

  const logout = (): void => {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    websocketService.disconnect();
  };

  const loadUser = async (): Promise<void> => {
    if (token.value && !isLoading.value) {
      isLoading.value = true;
      try {
        const userData = await authService.getMe();
        user.value = userData;
        await websocketService.connect(token.value);
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        logout();
      } finally {
        isLoading.value = false;
      }
    }
  };

  const updateUser = (updatedUser: User): void => {
    if (user.value && user.value.id === updatedUser.id) {
      user.value = updatedUser;
    }
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    setAuth,
    logout,
    loadUser,
    updateUser
  };
});
