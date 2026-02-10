<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

interface Props {
  text?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  position: 'top',
  delay: 200,
  disabled: false,
});

const show = ref(false);
const tooltipRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
let showTimeout: ReturnType<typeof setTimeout> | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

const tooltipClasses = computed(() => [
  'tooltip',
  `tooltip--${props.position}`,
  { 'tooltip--visible': show.value },
]);

const showTooltip = (): void => {
  if (props.disabled || !props.text) return;
  
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  
  showTimeout = setTimeout(() => {
    show.value = true;
    nextTick(() => updatePosition());
  }, props.delay);
};

const hideTooltip = (): void => {
  if (showTimeout) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
  
  hideTimeout = setTimeout(() => {
    show.value = false;
  }, 100);
};

const updatePosition = (): void => {
  if (!tooltipRef.value || !triggerRef.value) return;
  
  const tooltip = tooltipRef.value;
  const trigger = triggerRef.value;
  const rect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = 0;
  let left = 0;
  
  switch (props.position) {
    case 'top':
      top = rect.top - tooltipRect.height - 8;
      left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      break;
    case 'bottom':
      top = rect.bottom + 8;
      left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      break;
    case 'left':
      top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
      left = rect.left - tooltipRect.width - 8;
      break;
    case 'right':
      top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
      left = rect.right + 8;
      break;
  }
  
  // Проверка границ экрана
  const padding = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Горизонтальная коррекция
  if (left < padding) {
    left = padding;
  } else if (left + tooltipRect.width > viewportWidth - padding) {
    left = viewportWidth - tooltipRect.width - padding;
  }
  
  // Вертикальная коррекция
  if (top < padding) {
    top = padding;
  } else if (top + tooltipRect.height > viewportHeight - padding) {
    top = viewportHeight - tooltipRect.height - padding;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
};

const handleResize = (): void => {
  if (show.value) {
    updatePosition();
  }
};

const handleScroll = (): void => {
  if (show.value) {
    updatePosition();
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleScroll, true);
});

onUnmounted(() => {
  if (showTimeout) clearTimeout(showTimeout);
  if (hideTimeout) clearTimeout(hideTimeout);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('scroll', handleScroll, true);
});
</script>

<template>
  <div
    ref="triggerRef"
    class="tooltip-wrapper"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focus="showTooltip"
    @blur="hideTooltip"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="show && text"
        ref="tooltipRef"
        :class="tooltipClasses"
        role="tooltip"
      >
        <span class="tooltip__text">{{ text }}</span>
        <span class="tooltip__arrow" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.tooltip-wrapper {
  display: inline-block;
  position: relative;
}

.tooltip {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  
  &--visible {
    opacity: 1;
    transform: scale(1);
  }
  
  &__text {
    display: block;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.4;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    max-width: 200px;
    word-wrap: break-word;
    white-space: normal;
    text-align: center;
  }
  
  &__arrow {
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
  }
  
  // Стрелка сверху
  &--top &__arrow {
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px 6px 0 6px;
    border-color: var(--bg-secondary) transparent transparent transparent;
  }
  
  // Стрелка снизу
  &--bottom &__arrow {
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 0 6px 6px 6px;
    border-color: transparent transparent var(--bg-secondary) transparent;
  }
  
  // Стрелка слева
  &--left &__arrow {
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    border-width: 6px 0 6px 6px;
    border-color: transparent transparent transparent var(--bg-secondary);
  }
  
  // Стрелка справа
  &--right &__arrow {
    left: -6px;
    top: 50%;
    transform: translateY(-50%);
    border-width: 6px 6px 6px 0;
    border-color: transparent var(--bg-secondary) transparent transparent;
  }
  
  // Адаптация для мобильных
  @media (max-width: 768px) {
    &__text {
      font-size: 0.7rem;
      padding: 0.4rem 0.6rem;
      max-width: 150px;
    }
  }
}

// Анимация появления
@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.tooltip--visible {
  animation: tooltip-fade-in 0.15s ease-out;
}
</style>
