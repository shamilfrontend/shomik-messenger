<script setup lang="ts">
import { onMounted } from 'vue';
import { useCallStore } from '../stores/call.store';

const callStore = useCallStore();

onMounted(() => {
  callStore.loadDevices();
});
</script>

<template>
  <div class="profile-audio-video">
    <div class="profile-audio-video__container">
      <div class="profile-audio-video__content">
        <h2>Аудио и видео</h2>
        <!-- Секция устройств для звонков -->
        <div class="profile-audio-video__section">
          <h3>Устройства для звонков</h3>
          <div class="profile-audio-video__form">
            <div class="profile-audio-video__field">
              <label>Микрофон</label>
              <select
                :value="callStore.selectedMicId ?? ''"
                @change="callStore.setSelectedMic(($event.target as HTMLSelectElement).value || null)"
                class="profile-audio-video__select"
              >
                <option value="">По умолчанию</option>
                <option
                  v-for="dev in callStore.audioDevices"
                  :key="dev.deviceId"
                  :value="dev.deviceId"
                >
                  {{ dev.label || `Микрофон ${dev.deviceId.slice(0, 8)}` }}
                </option>
              </select>
            </div>
            <div class="profile-audio-video__field">
              <label>Камера</label>
              <select
                :value="callStore.selectedCameraId ?? ''"
                @change="callStore.setSelectedCamera(($event.target as HTMLSelectElement).value || null)"
                class="profile-audio-video__select"
              >
                <option value="">По умолчанию</option>
                <option
                  v-for="dev in callStore.videoDevices"
                  :key="dev.deviceId"
                  :value="dev.deviceId"
                >
                  {{ dev.label || `Камера ${dev.deviceId.slice(0, 8)}` }}
                </option>
              </select>
            </div>
            <p class="profile-audio-video__devices-hint">Выбор применяется к следующим звонкам. Разрешите доступ к микрофону и камере, чтобы видеть названия устройств.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-audio-video {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);

  &__container {
    background: var(--bg-primary);
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    overflow-y: auto;

    @media (max-width: 768px) {
      padding: 0;
    }
  }

  &__content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (max-width: 768px) {
      padding: 4px 0 0;
      gap: 1rem;
    }
  }

  &__section {
    margin-bottom: 0;
		padding: 1.25rem 1.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;

    h3 {
      margin: 0 0 1rem 0;
      color: var(--text-primary);
      font-size: 1.1rem;
      font-weight: 600;

      @media (min-width: 769px) {
        margin-bottom: 1.25rem;
        font-size: 1.15rem;
      }
    }

		@media (max-width: 768px) {
			margin-top: 24px;
		}
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      color: var(--text-primary);
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  &__select {
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 1rem;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: var(--accent-color);
    }
  }

  &__devices-hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
}
</style>
