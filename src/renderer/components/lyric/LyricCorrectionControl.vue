<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  correctionTime: number;
}>();
const emit = defineEmits<{
  (e: 'adjust', delta: number): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="lyric-correction">
    <n-tooltip placement="right">
      <template #trigger>
        <div
          class="lyric-correction-btn"
          @click="emit('adjust', -0.2)"
          :title="t('player.subtractCorrection', { num: 0.2 })"
        >
          <i class="ri-subtract-line text-base"></i>
        </div>
      </template>
      <span>{{ t('player.subtractCorrection', { num: 0.2 }) }}</span>
    </n-tooltip>
    <span
      class="text-xs py-0.5 px-1 rounded bg-white/70 dark:bg-black/70 font-mono tracking-wider text-neutral-700 dark:text-neutral-200 bg-opacity-80"
    >
      {{ props.correctionTime > 0 ? '+' : '' }}{{ props.correctionTime.toFixed(1) }}s
    </span>
    <n-tooltip placement="right">
      <template #trigger>
        <div
          class="lyric-correction-btn"
          @click="emit('adjust', 0.2)"
          :title="t('player.addCorrection', { num: 0.2 })"
        >
          <i class="ri-add-line text-base"></i>
        </div>
      </template>
      <span>{{ t('player.addCorrection', { num: 0.2 }) }}</span>
    </n-tooltip>
  </div>
</template>

<style scoped lang="scss">
.lyric-correction {
  @apply absolute right-0 bottom-4 flex flex-col items-center space-y-1 z-50 select-none transition-opacity duration-200 opacity-0 pointer-events-none;
}

.lyric-correction-btn {
  @apply w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-black border border-white/20 dark:border-neutral-700/40 cursor-pointer transition-colors duration-150 text-neutral-700 dark:text-neutral-200 bg-opacity-40;

  &:hover {
    color: white;
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 82%, transparent);
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 60%, transparent);
  }
}

.mobile {
  .lyric-correction {
    @apply opacity-100;
  }
}
</style>
