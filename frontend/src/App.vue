<script setup lang="ts">
import { onMounted } from 'vue';

import { useAuthStore } from './stores/auth.store';
import { useUnreadTitle } from './composables/useUnreadTitle';
import NotificationToast from './components/NotificationToast.vue';
import ConfirmModal from './components/ConfirmModal.vue';

const authStore = useAuthStore();

useUnreadTitle();

onMounted(async () => {
  // Загружаем пользователя при монтировании, если есть токен
  if (authStore.token && !authStore.user) {
    await authStore.loadUser();
  }
});
</script>

<template>
  <router-view />
  <NotificationToast />
  <ConfirmModal />
</template>

<style lang="scss">
@use './styles/main.scss';
</style>
