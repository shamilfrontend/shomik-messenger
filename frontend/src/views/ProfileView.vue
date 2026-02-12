<script setup lang="ts">
import ProfileSettings from '../components/ProfileSettings.vue';
import ProfileDesign from '../components/ProfileDesign.vue';
import ProfileAudioVideo from '../components/ProfileAudioVideo.vue';
import ProfileAdvancedFeatures from '../components/ProfileAdvancedFeatures.vue';

defineProps<{
  section?: string | null;
}>();
</script>

<template>
  <div class="profile-view">
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
}
</style>
