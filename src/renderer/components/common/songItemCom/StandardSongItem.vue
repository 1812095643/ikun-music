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
    class="standard-song-item"
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
        <div class="song-item-meta">
          <n-ellipsis
            class="song-item-content-title text-ellipsis"
            line-clamp="1"
            :class="{ 'text-primary': isPlaying }"
          >
            {{ item.name }}
          </n-ellipsis>
          <span v-if="hasMv" class="song-quality-tag">MV</span>
          <span v-if="isVip" class="song-quality-tag">VIP</span>
        </div>
        <n-ellipsis class="song-item-artist text-ellipsis" line-clamp="1">
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
    </template>

    <!-- 操作插槽 -->
    <template #operating>
      <div class="song-item-operating">
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
        <song-download-button :item="item" title="下载歌曲" />
        <button class="song-action-btn" @click.stop="onMenuClick">
          <i class="ri-file-copy-line"></i>
        </button>
        <n-ellipsis class="song-item-artist song-item-artist--desktop" line-clamp="1">
          <template v-for="(artist, index) in artists" :key="index">
            <span
              class="cursor-pointer hover:text-primary"
              @click.stop="onArtistClick(artist.id)"
              >{{ artist.name }}</span
            >
            <span v-if="index < artists.length - 1"> / </span>
          </template>
        </n-ellipsis>
        <span class="song-item-duration">{{ durationText }}</span>
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

// 从playerStore和baseItem获取响应式状态
const play = computed(() => playerStore.isPlay);
const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const artists = computed(() => baseItem.value?.artists || []);
const hasMv = computed(() => Boolean(props.item.song?.mv));
const isVip = computed(() => props.item.song?.fee === 1 || props.item.song?.privilege?.fee === 1);
const durationText = computed(() => formatDuration(getDuration(props.item)));

// 包装方法，避免直接访问可能为undefined的ref
const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onPlayMusic = () => {
  if (props.isNext) {
    // 根因：搜索页需要先由父组件设置“搜索结果列表”作为播放上下文，
    // 再播放当前歌曲；如果这里也直接 setPlay，会和父组件形成两个播放请求。
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

// 不依赖基础组件私有实现，直接按歌曲常见字段格式化列表右侧时长。
const getDuration = (song: SongResult): number => {
  if (song.duration) return song.duration;
  if (typeof song.dt === 'number') return song.dt;
  return 0;
};

const formatDuration = (duration: number): string => {
  if (!duration) return '--:--';
  const totalSeconds = Math.floor(duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
</script>

<style lang="scss" scoped>
.standard-song-item {
  min-height: 80px;
  padding: 6px 18px !important;
  border-radius: 0 !important;
  gap: 18px;

  :deep(.song-item::before) {
    left: 0;
    top: 18px;
    bottom: 18px;
    width: 2px;
  }

  .song-item-img {
    width: 68px;
    height: 68px;
    margin-right: 0;
    border-radius: 4px;
  }

  .song-item-content {
    display: grid;
    grid-template-columns: minmax(220px, 1fr);
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 24px;
  }

  .song-item-meta {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 10px;
  }

  .song-item-content-title {
    max-width: 100%;
    color: var(--qqm-text, #151922);
    font-size: 15px;
    font-weight: 500;
  }

  .song-quality-tag {
    flex: none;
    height: 18px;
    padding: 0 6px;
    border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 80%, transparent);
    border-radius: 3px;
    color: var(--qqm-primary-strong, #0dbd62);
    font-size: 12px;
    line-height: 16px;
  }

  .song-item-artist {
    color: var(--qqm-muted, #6f7580);
    font-size: 14px;
  }

  .song-item-artist:not(.song-item-artist--desktop) {
    display: none;
  }

  .song-item-operating {
    display: grid;
    grid-template-columns: repeat(4, 42px) minmax(110px, 170px) 58px;
    align-items: center;
    justify-content: end;
    gap: 4px;
    min-width: 482px;
    margin-left: clamp(48px, 8vw, 120px);
  }

  .song-item-duration {
    color: var(--qqm-muted, #8a9099);
    font-size: 14px;
    text-align: right;
  }

  .song-item-select {
    margin-right: 4px;
    cursor: pointer;
  }
}

.is-loading {
  opacity: 0.72;
}

.song-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--qqm-muted, #8a9099) 34%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--qqm-muted, #8a9099);
  cursor: pointer;
  font-size: 18px;
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
