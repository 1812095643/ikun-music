<template>
  <div
    class="song-item"
    @contextmenu.prevent="handleContextMenu"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @dblclick.stop="requestPlay(item)"
  >
    <slot name="index"></slot>
    <slot name="select" v-if="selectable"></slot>
    <slot name="image"></slot>
    <slot name="content"></slot>
    <slot name="operating"></slot>

    <song-item-dropdown
      v-if="isElectron"
      :item="item"
      :show="showDropdown"
      :x="dropdownX"
      :y="dropdownY"
      :is-favorite="isFavorite"
      :is-dislike="isDislike"
      :can-remove="canRemove"
      @update:show="showDropdown = $event"
      @play="requestPlay(item)"
      @play-next="handlePlayNext"
      @download="downloadMusic(item)"
      @download-lyric="downloadLyric(item)"
      @toggle-favorite="toggleFavorite"
      @toggle-dislike="toggleDislike"
      @remove="$emit('remove-song', $event)"
    />
  </div>
</template>

<script lang="ts" setup>
import { useSongItem } from '@/hooks/useSongItem';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';

import SongItemDropdown from './SongItemDropdown.vue';

const props = defineProps<{
  item: SongResult;
  selectable?: boolean;
  selected?: boolean;
  canRemove?: boolean;
  isNext?: boolean;
  index?: number;
}>();

const emits = defineEmits(['play', 'select', 'remove-song']);

// 使用公共逻辑
const {
  playLoading,
  isPlaying,
  isFavorite,
  isDislike,
  artists,
  showDropdown,
  dropdownX,
  dropdownY,
  isHovering,
  handleImageLoad,
  playMusicEvent,
  toggleFavorite,
  toggleDislike,
  handlePlayNext,
  handleContextMenu,
  handleMenuClick,
  handleArtistClick,
  handleMouseEnter,
  handleMouseLeave,
  downloadMusic,
  downloadLyric
} = useSongItem(props);

const requestPlay = async (song: SongResult) => {
  if (props.isNext) {
    // 搜索结果页通过 isNext 标记接管播放，先建队列再播放当前项。
    // 否则双击/菜单播放会绕过父组件，重新出现“只插队或重复解析”的问题。
    emits('play', song);
    return;
  }
  await playMusicEvent(song);
};

// 处理图片加载
const imageLoad = async (event: Event) => {
  const target = event.target as HTMLImageElement;
  if (!target) return;
  await handleImageLoad(target);
};

// 切换选择状态
const toggleSelect = () => {
  emits('select', props.item.id, !props.selected);
};

// 把图片处理、艺术家处理等公共方法暴露给子组件
defineExpose({
  imageLoad,
  toggleSelect,
  handleArtistClick,
  handleMenuClick,
  playMusicEvent,
  requestPlay,
  toggleFavorite,
  handlePlayNext,
  playLoading,
  isPlaying,
  isFavorite,
  isDislike,
  artists,
  isHovering
});
</script>

<style lang="scss" scoped>
.song-item {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  @apply rounded-lg p-3 flex items-center bg-transparent dark:text-neutral-100 text-neutral-900;
  position: relative;
  transition:
    background-color 180ms var(--qqm-ease, ease),
    color 180ms var(--qqm-ease, ease);

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 2px;
    border-radius: 999px;
    background: var(--qqm-primary, #22c55e);
    opacity: 0;
    transition: opacity 180ms var(--qqm-ease, ease);
  }

  &:hover {
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, transparent);
  }

  &:hover::before {
    opacity: 1;
  }
}

.text-ellipsis {
  width: 100%;
}
</style>
