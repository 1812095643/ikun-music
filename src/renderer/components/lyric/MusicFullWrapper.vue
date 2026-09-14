<template>
  <component :is="componentToUse" v-bind="$attrs" ref="musicFullRef" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';

// 仅加载当前窗口需要的歌词布局，避免 Windows 播放时也解析移动端完整歌词页。
const MusicFull = defineAsyncComponent(() => import('@/components/lyric/MusicFull.vue'));
const MusicFullMobile = defineAsyncComponent(
  () => import('@/components/lyric/MusicFullMobile.vue')
);
import { isMobile } from '@/utils';

// 根据当前设备类型选择需要显示的组件
const componentToUse = computed(() => {
  return isMobile.value ? MusicFullMobile : MusicFull;
});

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
