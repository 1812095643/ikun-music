<template>
  <base-song-item
    :item="item"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
    class="list-song-item"
    ref="baseItem"
  >
    <!-- 选择框插槽 -->
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 图片插槽 -->
    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '100y100')"
        class="song-item-img"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous'
        }"
        @load="onImageLoad"
      />
    </template>

    <!-- 内容插槽 -->
    <template #content>
      <div class="song-item-content">
        <div class="song-item-content-wrapper">
          <n-ellipsis
            class="song-item-content-title text-ellipsis"
            line-clamp="1"
            :class="{ 'text-primary': isPlaying }"
          >
            {{ item.name }}
          </n-ellipsis>
          <div class="song-item-content-divider">-</div>
          <n-ellipsis class="song-item-content-name text-ellipsis" line-clamp="1">
            <template v-for="(artist, index) in artists" :key="index">
              <span
                class="cursor-pointer hover:text-primary"
                @click.stop="onArtistClick(artist.id)"
                >{{ artist.name }}</span
              >
              <span v-if="index < artists.length - 1"> / </span>
            </template>
          </n-ellipsis>
        </div>
      </div>
    </template>

    <!-- 操作插槽 -->
    <template #operating>
      <div class="song-item-operating-list">
        <button
          class="song-action-btn"
          :class="{ 'song-action-btn--playing': isPlaying }"
          @click="onPlayMusic"
        >
          <i v-if="isPlaying && play" class="iconfont icon-stop"></i>
          <i v-else class="iconfont icon-playfill"></i>
        </button>
        <button class="song-action-btn" @click.stop="onPlayNext">
          <i class="ri-add-line"></i>
        </button>
        <song-download-button :item="item" size="small" title="下载歌曲" />
        <button class="song-action-btn" @click.stop="onMenuClick">
          <i class="ri-file-copy-line"></i>
        </button>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis, NImage } from 'naive-ui';
import { computed, defineAsyncComponent, ref } from 'vue';

import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

import BaseSongItem from './BaseSongItem.vue';

const SongDownloadButton = defineAsyncComponent(() => import('../SongDownloadButton.vue'));

const playerStore = usePlayerStore();

const props = withDefaults(
  defineProps<{
    item: SongResult;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

const emit = defineEmits(['play', 'select', 'remove-song']);
const baseItem = ref<InstanceType<typeof BaseSongItem>>();

// 从基础组件获取响应式状态
const play = computed(() => playerStore.isPlay);
const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const artists = computed(() => baseItem.value?.artists || []);

// 包装方法，避免直接访问可能为undefined的ref
const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
  emit('select', props.item.id, !props.selected);
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onPlayMusic = () => {
  if (props.isNext) {
    // 搜索页通过 isNext 标记接管播放，先建队列再播放当前项。
    emit('play', props.item);
    return;
  }
  baseItem.value?.playMusicEvent(props.item);
  emit('play', props.item);
};
const onPlayNext = () => {
  baseItem.value?.handlePlayNext();
};
const onMenuClick = (event: MouseEvent) => baseItem.value?.handleMenuClick(event);
</script>

<style lang="scss" scoped>
.list-song-item {
  padding: 0.5rem;
  border-radius: 0.5rem;
  margin-bottom: 0.25rem;
  border-width: 1px;
  border-color: transparent;
  transition:
    background-color 180ms var(--qqm-ease, ease),
    border-color 180ms var(--qqm-ease, ease);

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, transparent);
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, transparent);
  }

  .song-item-img {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    margin-right: 0.75rem;
  }

  .song-item-content {
    display: flex;
    align-items: center;
    flex: 1;

    &-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }

    &-title {
      flex-shrink: 0;
      max-width: 45%;
      color: var(--qqm-text, rgb(23 23 23));
    }

    &-divider {
      margin-left: 0.5rem;
      margin-right: 0.5rem;
      color: var(--qqm-muted, rgb(115 115 115));
    }

    &-name {
      flex: 1;
      min-width: 0;
      color: var(--qqm-muted, rgb(115 115 115));
    }
  }

  .song-item-operating-list {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: clamp(24px, 5vw, 72px);
  }
}

/* dark mode */
.dark .list-song-item {
  border-color: transparent;

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, transparent);
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, transparent);
  }

  .song-item-content {
    &-title {
      color: var(--qqm-on-primary, rgb(245 245 245));
    }

    &-divider,
    &-name {
      color: var(--qqm-muted, rgb(163 163 163));
    }
  }
}

.song-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--qqm-muted, #8a9099) 34%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--qqm-muted, #8a9099);
  cursor: pointer;
  font-size: 17px;
  transition:
    background-color 180ms var(--qqm-ease, ease),
    border-color 180ms var(--qqm-ease, ease),
    color 180ms var(--qqm-ease, ease),
    transform 180ms var(--qqm-ease, ease);
}

.song-action-btn:hover,
.song-action-btn--playing {
  border-color: var(--qqm-primary, #22c55e);
  color: var(--qqm-primary-strong, #0dbd62);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, transparent);
  transform: translateY(-1px);
}
</style>
