<script setup lang="ts">
import { computed } from 'vue';
import type { Message } from '../types';
import { AVAILABLE_REACTIONS, getReactionsArray } from '../utils/messageDisplay';

const props = defineProps<{
  message: Message;
  own: boolean;
  currentUserId?: string;
  menuOpen: boolean;
  menuPosition: 'above' | 'below';
  variant: 'chips' | 'menu';
}>();

const emit = defineEmits<{
  (e: 'reaction', message: Message, emoji: string): void;
  (e: 'reaction-hover', message: Message, emoji: string, event: MouseEvent): void;
  (e: 'reaction-leave'): void;
}>();

const reactions = computed(() => getReactionsArray(props.message, props.currentUserId));
</script>

<template>
  <div
    v-if="variant === 'chips' && reactions.length > 0"
    class="chat-window__reactions-list"
  >
    <div
      v-for="reaction in reactions"
      :key="reaction.emoji"
      class="chat-window__reaction-popover-trigger"
      @mouseenter="(e: MouseEvent) => emit('reaction-hover', message, reaction.emoji, e)"
      @mouseleave="emit('reaction-leave')"
    >
      <button
        :class="['chat-window__reaction', { 'chat-window__reaction--active': reaction.hasUser }]"
        @click="!own && emit('reaction', message, reaction.emoji)"
        :title="`${reaction.count} ${reaction.count === 1 ? 'реакция' : 'реакций'}`"
        :disabled="own"
        :style="own ? { cursor: 'default', opacity: 1 } : {}"
      >
        <span class="chat-window__reaction-emoji">{{ reaction.emoji }}</span>
        <span class="chat-window__reaction-count">{{ reaction.count }}</span>
      </button>
    </div>
  </div>

  <div
    v-else-if="variant === 'menu' && !own"
    :class="['chat-window__reaction-menu', {
      'chat-window__reaction-menu--visible': menuOpen,
      'chat-window__reaction-menu--above': menuOpen && menuPosition === 'above'
    }]"
  >
    <button
      v-for="emoji in AVAILABLE_REACTIONS"
      :key="emoji"
      class="chat-window__reaction-menu-item"
      @click="emit('reaction', message, emoji)"
    >
      {{ emoji }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.chat-window {
  &__reactions-list {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  &__reaction {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    color: currentColor;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;

    &:hover:not(:disabled) {
      background: var(--bg-primary);
      border-color: var(--accent-color);
    }

    &:disabled {
      cursor: default;
      opacity: 1;
    }

    &--active {
      background: rgba(var(--accent-color-rgb, 59, 130, 246), 0.1);
      border-color: var(--accent-color);
    }
  }

  &__reaction-emoji {
    font-size: 1rem;
    line-height: 1;
  }

  &__reaction-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--accent-color);
  }

  &__reaction-popover-trigger {
    display: inline-block;
  }

  &__reaction-menu {
    position: absolute;
    bottom: 95%;
    right: 0;
    left: auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    flex-wrap: nowrap;
    max-width: calc(100% - 80px);
    transform: translateY(5px);
    transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
    opacity: 0;

    @media (max-width: 768px) {
      position: fixed;
      z-index: 1002;
      left: 0;
      right: auto;
      max-width: 200px;
      width: max-content;
      min-width: 0;
      flex-wrap: wrap;
      padding: 0.625rem;
      gap: 0.375rem;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease, transform 0.15s ease;
      box-sizing: border-box;
      top: auto;
      bottom: auto;
      transform: translateY(-6px) scale(0.96);

      &--visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }

      &--above {
        transform: translateY(6px) scale(0.96);

        &.chat-window__reaction-menu--visible {
          transform: translateY(0) scale(1);
        }
      }
    }
  }

  &__reaction-menu-item {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 1.5rem;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-primary);
    }

    @media (max-width: 768px) {
      width: 36px;
      height: 36px;
      font-size: 1.75rem;
      border-radius: 10px;

      &:active {
        background: var(--bg-primary);
        transform: scale(0.95);
      }
    }
  }
}
</style>
