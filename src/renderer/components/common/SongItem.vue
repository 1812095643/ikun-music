<template>
  <component
    :is="renderComponent"
    :item="item"
    :favorite="favorite"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
  />
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent } from 'vue';

import type { SongResult } from '@/types/music';

const CompactSongItem = defineAsyncComponent(() => import('./songItemCom/CompactSongItem.vue'));
const HomeSongItem = defineAsyncComponent(() => import('./songItemCom/HomeSongItem.vue'));
const ListSongItem = defineAsyncComponent(() => import('./songItemCom/ListSongItem.vue'));
const MiniSongItem = defineAsyncComponent(() => import('./songItemCom/MiniSongItem.vue'));
const StandardSongItem = defineAsyncComponent(() => import('./songItemCom/StandardSongItem.vue'));

const props = withDefaults(
  defineProps<{
    item: SongResult;
    mini?: boolean;
    list?: boolean;
    compact?: boolean;
    home?: boolean;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    mini: false,
    list: false,
    compact: false,
    home: false,
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

defineEmits(['play', 'select', 'remove-song']);

// 根据属性决定渲染哪个组件
const renderComponent = computed(() => {
  if (props.mini) return MiniSongItem;
  if (props.list) return ListSongItem;
  if (props.compact) return CompactSongItem;
  if (props.home) return HomeSongItem;
  return StandardSongItem;
});
</script>
