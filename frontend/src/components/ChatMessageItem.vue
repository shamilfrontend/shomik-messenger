<script setup lang="ts">
import { computed } from 'vue';
import type { Message, User } from '../types';
import { useChatStore } from '../stores/chat.store';
import { getImageUrl } from '../utils/image';
import { formatClockTime } from '../utils/formatTime';
import { hasLinks, hasIcqSmiles, renderMessageContent as renderSafeContent } from '../utils/messageContent';
import {
  canDeleteMessage,
  getMessageAvatar,
  getMessageSender,
  getMessageSenderId,
  getMessageSenderStatus,
  getReadStatus,
  getReplyToSenderName,
  getReplyToText,
  isMessageSenderUser,
  isOnlyEmojis,
  isOnlyStickerOrEmoji,
  isOwnMessage,
  isSenderIdUser,
  shouldTruncateMessage,
  getTruncatedText,
} from '../utils/messageDisplay';
import MessageReactions from './MessageReactions.vue';

const props = defineProps<{
  message: Message;
  isMobile: boolean;
  selectionMode: boolean;
  selected: boolean;
  reactionMenuOpen: boolean;
  reactionMenuPosition: 'above' | 'below';
}>();

const emit = defineEmits<{
  (e: 'reply', message: Message): void;
  (e: 'open-user', user: User): void;
  (e: 'open-message', message: Message): void;
  (e: 'contextmenu', message: Message, event: MouseEvent): void;
  (e: 'toggle-select', message: Message): void;
  (e: 'toggle-reaction-menu', message: Message): void;
  (e: 'reaction', message: Message, emoji: string): void;
  (e: 'reaction-hover', message: Message, emoji: string, event: MouseEvent): void;
  (e: 'reaction-leave'): void;
  (e: 'jump-reply', replyTo: Message | string): void;
}>();

const chatStore = useChatStore();
const currentUserId = computed(() => chatStore.user?.id);
const currentChat = computed(() => chatStore.currentChat);
const isGroupChat = computed(() => currentChat.value?.type === 'group');
const own = computed(() => isOwnMessage(props.message, currentUserId.value));
const canDelete = computed(() => canDeleteMessage(props.message, currentChat.value, currentUserId.value));
const unread = computed(() => chatStore.isMessageUnread(props.message));
const readStatus = computed(() => getReadStatus(props.message, currentChat.value, currentUserId.value));
const senderName = computed(() => getMessageSender(props.message));
const senderAvatar = computed(() => getMessageAvatar(props.message));
const transparentBubble = computed(() => isOnlyStickerOrEmoji(props.message));
const truncated = computed(() => shouldTruncateMessage(props.message));
const displayText = computed(() => (
  truncated.value ? getTruncatedText(props.message.content) : (props.message.content || '')
));
const htmlContent = computed(() => hasIcqSmiles(props.message.content || '') || hasLinks(props.message.content || ''));

const renderContent = (content: string): string => renderSafeContent(
  content,
  'chat-window__message-link',
  'chat-window__icq-smile',
);

const openUserInfo = (): void => {
  if (own.value) return;

  const senderId = getMessageSenderId(props.message);
  if (senderId === currentUserId.value) return;

  if (isSenderIdUser(props.message.senderId)) {
    if (props.message.senderId.id !== currentUserId.value) {
      emit('open-user', props.message.senderId);
    }
    return;
  }

  const participant = currentChat.value?.participants.find((p) => {
    const id = typeof p === 'string' ? p : p.id;
    return id === senderId && id !== currentUserId.value;
  });
  if (participant && typeof participant !== 'string') {
    emit('open-user', participant);
  }
};

const onReaction = (msg: Message, emoji: string): void => {
  emit('reaction', msg, emoji);
};

const onReactionHover = (msg: Message, emoji: string, event: MouseEvent): void => {
  emit('reaction-hover', msg, emoji, event);
};

const handleClick = (event: MouseEvent): void => {
  if (props.selectionMode) {
    emit('toggle-select', props.message);
    return;
  }
  const target = event.target as HTMLElement;
  if (target.closest('.chat-window__reaction')
      || target.closest('.chat-window__reaction-menu')
      || target.closest('a')) {
    return;
  }
  if (props.isMobile && !own.value) {
    event.stopPropagation();
    emit('toggle-reaction-menu', props.message);
  }
};
</script>

<template>
  <div
    v-if="message.type === 'system'"
    class="chat-window__message chat-window__message--system"
  >
    <div class="chat-window__system-message">
      <span class="chat-window__system-text">{{ message.content }}</span>
      <span class="chat-window__system-time">{{ formatClockTime(message.createdAt) }}</span>
    </div>
  </div>
  <div
    v-else
    :id="`message-${message._id}`"
    :class="['chat-window__message-wrapper', {
      'chat-window__message-wrapper_me': own,
      'chat-window__message-wrapper--selected': selectionMode && selected,
      'chat-window__message-wrapper--selectable': selectionMode && canDelete
    }]"
    @dblclick="!selectionMode && emit('reply', message)"
    @click="handleClick($event)"
    @contextmenu.prevent="emit('contextmenu', message, $event)"
  >
    <div
      v-if="selectionMode && canDelete"
      class="chat-window__message-select-checkbox"
      @click.stop="emit('toggle-select', message)"
    >
      <svg v-if="selected" class="chat-window__message-select-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span v-else class="chat-window__message-select-box"></span>
    </div>
    <div
      :class="['chat-window__message', {
        'chat-window__message_me': own,
        'chat-window__message--unread': unread
      }]"
    >
      <div
        v-if="isGroupChat"
        class="chat-window__message-avatar"
        @click="openUserInfo"
      >
        <img
          v-if="senderAvatar"
          :src="senderAvatar"
          :alt="senderName"
        />
        <div v-else class="chat-window__message-avatar-placeholder">
          {{ senderName.charAt(0).toUpperCase() }}
        </div>
        <span
          v-if="isMessageSenderUser(message)"
          :class="['chat-window__status-indicator', `chat-window__status-indicator--${getMessageSenderStatus(message)}`]"
        />
      </div>
      <div class="chat-window__message-content" :data-message-id="message._id">
        <div class="chat-window__message-header">
          <div class="chat-window__message-sender" @click="openUserInfo">
            {{ senderName }}
          </div>
          <div class="chat-window__message-time">
            {{ formatClockTime(message.createdAt) }}
          </div>
        </div>
        <div
          class="chat-window__message-bubble"
          :class="{ 'chat-window__message-bubble--transparent': transparentBubble }"
        >
          <div v-if="message.replyTo" class="chat-window__message-reply">
            <div class="chat-window__message-reply-line"></div>
            <div
              class="chat-window__message-reply-content"
              @click="emit('jump-reply', message.replyTo)"
            >
              <span class="chat-window__message-reply-sender">
                {{ getReplyToSenderName(message.replyTo, currentUserId) }}
              </span>
              <span class="chat-window__message-reply-text">
                {{ getReplyToText(message.replyTo) }}
              </span>
            </div>
          </div>
          <div v-if="message.type === 'image' && message.fileUrl" class="chat-window__message-image" @click.stop="emit('open-message', message)">
            <img :src="getImageUrl(message.fileUrl) || message.fileUrl" :alt="message.content" />
          </div>
          <div v-else-if="message.type === 'file' && message.fileUrl" class="chat-window__message-file">
            <a :href="getImageUrl(message.fileUrl) || message.fileUrl" target="_blank">{{ message.content }}</a>
          </div>
          <div v-else class="chat-window__message-text-wrapper">
            <div
              class="chat-window__message-text"
              :class="{
                'chat-window__message-text--html': htmlContent,
                'chat-window__message-text--only-emojis': isOnlyEmojis(message.content || '')
              }"
            >
              <span
                v-if="htmlContent"
                v-html="renderContent(displayText)"
              />
              <span v-else>
                {{ displayText }}
              </span>
            </div>
            <button
              v-if="truncated"
              class="chat-window__message-expand-button"
              @click.stop="emit('open-message', message)"
              type="button"
            >
              Открыть полностью
            </button>
          </div>
          <div v-if="own" class="chat-window__message-footer">
            <div class="chat-window__message-footer-right">
              <div class="chat-window__message-status" :class="`chat-window__message-status--${readStatus}`">
                <svg v-if="readStatus === 'sent'" width="16" height="16" viewBox="0 0 16 16" style="fill: none">
                  <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" style="fill: none">
                  <path d="M2 8L5 11L12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M6 8L9 11L16 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
          <MessageReactions
            variant="chips"
            :message="message"
            :own="own"
            :current-user-id="currentUserId"
            :menu-open="reactionMenuOpen"
            :menu-position="reactionMenuPosition"
            @reaction="onReaction"
            @reaction-hover="onReactionHover"
            @reaction-leave="emit('reaction-leave')"
          />
        </div>
      </div>
    </div>

    <MessageReactions
      variant="menu"
      :message="message"
      :own="own"
      :current-user-id="currentUserId"
      :menu-open="reactionMenuOpen"
      :menu-position="reactionMenuPosition"
      @reaction="onReaction"
      @reaction-hover="onReactionHover"
      @reaction-leave="emit('reaction-leave')"
    />
  </div>
</template>

<style scoped lang="scss">
:deep(.chat-window__icq-smile) {
  display: inline-block;
  vertical-align: middle;
  width: 24px;
  height: 24px;
  margin: 0 2px;
  object-fit: contain;
  image-rendering: high-quality;
}

:deep(.chat-window__message-link) {
  color: inherit;
  text-decoration: underline;
  word-break: break-all;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }

  &:visited {
    color: inherit;
    opacity: 0.9;
  }
}

.chat-window {
  &__status-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary);
    z-index: 1;

    &--online {
      background: #52c41a;
    }

    &--offline {
      background: #ff4d4f;
    }

    &--away {
      background: #faad14;
    }
  }

  &__message-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    padding: 0.25rem 1rem;
    cursor: pointer;
    justify-content: flex-start;
    transition: background 0.2s;
    border-radius: 8px;

    &:hover {
      background: var(--bg-secondary);
    }

    @media (max-width: 768px) {
      padding: 0.25rem 0.75rem;
    }

    &_me {
      justify-content: flex-end;
      text-align: right;
    }

    &--highlighted {
      background: rgba(59, 130, 246, 0.15);
      animation: highlight-pulse 2s ease-out;
    }

    &--selected {
      background: rgba(59, 130, 246, 0.12);
    }

    &--selectable {
      cursor: pointer;
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover :deep(.chat-window__reaction-menu) {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
    }

    @media (min-width: 769px) {
      &:first-of-type :deep(.chat-window__reaction-menu) {
        bottom: auto;
        top: calc(100% + 0.5rem);
        transform: translateY(-5px);
      }

      &:first-of-type:hover :deep(.chat-window__reaction-menu) {
        transform: translateY(0);
      }
    }
  }

  &__message-select-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    margin-right: 0.5rem;
    align-self: center;
    color: var(--accent-color);
  }

  &__message-select-check {
    flex-shrink: 0;
  }

  &__message-select-box {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    display: block;
  }

  @keyframes highlight-pulse {
    0% {
      background: rgba(59, 130, 246, 0.3);
    }
    100% {
      background: transparent;
    }
  }

  &__message {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    max-width: 70%;
    align-self: flex-start;

    @media (max-width: 768px) {
      max-width: 85%;
      gap: 0.375rem;
    }

    &--system {
      max-width: 100%;
      align-self: center;
      justify-content: center;
      margin: 0.5rem 0;
    }

    &_me {
      align-self: flex-end;
      flex-direction: row-reverse;

      .chat-window__message-bubble {
        background: var(--accent-color);
        color: white;
        border-bottom-right-radius: 4px;

        &--transparent {
          background: transparent;
        }
      }

      .chat-window__message-footer {
        justify-content: flex-end;
      }

      .chat-window__message-header {
        justify-content: flex-end;
      }

      .chat-window__message-status {
        &--sent,
        &--delivered {
          color: rgba(255, 255, 255, 0.7);
        }

        &--read {
          color: rgba(255, 255, 255, 0.9);
        }
      }

      .chat-window__message-avatar {
        order: 0;
      }

      .chat-window__message-content {
        order: 0;
      }

      :deep(.chat-window__reaction-count) {
        color: var(--border-color);
      }
    }

    &--unread {
      .chat-window__message-bubble {
        background: #ff3b30;
        color: white;
        border: 2px solid #ff3b30;

        &--transparent {
          background: transparent;
          border: none;
        }
      }
    }
  }

  &__system-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border-radius: 12px;
    max-width: 80%;
  }

  &__system-text {
    color: var(--text-secondary);
    font-size: 0.85rem;
    text-align: center;
    font-style: italic;
  }

  &__system-time {
    color: var(--text-secondary);
    font-size: 0.75rem;
    opacity: 0.7;
  }

  &__message-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: visible;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.2s;
    position: relative;

    &:hover {
      transform: scale(1.1);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  &__message-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color);
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    border-radius: 50%;
  }

  &__message-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    position: relative;
  }

  &__message-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    padding-left: 0.5rem;
    padding-right: 0.25rem;
  }

  &__message-sender {
    color: var(--text-primary);
    font-size: 1rem;
    cursor: pointer;
    transition: color 0.2s;
    flex-shrink: 0;

    &:hover {
      color: var(--accent-color);
      text-decoration: underline;
    }
  }

  &__message-time {
    font-size: 0.75rem;
    opacity: 0.8;
    text-align: right;
    flex-shrink: 0;
  }

  &__message-reply {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.08);
    }
  }

  &__message-reply-line {
    width: 3px;
    background: var(--accent-color);
    border-radius: 2px;
    flex-shrink: 0;
  }

  &__message-reply-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    cursor: pointer;
    min-width: 0;
  }

  &__message-reply-sender {
    font-weight: 600;
    font-size: 0.85rem;
  }

  &__message-reply-text {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
  }

  &__message-bubble {
    padding: 0.5rem 0.75rem;
    background: var(--surface, var(--bg-secondary));
    border-radius: var(--radius-md, 12px) var(--radius-md, 12px) var(--radius-md, 12px) 4px;
    color: var(--text-primary);
    position: relative;
    word-wrap: break-word;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);

    &--transparent {
      background: transparent;
      padding: 0;
      box-shadow: none;
    }
  }

  &__message-text-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__message-text {
    margin-bottom: 0;
    font-size: var(--message-text-size);
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    color: var(--text-primary);

    &--html {
      white-space: normal;
      line-height: 1.5;
    }

    &--only-emojis {
      --message-text-size: 48px;
      font-size: 48px;
      line-height: 1.2;
    }
  }

  &__message-expand-button {
    align-self: flex-start;
    padding: 0.375rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.25rem;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      background: var(--bg-primary);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }

    &:active {
      transform: scale(0.98);
    }

    @media (max-width: 768px) {
      width: 100%;
      align-self: stretch;
      padding: 0.5rem 1rem;
      font-size: 0.9375rem;
    }
  }

  &__message-image {
    max-width: 200px;
    margin-bottom: 0.25rem;
    cursor: pointer;

    img {
      max-width: 100%;
      border-radius: 8px;
    }
  }

  &__message-file {
    margin-bottom: 0.25rem;

    a {
      color: inherit;
      text-decoration: underline;
    }
  }

  &__message-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    margin-top: 0.5rem;
    position: relative;
    z-index: 15;
  }

  &__message-footer-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    position: relative;
    z-index: 15;
    margin-left: 16px;

    @media (max-width: 768px) {
      gap: 0.625rem;
    }
  }

  &__message-status {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-left: auto;
    color: var(--text-secondary);
    opacity: 0.7;

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    &--sent {
      color: var(--text-secondary);
      opacity: 0.5;
    }

    &--delivered {
      color: var(--text-secondary);
      opacity: 0.7;
    }

    &--read {
      color: #4a9eff;
      opacity: 1;
    }
  }
}
</style>
