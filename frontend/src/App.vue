<template>
  <router-view />
  <NotificationToast />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { useAuthStore } from './stores/auth.store';
import NotificationToast from './components/NotificationToast.vue';

const authStore = useAuthStore();

onMounted(async () => {
  // Загружаем пользователя при монтировании, если есть токен
  if (authStore.token && !authStore.user) {
    await authStore.loadUser();
  }
});
</script>

<style lang="scss">
@import './styles/main.scss';
</style>
