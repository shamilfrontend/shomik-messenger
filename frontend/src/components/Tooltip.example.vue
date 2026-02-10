<!-- Пример использования компонента Tooltip -->
<script setup lang="ts">
import Tooltip from './Tooltip.vue';
</script>

<template>
  <div style="padding: 2rem; display: flex; gap: 2rem; flex-wrap: wrap; align-items: center;">
    <!-- Базовое использование -->
    <Tooltip text="Это подсказка сверху">
      <button>Наведите на меня</button>
    </Tooltip>

    <!-- Разные позиции -->
    <Tooltip text="Подсказка снизу" position="bottom">
      <button>Снизу</button>
    </Tooltip>

    <Tooltip text="Подсказка слева" position="left">
      <button>Слева</button>
    </Tooltip>

    <Tooltip text="Подсказка справа" position="right">
      <button>Справа</button>
    </Tooltip>

    <!-- С задержкой -->
    <Tooltip text="Появляется с задержкой 500мс" :delay="500">
      <button>С задержкой</button>
    </Tooltip>

    <!-- С иконкой -->
    <Tooltip text="Информация о действии">
      <button style="padding: 0.5rem; border-radius: 50%; width: 32px; height: 32px;">
        ℹ️
      </button>
    </Tooltip>

    <!-- Отключенный -->
    <Tooltip text="Не показывается" :disabled="true">
      <button>Отключен</button>
    </Tooltip>

    <!-- Длинный текст -->
    <Tooltip text="Это очень длинная подсказка, которая будет переноситься на несколько строк, если текст слишком длинный">
      <button>Длинный текст</button>
    </Tooltip>
  </div>
</template>
