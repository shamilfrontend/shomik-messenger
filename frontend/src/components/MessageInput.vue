<template>
  <div class="message-input">
    <div v-if="props.replyTo" class="message-input__reply">
      <div class="message-input__reply-content">
        <div class="message-input__reply-line"></div>
        <div class="message-input__reply-info">
          <span class="message-input__reply-sender">{{ getReplySenderName() }}</span>
          <span class="message-input__reply-text">{{ getReplyText() }}</span>
        </div>
        <button @click="clearReply" class="message-input__reply-close">×</button>
      </div>
    </div>
    <div v-if="previewFile" class="message-input__preview">
      <img v-if="previewFile.type === 'image'" :src="previewFile.url" alt="Preview" />
      <div v-else class="message-input__file-preview">
        <span>{{ previewFile.filename }}</span>
        <button @click="clearPreview" class="message-input__remove-preview">×</button>
      </div>
    </div>
    <div class="message-input__container">
      <FileUpload
				v-if="false"
        accept="image/*,application/pdf,.doc,.docx,.txt"
        @uploaded="handleFileUploaded"
        @error="handleUploadError"
      />
      <div class="message-input__input-wrapper">
        <button 
          @click="toggleEmojiPicker" 
          class="message-input__emoji-button"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </button>
        <input
          ref="inputField"
          v-model="message"
          @keydown.enter.exact="handleSend"
          @input="handleTyping"
          type="text"
          placeholder="Введите сообщение..."
          class="message-input__field"
        />
        <EmojiPicker 
          :is-open="showEmojiPicker" 
          @select="insertEmoji"
          @close="showEmojiPicker = false"
        />
      </div>
      <button @click="handleSend" class="message-input__button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useNotifications } from '../composables/useNotifications';
import FileUpload from './FileUpload.vue';
import EmojiPicker from './EmojiPicker.vue';
import type { Message } from '../types';

const props = defineProps<{
  chatId: string;
  replyTo?: Message | null;
}>();

const emit = defineEmits<{
  (e: 'clear-reply'): void;
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();
const { error: notifyError } = useNotifications();
const message = ref('');
const previewFile = ref<{ url: string; filename: string; type: string } | null>(null);
const inputField = ref<HTMLInputElement | null>(null);
const showEmojiPicker = ref(false);
let typingTimeout: ReturnType<typeof setTimeout> | null = null;

// Автофокус при открытии чата
const focusInput = async (): Promise<void> => {
  await nextTick();
  if (inputField.value) {
    inputField.value.focus();
  }
};

// Устанавливаем фокус при изменении chatId
watch(() => props.chatId, () => {
  focusInput();
}, { immediate: true });

onMounted(() => {
  focusInput();
});

const handleSend = (): void => {
  const content = message.value.trim() || previewFile.value?.filename || 'Файл';
  const type = previewFile.value?.type === 'image' ? 'image' : previewFile.value ? 'file' : 'text';
  const fileUrl = previewFile.value?.url;
  const replyToId = props.replyTo?._id;

  if (content) {
    chatStore.sendMessage(props.chatId, content, type as 'text' | 'image' | 'file', fileUrl, replyToId);
    chatStore.stopTyping(props.chatId);
    message.value = '';
    previewFile.value = null;
    if (props.replyTo) {
      emit('clear-reply');
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    // Возвращаем фокус на поле ввода после отправки
    focusInput();
  }
};

const getReplySenderName = (): string => {
  if (!props.replyTo) return '';
  if (typeof props.replyTo.senderId === 'string') {
    return 'Пользователь';
  }
  if (!props.replyTo.senderId) {
    return 'Пользователь';
  }
  const senderId = props.replyTo.senderId.id;
  const isOwn = senderId === authStore.user?.id;
  return isOwn ? 'Вы' : (props.replyTo.senderId.username || 'Пользователь');
};

const getReplyText = (): string => {
  if (!props.replyTo) return '';
  if (props.replyTo.type === 'image') {
    return '📷 Фото';
  }
  if (props.replyTo.type === 'file') {
    return '📎 Файл';
  }
  return props.replyTo.content || '';
};

const clearReply = (): void => {
  emit('clear-reply');
};

const handleFileUploaded = (data: { url: string; filename: string; type: string }): void => {
  previewFile.value = data;
  if (!message.value.trim()) {
    message.value = data.filename;
  }
};

const handleUploadError = (error: string): void => {
  notifyError(error);
};

const clearPreview = (): void => {
  previewFile.value = null;
};

const handleTyping = (): void => {
  chatStore.startTyping(props.chatId);

  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  typingTimeout = setTimeout(() => {
    chatStore.stopTyping(props.chatId);
    typingTimeout = null;
  }, 3000);
};

const toggleEmojiPicker = (): void => {
  showEmojiPicker.value = !showEmojiPicker.value;
};

const insertEmoji = (emoji: string): void => {
  const input = inputField.value;
  if (input) {
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const textBefore = message.value.substring(0, start);
    const textAfter = message.value.substring(end);
    message.value = textBefore + emoji + textAfter;
    
    // Устанавливаем курсор после вставленного эмоджи
    nextTick(() => {
      input.focus();
      const newPosition = start + emoji.length;
      input.setSelectionRange(newPosition, newPosition);
    });
  } else {
    message.value += emoji;
  }
  
  showEmojiPicker.value = false;
  handleTyping();
};
</script>

<style scoped lang="scss">
.message-input {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);

  @media (max-width: 768px) {
    padding: 0.75rem;
  }

  &__container {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    position: relative;

    @media (max-width: 768px) {
      gap: 0.375rem;
    }
  }

  &__input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  &__emoji-button {
    position: absolute;
    left: 0.5rem;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
    z-index: 1;

    @media (max-width: 768px) {
      width: 28px;
      height: 28px;
      left: 0.375rem;
    }

    &:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__field {
    flex: 1;
    padding: 0.75rem 1rem 0.75rem 2.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    color: var(--text-primary);
    font-size: 0.95rem;

    @media (max-width: 768px) {
      padding: 0.625rem 0.875rem 0.625rem 2.5rem;
      font-size: 0.875rem;
    }

    &:focus {
      outline: none;
      border-color: var(--accent-color);
    }
  }

  &__button {
    width: 40px;
    height: 40px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
    flex-shrink: 0;

    @media (max-width: 768px) {
      width: 36px;
      height: 36px;
    }

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__preview {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-color);

    img {
      max-width: 200px;
      max-height: 200px;
      border-radius: 8px;
    }
  }

  &__file-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 8px;
    color: var(--text-primary);
  }

  &__remove-preview {
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;

    &:hover {
      color: var(--text-primary);
    }
  }

  &__reply {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  &__reply-content {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  &__reply-line {
    width: 3px;
    background: var(--accent-color);
    border-radius: 2px;
    flex-shrink: 0;
    min-height: 40px;
  }

  &__reply-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__reply-sender {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--accent-color);
  }

  &__reply-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__reply-close {
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    line-height: 1;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
  }
}
</style>
