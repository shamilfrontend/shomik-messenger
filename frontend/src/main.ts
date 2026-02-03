import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth.store';

async function initApp() {
  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);

  // Инициализация: загружаем пользователя если есть токен
  const authStore = useAuthStore();
  if (authStore.token) {
    try {
      await authStore.loadUser();
    } catch (error) {
      console.error('Ошибка инициализации пользователя:', error);
    }
  }

  app.mount('#app');
}

initApp();
