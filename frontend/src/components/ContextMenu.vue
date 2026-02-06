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
          {{ action.label }}
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
    display: block;
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
