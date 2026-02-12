<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', stickerUrl: string): void;
  (e: 'close'): void;
}>();

const stickerPacks = ref<Array<{ name: string; path: string; stickers: string[] }>>([]);
const activePack = ref<string>('');
const isLoading = ref(false);

const loadStickerPacks = async (): Promise<void> => {
  isLoading.value = true;
  try {
    // Папки со стикерами
    const packs = ['vk_dogs', 'vk_persik', 'vk_smilies'];
    const loaded: Array<{ name: string; path: string; stickers: string[] }> = [];

    for (const packName of packs) {
      const stickers: string[] = [];
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      
      // Проверяем файлы с числовыми именами (1.png до 50.png)
      // Используем более быструю проверку через fetch HEAD запрос
      const checkImageExists = async (filename: string): Promise<boolean> => {
        try {
          const response = await fetch(`/stickers/${packName}/${filename}`, { method: 'HEAD' });
          return response.ok;
        } catch {
          // Fallback: проверка через Image
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = `/stickers/${packName}/${filename}`;
            setTimeout(() => resolve(false), 500);
          });
        }
      };

      // Проверяем файлы батчами для ускорения
      const batchSize = 20;
      for (let start = 1; start <= 50; start += batchSize) {
        const batchPromises: Promise<{ num: number; ext: string; exists: boolean }>[] = [];
        for (let i = start; i < start + batchSize && i <= 50; i++) {
          for (const ext of extensions) {
            const filename = `${i}${ext}`;
            batchPromises.push(
              checkImageExists(filename).then((exists) => ({ num: i, ext, exists }))
            );
          }
        }
        const batchResults = await Promise.all(batchPromises);
        const foundInBatch = new Set<number>();
        for (const result of batchResults) {
          if (result.exists && !foundInBatch.has(result.num)) {
            foundInBatch.add(result.num);
            stickers.push(`${result.num}${result.ext}`);
          }
        }
        // Если нашли файлы, можно остановиться раньше (опционально)
        if (stickers.length > 0 && start > 20) break;
      }
      
      // Сортируем по номеру
      stickers.sort((a, b) => {
        const numA = parseInt(a.match(/^\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/^\d+/)?.[0] || '0');
        return numA - numB;
      });

      if (stickers.length > 0) {
        // Форматируем имя пака для отображения
        const packDisplayName = packName
          .replace(/^vk_/, '')
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        loaded.push({
          name: packDisplayName,
          path: `/stickers/${packName}/`,
          stickers,
        });
        // Пак успешно загружен
      }
    }

    stickerPacks.value = loaded;
    if (loaded.length > 0) {
      activePack.value = loaded[0].name;
    }
  } catch (error) {
    console.error('Ошибка загрузки стикеров:', error);
  } finally {
    isLoading.value = false;
  }
};

const selectSticker = (stickerUrl: string): void => {
  emit('select', stickerUrl);
  emit('close');
};

onMounted(() => {
  if (props.isOpen) {
    loadStickerPacks();
  }
});

watch(() => props.isOpen, (open) => {
  if (open && stickerPacks.value.length === 0) {
    loadStickerPacks();
  }
});

const currentStickers = computed(() => {
  if (!activePack.value || stickerPacks.value.length === 0) return [];
  const pack = stickerPacks.value.find((p) => p.name === activePack.value);
  return pack?.stickers || [];
});
</script>

<template>
  <Teleport to="body">
    <Transition name="sticker-picker">
      <div v-if="isOpen" class="sticker-picker" @click.self="emit('close')">
        <div class="sticker-picker__container" @click.stop>
          <div v-if="stickerPacks.length > 1" class="sticker-picker__tabs">
            <button
              v-for="pack in stickerPacks"
              :key="pack.name"
              type="button"
              :class="['sticker-picker__tab', { 'sticker-picker__tab--active': activePack === pack.name }]"
              @click="activePack = pack.name"
            >
              {{ pack.name }}
            </button>
          </div>
          <div v-if="isLoading" class="sticker-picker__loading">
            <p>Загрузка стикеров...</p>
          </div>
          <div v-else-if="currentStickers.length > 0" class="sticker-picker__grid">
            <button
              v-for="(sticker, index) in currentStickers"
              :key="`${activePack}-${sticker}-${index}`"
              type="button"
              class="sticker-picker__item"
              @click="selectSticker(`${stickerPacks.find(p => p.name === activePack)?.path}${sticker}`)"
            >
              <img 
                :src="`${stickerPacks.find(p => p.name === activePack)?.path}${sticker}`" 
                :alt="sticker"
              />
            </button>
          </div>
          <div v-else class="sticker-picker__empty">
            <p>Стикеры не найдены</p>
            <p class="sticker-picker__empty-hint">Проверьте наличие файлов в /public/stickers/pack1, pack2, pack3</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.sticker-picker {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  padding-bottom: 80px;

  &__container {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    max-height: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    padding: 0.5rem;
    gap: 0.25rem;
  }

  &__tab {
    flex: 1;
    padding: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-primary);
    }

    &--active {
      background: var(--accent-color);
      color: white;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    padding: 0.75rem;
    overflow-y: auto;
    max-height: 400px;
  }

  &__item {
    aspect-ratio: 1;
    padding: 0.25rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--bg-primary);
      border-color: var(--border-color);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  &__loading {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__empty-hint {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    opacity: 0.7;
  }
}

.sticker-picker-enter-active,
.sticker-picker-leave-active {
  transition: opacity 0.2s;
}

.sticker-picker-enter-from,
.sticker-picker-leave-to {
  opacity: 0;
}
</style>
