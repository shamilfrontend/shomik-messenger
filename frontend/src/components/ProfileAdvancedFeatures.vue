<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettings } from '../composables/useSettings';

const { tasks, setTasks } = useSettings();

const tasksEnabled = ref(tasks.value);
watch(tasks, (v) => { tasksEnabled.value = v; }, { immediate: true });

const toggleTasks = async (): Promise<void> => {
  const next = !tasksEnabled.value;
  tasksEnabled.value = next;
  await setTasks(next);
};
</script>

<template>
  <div class="profile-advanced-features">
    <div class="profile-advanced-features__container">
      <div class="profile-advanced-features__content">
        <h2>Расширенные возможности</h2>

        <div class="profile-advanced-features__section">
          <div class="profile-advanced-features__row">
            <span class="profile-advanced-features__label">Раздел «Задачи»</span>
            <button
              type="button"
              class="profile-advanced-features__switch"
              :class="{ 'profile-advanced-features__switch--on': tasksEnabled }"
              role="switch"
              :aria-checked="tasksEnabled"
              :title="tasksEnabled ? 'Выключить раздел Задачи' : 'Включить раздел Задачи'"
              @click="toggleTasks"
            >
              <span class="profile-advanced-features__switch-thumb" />
            </button>
          </div>
          <p class="profile-advanced-features__hint">
            Показывать пункт «Задачи» в нижней навигации и раздел с задачами.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-advanced-features {
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
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.25rem 1.5rem;

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

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__label {
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 500;
  }

  &__hint {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  &__switch {
    flex-shrink: 0;
    width: 48px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: 13px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;

    &:hover {
      border-color: var(--text-secondary);
    }

    &--on {
      background: var(--accent-color);
      border-color: var(--accent-color);

      .profile-advanced-features__switch-thumb {
        transform: translateX(22px);
      }
    }
  }

  &__switch-thumb {
    display: block;
    width: 20px;
    height: 20px;
    margin: 2px;
    border-radius: 50%;
    background: var(--bg-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;
  }
}
</style>
