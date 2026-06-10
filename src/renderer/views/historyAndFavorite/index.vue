<template>
  <div class="history-favorite-layout flex h-full gap-5 pb-4 pt-5">
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
  background: var(--qqm-bg) !important;
}

.flex-item {
  @apply flex-1 overflow-hidden rounded-lg border transition-colors duration-200;
  background: var(--qqm-surface);
  border-color: var(--qqm-border);
  box-shadow: none;
}

.flex-item :deep(.favorite-header),
.flex-item :deep(.history-header) {
  border-bottom: 1px solid var(--qqm-border);
  background: color-mix(in srgb, var(--qqm-bg) 96%, transparent);
}

.flex-item :deep(.song-item),
.flex-item :deep(.history-item),
.flex-item :deep(.favorite-item) {
  border-radius: 8px;
}
</style>
