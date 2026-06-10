<template>
  <div class="history-favorite-layout flex h-full gap-5 bg-white pb-4 pt-5 dark:bg-black">
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
.history-favorite-layout {
  padding-left: clamp(18px, 2.2vw, 32px);
  padding-right: clamp(18px, 2.2vw, 32px);
}

.flex-item {
  @apply flex-1 overflow-hidden rounded-lg border transition-colors duration-200;
  background: color-mix(in srgb, var(--qqm-surface) 88%, transparent);
  border-color: color-mix(in srgb, var(--qqm-border) 72%, transparent);
  box-shadow: none;
}
</style>
