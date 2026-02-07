<template>
  <div class="message-input">
    <div v-if="props.editMessage" class="message-input__edit">
      <div class="message-input__edit-content">
        <div class="message-input__edit-line"></div>
        <div class="message-input__edit-info">
          <span class="message-input__edit-label">Редактирование</span>
          <span class="message-input__edit-text">{{ getEditPreview() }}</span>
        </div>
        <button @click="clearEdit" class="message-input__edit-close" type="button">×</button>
      </div>
    </div>
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
      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        class="message-input__file-hidden"
        aria-label="Выбрать изображение"
        @change="handleImageSelect"
      />
      <div class="message-input__input-wrapper">
        <button
          v-if="!props.editMessage"
          type="button"
          class="message-input__image-button"
          aria-label="Прикрепить изображение"
          @click="triggerImageSelect"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>
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
        <textarea
          ref="inputField"
          v-model="message"
          @keydown="handleKeydown"
          @input="handleTyping"
          rows="1"
          :placeholder="props.editMessage ? 'Введите новый текст...' : 'Введите сообщение...'"
          class="message-input__field"
        />
        <EmojiPicker 
          :is-open="showEmojiPicker" 
          @select="insertEmoji"
          @close="showEmojiPicker = false"
        />
      </div>

			<div class="message-input__voice-wrapper">
				<button
					@click="showVoiceTooltip = !showVoiceTooltip"
					@mouseenter="showVoiceTooltip = true"
					@mouseleave="showVoiceTooltip = false"
					class="message-input__voice-button"
					type="button"
					aria-label="Голосовое сообщение"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
						<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
						<line x1="12" y1="19" x2="12" y2="23"></line>
						<line x1="8" y1="23" x2="16" y2="23"></line>
					</svg>
				</button>
				<div v-if="showVoiceTooltip" class="message-input__voice-tooltip">
					СКОРО БУДЕТ!
				</div>
			</div>

			<button
				@click="handleSend"
				class="message-input__button"
				type="button"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="22" y1="2" x2="11" y2="13"></line>
					<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
				</svg>
			</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { useChatStore } from '../stores/chat.store';
import { useAuthStore } from '../stores/auth.store';
import { useNotifications } from '../composables/useNotifications';
import { compressImageToBase64 } from '../utils/imageCompress';
import FileUpload from './FileUpload.vue';
import EmojiPicker from './EmojiPicker.vue';
import type { Message } from '../types';

const props = defineProps<{
  chatId: string;
  replyTo?: Message | null;
  editMessage?: Message | null;
}>();

const emit = defineEmits<{
  (e: 'clear-reply'): void;
  (e: 'clear-edit'): void;
  (e: 'start-edit-last'): void;
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();
const { error: notifyError } = useNotifications();
const message = ref('');
const previewFile = ref<{ url: string; filename: string; type: string } | null>(null);
const inputField = ref<HTMLTextAreaElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const showEmojiPicker = ref(false);
const showVoiceTooltip = ref(false);
let typingTimeout: ReturnType<typeof setTimeout> | null = null;

// Expose метод для фокуса извне
const focusInput = (): void => {
  if (inputField.value) {
    inputField.value.focus();
  }
};

// Expose метод для проверки фокуса
const hasFocus = (): boolean => {
  return document.activeElement === inputField.value;
};

defineExpose({
  focusInput,
  hasFocus,
  inputField
});

watch(() => props.editMessage, (editMsg) => {
  if (editMsg && editMsg.type === 'text') {
    message.value = editMsg.content;
    nextTick(() => focusInput());
  }
}, { immediate: true });

const handleSend = (): void => {
  const trimmedMessage = message.value.trim();
  const hasFile = !!previewFile.value;
  const hasText = trimmedMessage.length > 0;

  if (props.editMessage) {
    if (!hasText) return;
    chatStore.editMessage(props.chatId, props.editMessage._id, trimmedMessage);
    chatStore.stopTyping(props.chatId);
    message.value = '';
    emit('clear-edit');
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    return;
  }

  if (!hasText && !hasFile) return;

  const content = trimmedMessage || previewFile.value?.filename || '';
  const type = previewFile.value?.type === 'image' ? 'image' : previewFile.value ? 'file' : 'text';
  const fileUrl = previewFile.value?.url;
  const replyToId = props.replyTo?._id;

  if (type === 'text' && !content) return;

  chatStore.sendMessage(props.chatId, content, type as 'text' | 'image' | 'file', fileUrl, replyToId);
  chatStore.stopTyping(props.chatId);
  message.value = '';
  previewFile.value = null;
  if (imageInputRef.value) imageInputRef.value.value = '';
  if (props.replyTo) emit('clear-reply');
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
};

const getEditPreview = (): string => {
  if (!props.editMessage || !props.editMessage.content) return '';
  const text = props.editMessage.content;
  return text.length > 50 ? text.slice(0, 50) + '…' : text;
};

const clearEdit = (): void => {
  message.value = '';
  emit('clear-edit');
};

const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'ArrowUp') {
    if (!message.value.trim() && !props.replyTo && !props.editMessage) {
      e.preventDefault();
      emit('start-edit-last');
    }
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  // Shift+Enter — стандартное поведение textarea, вставка переноса строки
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
  if (imageInputRef.value) imageInputRef.value.value = '';
};

const triggerImageSelect = (): void => {
  imageInputRef.value?.click();
};

const handleImageSelect = async (e: Event): Promise<void> => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    input.value = '';
    notifyError('Выберите изображение (JPEG, PNG и т.д.)');
    return;
  }
  try {
    const dataUrl = await compressImageToBase64(file);
    previewFile.value = {
      url: dataUrl,
      filename: file.name || 'image.jpg',
      type: 'image'
    };
  } catch (err) {
    notifyError(err instanceof Error ? err.message : 'Не удалось обработать изображение');
  } finally {
    input.value = '';
  }
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
  flex-shrink: 0;

  &__file-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  @media (max-width: 768px) {
		padding: 0.75rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
		position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    width: 100vw;
  }

  @media (max-width: 575px) {
		padding: 0.375rem 0.375rem calc(0.375rem + env(safe-area-inset-bottom, 0px));
  }

  &__container {
    display: grid;
		grid-template-columns: 1fr 40px 40px;
    gap: 0.5rem;
    align-items: center;
    position: relative;

    @media (max-width: 768px) {
			grid-template-columns: 1fr 32px;
      gap: 0.375rem;
    }
  }

  &__input-wrapper {
    display: flex;
    align-items: center;
  }

  &__image-button {
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

    &:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    @media (max-width: 768px) {
      width: 28px;
      height: 28px;
      left: 0.375rem;
    }
  }

  &__emoji-button {
    position: absolute;
    left: 2.5rem;
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

    &:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    @media (max-width: 768px) {
      width: 28px;
      height: 28px;
      left: 2.25rem;
    }
  }

  &__field {
    flex: 1;
    min-height: 44px;
    max-height: 120px;
    padding: 0.75rem 1rem 0.75rem 4.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-family: inherit;
    line-height: 1.4;
    resize: none;
    overflow-y: auto;

    @media (max-width: 768px) {
      min-height: 40px;
      max-height: 100px;
      padding: 0.625rem 0.875rem 0.625rem 4rem;
      font-size: 0.875rem;
    }

    &:focus {
      outline: none;
      border-color: var(--accent-color);
    }
  }

  &__button {
    min-width: 40px;
    height: 40px;
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    color: #fff;
		padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
    flex-shrink: 0;

    @media (max-width: 768px) {
      min-width: 32px;
      height: 32px;
    }

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__voice-wrapper {
    position: relative;
    flex-shrink: 0;

		@media (max-width: 768px) {
			display: none;
		}
  }

  &__voice-button {
    min-width: 40px;
    height: 40px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 50%;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;

    @media (max-width: 768px) {
      min-width: 36px;
      height: 36px;
    }

    &:hover {
      background: var(--bg-primary);
      color: var(--text-primary);
      border-color: var(--accent-color);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__voice-tooltip {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    right: 0;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
    pointer-events: none;
    max-width: calc(100vw - 2rem);

    @media (min-width: 769px) {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
    }

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      right: 1rem;
      border: 6px solid transparent;
      border-top-color: var(--bg-secondary);

      @media (min-width: 769px) {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
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

  &__edit {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  &__edit-content {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  &__edit-line {
    width: 3px;
    background: var(--accent-color);
    border-radius: 2px;
    flex-shrink: 0;
    min-height: 36px;
  }

  &__edit-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__edit-label {
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--accent-color);
  }

  &__edit-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__edit-close {
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
