<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ProfileSettings from '../components/ProfileSettings.vue';
import ProfileDesign from '../components/ProfileDesign.vue';
import ProfileAudioVideo from '../components/ProfileAudioVideo.vue';
import ProfileAdvancedFeatures from '../components/ProfileAdvancedFeatures.vue';

const props = defineProps<{
  section?: string | null;
}>();

const router = useRouter();
const route = useRoute();
const isMobile = ref(window.innerWidth <= 768);

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

const handleClose = (): void => {
  // На мобильных при закрытии "Мой профиль" открываем список подпунктов профиля
  if (isMobile.value) {
    router.push('/profile');
  } else {
    router.push('/');
  }
};

const showCloseButton = computed(() => {
  // Показываем кнопку закрытия на мобильных для секции "Мой профиль"
  return isMobile.value && (!props.section || props.section === 'me');
});

onMounted(() => {
  window.addEventListener('resize', handleResize);
  handleResize();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="profile-view">
    <!-- Кнопка закрытия для мобильных устройств -->
    <button
      v-if="isMobile && (!props.section || props.section === 'me')"
      class="profile-view__close"
      @click.stop="handleClose"
      type="button"
      aria-label="Закрыть"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div class="profile-view__content">
      <div v-if="!section || section === 'me'" class="profile-view__section">
        <ProfileSettings :show-header="false" />
      </div>
      <div v-else-if="section === 'design'" class="profile-view__section">
        <ProfileDesign />
      </div>
      <div v-else-if="section === 'audio-and-video'" class="profile-view__section">
        <ProfileAudioVideo />
      </div>
      <div v-else-if="section === 'language'" class="profile-view__section">
        <p class="profile-view__placeholder">Раздел в разработке</p>
      </div>
      <div v-else-if="section === 'sessions'" class="profile-view__section">
        <p class="profile-view__placeholder">Раздел в разработке</p>
      </div>
      <div v-else-if="section === 'advanced-features'" class="profile-view__section">
        <ProfileAdvancedFeatures />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  position: relative;

  &__content {
    flex: 1;
    overflow-y: auto;
  }

  &__section {
    padding: 1rem;
  }

  &__placeholder {
    color: var(--text-secondary);
    font-size: 0.95rem;
    text-align: center;
    padding: 2rem;
  }

  &__close {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1002;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-primary);
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    @media (min-width: 769px) {
      display: none;
    }

    &:hover {
      background: var(--bg-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }
}
</style>
