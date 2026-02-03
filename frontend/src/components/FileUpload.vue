<template>
  <div class="file-upload">
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      @change="handleFileSelect"
      class="file-upload__input"
    />
    <button @click="triggerFileSelect" class="file-upload__button" :disabled="uploading">
      <svg v-if="!uploading" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <span v-else>...</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { uploadService } from '../services/upload.service';

const props = defineProps<{
  accept?: string;
}>();

const emit = defineEmits<{
  (e: 'uploaded', data: { url: string; filename: string; type: string }): void;
  (e: 'error', error: string): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const triggerFileSelect = (): void => {
  fileInput.value?.click();
};

const handleFileSelect = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  uploading.value = true;

  try {
    const result = await uploadService.uploadFile(file);
    emit('uploaded', {
      url: result.url,
      filename: result.filename,
      type: result.type
    });
  } catch (error: any) {
    emit('error', error.response?.data?.error || 'Ошибка загрузки файла');
  } finally {
    uploading.value = false;
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};
</script>

<style scoped lang="scss">
.file-upload {
  display: inline-block;

  &__input {
    display: none;
  }

  &__button {
    width: 40px;
    height: 40px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--bg-primary);
      border-color: var(--accent-color);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}
</style>
