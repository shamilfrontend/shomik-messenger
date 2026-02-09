<script setup lang="ts">
import { useRouter } from 'vue-router';
import ProfileSettings from '../components/ProfileSettings.vue';

const router = useRouter();

const handleBack = (): void => {
  router.push('/');
};
</script>

<template>
  <div class="profile-view">
    <div class="profile-view__header">
      <button @click="handleBack" class="profile-view__back">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1>Профиль</h1>
    </div>
    <ProfileSettings :show-header="false" />
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);

  &__header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);

    @media (max-width: 768px) {
      padding: 0.75rem;
    }
  }

  &__back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 50%;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-primary);
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  h1 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;

    @media (max-width: 768px) {
      font-size: 1.1rem;
    }
  }
}
</style>
