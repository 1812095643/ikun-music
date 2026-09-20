<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import LocalMusicSelection from '@/components/LocalMusicSelection.vue';
import TrackList from '@/components/TrackList.vue';
import type { Track } from '@/services/musicApi';
import { nativeDevice } from '@/services/nativeDevice';
import {
  chooseLocalMusic,
  importLocalTracks,
  localBusy,
  localCandidates,
  localError,
  localSelectionOpen,
  localTracks,
  scanLocalMusic
} from '@/stores/localMusic';
import { playTracks } from '@/stores/player';
const emit = defineEmits<{ more: [track: Track] }>();
const keyword = shallowRef('');
const canScan = Boolean(nativeDevice());
const visible = computed(() =>
  localTracks.value.filter((track) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(keyword.value.toLowerCase())
  )
);
</script>
<template>
  <view class="local-view"
    ><view class="local-intro"
      ><text class="local-title">把喜欢的音乐，留在身边</text
      ><text class="local-description">本机文件与互传收到的音乐，勾选后添加到这里。</text
      ><view class="local-actions"
        ><button
          v-if="canScan"
          role="button"
          class="primary-button"
          :disabled="localBusy"
          @click="scanLocalMusic"
        >
          <text class="ri-search-2-line" />扫描本机</button
        ><button role="button" class="choose-files" @click="chooseLocalMusic">
          <text class="ri-folder-music-line" />选择文件
        </button></view
      ></view
    >
    <view v-if="localTracks.length" class="local-toolbar"
      ><button role="button" class="local-play-all" @click="playTracks(visible)">
        <text class="ri-play-circle-fill" />播放全部
        <text class="muted">{{ visible.length }} 首</text></button
      ><input v-model="keyword" class="field-input" placeholder="查找本地歌曲"
    /></view>
    <scroll-view scroll-y class="local-scroll"
      ><track-list :tracks="visible" @more="emit('more', $event)" /><view
        v-if="!localTracks.length"
        class="local-empty"
        ><text class="ri-disc-line" /><text>还没有添加本地音乐</text
        ><text>扫描本机，或从系统文件选择器添加歌曲。</text></view
      ><view class="content-bottom"
    /></scroll-view>
  </view>
  <local-music-selection
    v-if="localSelectionOpen"
    :tracks="localCandidates"
    :busy="localBusy"
    :error="localError"
    @close="localSelectionOpen = false"
    @import="importLocalTracks"
  />
</template>
<style scoped>
.local-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.local-intro {
  padding: 24px var(--page-gutter);
}
.local-title {
  display: block;
  font-size: calc(23px + var(--font-size-adjustment));
  font-weight: 600;
}
.local-description {
  display: block;
  color: var(--qqm-muted);
  font-size: 13px;
  line-height: 1.8;
  margin: 13px 0 20px;
}
.local-actions {
  display: flex;
  gap: 12px;
}
.choose-files {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--qqm-surface) !important;
  border-radius: 24px !important;
  padding: 12px 20px !important;
  font-size: 14px !important;
}
.local-toolbar {
  display: flex;
  align-items: center;
  padding: 12px var(--page-gutter);
  gap: 15px;
  flex-wrap: wrap;
}
.local-play-all {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px !important;
  min-height: 48px;
}
.local-play-all > text:first-child {
  font-size: 28px;
  color: var(--qqm-primary);
}
.local-toolbar .field-input {
  flex: 1;
  min-width: 160px;
  max-width: 420px;
}
.local-scroll {
  flex: 1;
  min-height: 0;
}
.local-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 55px 24px;
  color: var(--qqm-muted);
  text-align: center;
}
.local-empty > text:first-child {
  font-size: 46px;
  color: var(--qqm-accent-text);
}
.local-empty > text:last-child {
  font-size: 12px;
  line-height: 1.8;
}
</style>
