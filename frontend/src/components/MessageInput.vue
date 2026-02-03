<template>
  <div class="message-input">
    <div v-if="previewFile" class="message-input__preview">
      <img v-if="previewFile.type === 'image'" :src="previewFile.url" alt="Preview" />
      <div v-else class="message-input__file-preview">
        <span>{{ previewFile.filename }}</span>
        <button @click="clearPreview" class="message-input__remove-preview">×</button>
      </div>
    </div>
    <div class="message-input__container">
      <FileUpload
        accept="image/*,application/pdf,.doc,.docx,.txt"
        @uploaded="handleFileUploaded"
        @error="handleUploadError"
      />
      <input
        v-model="message"
        @keydown.enter.exact="handleSend"
        @input="handleTyping"
        type="text"
        placeholder="Введите сообщение..."
        class="message-input__field"
      />
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
import { ref } from 'vue';
import { useChatStore } from '../stores/chat.store';
import { useNotifications } from '../composables/useNotifications';
import FileUpload from './FileUpload.vue';

const props = defineProps<{
  chatId: string;
}>();

const chatStore = useChatStore();
const { error: notifyError } = useNotifications();
const message = ref('');
const previewFile = ref<{ url: string; filename: string; type: string } | null>(null);
let typingTimeout: ReturnType<typeof setTimeout> | null = null;

const handleSend = (): void => {
  const content = message.value.trim() || previewFile.value?.filename || 'Файл';
  const type = previewFile.value?.type === 'image' ? 'image' : previewFile.value ? 'file' : 'text';
  const fileUrl = previewFile.value?.url;

  if (content) {
    chatStore.sendMessage(props.chatId, content, type as 'text' | 'image' | 'file', fileUrl);
    chatStore.stopTyping(props.chatId);
    message.value = '';
    previewFile.value = null;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
  }
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
</script>

<style scoped lang="scss">
.message-input {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);

  &__container {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  &__field {
    flex: 1;
    padding: 0.75rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    color: var(--text-primary);
    font-size: 0.95rem;

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
}
</style>
