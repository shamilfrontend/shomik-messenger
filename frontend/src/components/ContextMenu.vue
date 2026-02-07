<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="context-menu__backdrop"
      aria-hidden="true"
      @click="close"
    />
    <Transition name="context-menu">
      <div
        v-if="modelValue"
        ref="menuRef"
        class="context-menu"
        :style="menuStyle"
        @click.stop
      >
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          class="context-menu__item"
          :class="{ 'context-menu__item--disabled': action.disabled }"
          :disabled="action.disabled"
          @click="onSelect(action)"
        >
          <span v-if="action.icon" class="context-menu__icon" aria-hidden="true">
            <!-- reply -->
            <svg v-if="action.icon === 'reply'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 17 1 9 9 1"></polyline>
              <path d="M23 18V9a2 2 0 0 0-2-2h-6"></path>
            </svg>
            <!-- copy -->
            <svg v-else-if="action.icon === 'copy'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <!-- edit -->
            <svg v-else-if="action.icon === 'edit'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <!-- delete / trash -->
            <svg v-else-if="action.icon === 'delete' || action.icon === 'trash'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <!-- select -->
            <svg v-else-if="action.icon === 'select'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
            <!-- pin / unpin (pushpin) -->
            <svg v-else-if="action.icon === 'pin' || action.icon === 'unpin'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 12V4h1V2H7v2h1v8l-4 4v2h16v-2l-4-4z"/>
            </svg>
          </span>
          <span class="context-menu__label">{{ action.label }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue';

export interface ContextMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  /** Иконка — компонент (VNode / h) или имя для встроенных иконок */
  icon?: 'reply' | 'copy' | 'edit' | 'delete' | 'trash' | 'select' | 'pin' | 'unpin';
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    x: number;
    y: number;
    actions: ContextMenuAction[];
  }>(),
  { actions: () => [] }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  select: [action: ContextMenuAction];
}>();

const menuRef = ref<HTMLElement | null>(null);

const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`
}));

const close = (): void => {
  emit('update:modelValue', false);
};

const onSelect = (action: ContextMenuAction): void => {
  if (action.disabled) return;
  emit('select', action);
  close();
};

const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape' && props.modelValue) {
    close();
  }
};

const handleClick = (): void => {
  if (props.modelValue) close();
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClick, true);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClick, true);
});

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) return;
    await nextTick();
    if (!menuRef.value) return;
    const rect = menuRef.value.getBoundingClientRect();
    const padding = 8;
    if (rect.right > window.innerWidth - padding) {
      menuRef.value.style.left = `${window.innerWidth - rect.width - padding}px`;
    }
    if (rect.bottom > window.innerHeight - padding) {
      menuRef.value.style.top = `${window.innerHeight - rect.height - padding}px`;
    }
  }
);
</script>

<style lang="scss" scoped>
.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 160px;
  padding: 4px 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);

  &__backdrop {
    position: fixed;
    inset: 0;
    z-index: 1999;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 14px;
    text-align: left;
    font-size: 14px;
    color: var(--text-primary);
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover:not(&--disabled) {
      background: var(--border-color);
    }

    &--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  &__label {
    flex: 1;
  }
}

.context-menu-enter-active,
.context-menu-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
