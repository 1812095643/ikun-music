<script setup lang="ts">
import { computed } from 'vue';

import { wideLayout } from '@/stores/device';
import { favoriteIds, toast, toggleFavorite } from '@/stores/library';
import {
  current,
  duration,
  loading,
  nextTrack,
  pendingTrack,
  playerOpen,
  playing,
  position,
  previousTrack,
  togglePlay
} from '@/stores/player';

import CoverArt from './CoverArt.vue';
const emit = defineEmits<{ queue: [] }>();
const liked = computed(() => current.value && favoriteIds.value.has(current.value.id));
</script>
<template>
  <view class="mini-player"
    ><button
      role="button"
      class="mini-main"
      aria-label="展开播放器"
      @click="current ? (playerOpen = true) : toast('先选一首喜欢的歌吧')"
    >
      <view class="mini-cover"><cover-art :src="current?.cover" radius="7px" /></view
      ><view class="mini-info"
        ><text class="mini-title ellipsis">{{
          pendingTrack ? `正在切换 · ${pendingTrack.title}` : current?.title || '从一首喜欢的歌开始'
        }}</text
        ><text class="mini-artist ellipsis">{{
          current?.artist || '好音乐，随时在身边'
        }}</text></view
      ></button
    ><button
      role="button"
      class="button-icon mini-favorite"
      :class="{ liked }"
      :aria-label="liked ? '取消喜欢' : '喜欢这首歌'"
      :disabled="!current"
      @click="current && toggleFavorite(current)"
    >
      <text :class="liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'" /></button
    ><button
      v-if="wideLayout"
      role="button"
      class="button-icon mini-previous"
      aria-label="上一首"
      :disabled="!current"
      @click="previousTrack"
    >
      <text class="ri-skip-back-fill" /></button
    ><button
      role="button"
      class="button-icon mini-control"
      :aria-label="playing ? '暂停' : '播放'"
      @click="togglePlay"
    >
      <text v-if="loading" class="spinner" /><text
        v-else
        :class="playing ? 'ri-pause-fill' : 'ri-play-fill'"
      /></button
    ><button
      v-if="wideLayout"
      role="button"
      class="button-icon mini-next"
      aria-label="下一首"
      :disabled="!current"
      @click="nextTrack()"
    >
      <text class="ri-skip-forward-fill" /></button
    ><button
      role="button"
      class="button-icon mini-queue"
      aria-label="播放队列"
      @click="emit('queue')"
    >
      <text class="ri-play-list-2-line" /></button
    ><view class="mini-timeline"
      ><view
        :style="{
          transform: `scaleX(${duration > 0 ? Math.min(1, position / duration) : 0})`
        }" /></view
  ></view>
</template>
<style scoped>
.mini-player {
  display: flex;
  position: relative;
  align-items: center;
  height: var(--bar-height);
  min-height: var(--bar-height);
  background: var(--qqm-surface);
  padding: 3px 12px 3px var(--page-gutter);
  flex-shrink: 0;
  box-shadow:
    0 -1px 0 rgba(95, 113, 103, 0.025),
    0 -6px 24px rgba(19, 35, 25, 0.045);
  border-radius: 20px 20px 0 0;
}
.mini-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.mini-cover {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  transform: translateY(-5px);
  border-radius: 7px;
  box-shadow: 0 4px 9px rgba(20, 35, 25, 0.13);
}
.mini-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  padding-bottom: 4px;
}
.mini-title {
  font-size: calc(14px + var(--font-size-adjustment));
  font-weight: 500;
  line-height: 1.5;
}
.mini-artist {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.mini-control {
  font-size: 30px !important;
  width: 44px !important;
}
.mini-queue {
  font-size: 23px !important;
  width: 44px !important;
}
.mini-favorite {
  font-size: 23px !important;
  width: 44px !important;
}
.mini-favorite.liked {
  color: #ed737a;
}
.mini-timeline {
  position: absolute;
  left: calc(var(--page-gutter) + 60px);
  right: var(--page-gutter);
  bottom: 1px;
  height: 1.5px;
  border-radius: 1px;
  background: var(--qqm-surface-muted);
  overflow: hidden;
}
.mini-timeline view {
  height: 100%;
  background: var(--qqm-primary);
  transform-origin: left;
  transition: transform 0.25s linear;
}
@media (max-width: 365px) {
  .mini-player {
    padding-left: 16px;
    padding-right: 7px;
  }
  .mini-main {
    gap: 10px;
  }
  .mini-cover {
    width: 46px;
    height: 46px;
  }
  .mini-title {
    font-size: calc(13px + var(--font-size-adjustment));
  }
  .mini-favorite {
    width: 44px !important;
  }
  .mini-control {
    width: 44px !important;
  }
  .mini-queue {
    width: 44px !important;
  }
}
</style>
