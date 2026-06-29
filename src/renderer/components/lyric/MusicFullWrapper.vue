<template>
  <component :is="componentToUse" v-bind="$attrs" ref="musicFullRef" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';

import { isMobile } from '@/utils';

const MusicFull = defineAsyncComponent(() => import('@/components/lyric/MusicFull.vue'));
const MusicFullMobile = defineAsyncComponent(
  () => import('@/components/lyric/MusicFullMobile.vue')
);

// 根据当前设备类型选择需要显示的组件
const componentToUse = computed(() => {
  return isMobile.value ? MusicFullMobile : MusicFull;
});

const musicFullRef = ref();

defineExpose({
  musicFullRef
});
</script>
