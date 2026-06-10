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
    <span class="lyric-correction-time text-xs py-0.5 px-1 rounded font-mono tracking-wider">
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
  @apply w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors duration-150;
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 76%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 76%, transparent);
  color: color-mix(in srgb, var(--qqm-text, #111827) 74%, var(--qqm-muted, #737373));
  backdrop-filter: blur(10px) saturate(1.08);

  &:hover {
    color: white;
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 82%, transparent);
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 60%, transparent);
  }
}

.lyric-correction-time {
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 68%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 78%, transparent);
  color: color-mix(in srgb, var(--qqm-text, #111827) 72%, var(--qqm-muted, #737373));
  backdrop-filter: blur(10px) saturate(1.06);
}

.mobile {
  .lyric-correction {
    @apply opacity-100;
  }
}
</style>
