<template>
  <div class="menu-row">
    <i class="ri-zoom-in-line" /><span>{{ t('comp.searchBar.zoom') }}</span>
    <div class="zoom-ctrl ml-auto">
      <button class="zoom-btn" @click.stop="decreaseZoom">
        <i class="ri-subtract-line" />
      </button>
      <n-tooltip trigger="hover">
        <template #trigger>
          <span class="zoom-val" :class="{ 'zoom-val--100': isZoom100() }" @click.stop="resetZoom">
            {{ Math.round(zoomFactor * 100) }}%
          </span>
        </template>
        {{ isZoom100() ? t('comp.searchBar.zoom100') : t('comp.searchBar.resetZoom') }}
      </n-tooltip>
      <button class="zoom-btn" @click.stop="increaseZoom"><i class="ri-add-line" /></button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { useZoom } from '@/hooks/useZoom';

const { t } = useI18n();
const { zoomFactor, initZoomFactor, increaseZoom, decreaseZoom, resetZoom, isZoom100 } = useZoom();

onMounted(() => {
  void initZoomFactor();
});
</script>
