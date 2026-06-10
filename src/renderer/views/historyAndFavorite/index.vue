<template>
  <div class="flex gap-6 h-full pb-4 page-padding pt-6 bg-white dark:bg-black">
    <favorite class="flex-item" v-if="!isMobile" />
    <history-list class="flex-item" />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'History'
});

import { isMobile } from '@/utils';
import Favorite from '@/views/favorite/index.vue';
import HistoryList from '@/views/history/index.vue';
</script>

<style scoped>
.flex-item {
  @apply flex-1 overflow-hidden rounded-lg border transition-colors duration-200;
  background: color-mix(in srgb, var(--qqm-surface) 70%, transparent);
  border-color: var(--qqm-border);
  box-shadow: var(--qqm-shadow);
  backdrop-filter: blur(16px) saturate(1.06);
}
</style>
