<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import type { Track } from '@/services/musicApi';
import { showSpectrum } from '@/stores/device';
import {
  favoriteIds,
  lyricFontSize,
  setLyricFontSize,
  toast,
  toggleFavorite
} from '@/stores/library';
import {
  current,
  cycleMode,
  duration,
  loading,
  lyricIndex,
  lyrics,
  lyricsLoading,
  mode,
  nextTrack,
  pendingTrack,
  playerError,
  playerOpen,
  playing,
  position,
  previousTrack,
  resolvedFormat,
  seek,
  seekable,
  togglePlay
} from '@/stores/player';

import CoverArt from './CoverArt.vue';
import PlayerLyrics from './PlayerLyrics.vue';
import PlayerProgress from './PlayerProgress.vue';
import SpectrumBars from './SpectrumBars.vue';
const emit = defineEmits<{
  more: [track: Track];
  queue: [];
  download: [track: Track];
  quality: [];
}>();
const page = shallowRef(0);
const backgroundFailed = shallowRef(false);
const liked = computed(() => current.value && favoriteIds.value.has(current.value.id));
let touchY = 0;
watch(
  () => current.value?.cover,
  () => {
    backgroundFailed.value = false;
  }
);
function touchStart(event: any) {
  touchY = event.touches[0].clientY;
}
function touchEnd(event: any) {
  if (event.changedTouches[0].clientY - touchY > 70) playerOpen.value = false;
}
function changeFont() {
  const sizes = [22, 26, 30];
  const index = sizes.indexOf(lyricFontSize.value);
  setLyricFontSize(sizes[(index + 1) % sizes.length]);
  toast(
    `歌词字号：${lyricFontSize.value === 22 ? '标准' : lyricFontSize.value === 26 ? '舒适' : '大字'}`
  );
}
</script>
<template>
  <view
    class="player-sheet"
    :class="{ 'has-error': playerError }"
    role="dialog"
    aria-modal="true"
    aria-label="正在播放"
    ><image
      v-if="current?.cover && !backgroundFailed"
      class="player-background-image"
      :src="current.cover"
      mode="aspectFill"
      @error="backgroundFailed = true" /><view class="player-background-shade" /><view
      class="player-content"
      ><view class="player-heading" @touchstart="touchStart" @touchend="touchEnd"
        ><button
          role="button"
          class="button-icon collapse-player"
          aria-label="收起播放器"
          @click="playerOpen = false"
        >
          <text class="ri-arrow-down-s-line" /></button
        ><view class="player-tabs" role="tablist" aria-label="播放器视图"
          ><button
            role="tab"
            :aria-selected="page === 0"
            :class="{ selected: page === 0 }"
            @click="page = 0"
          >
            歌曲</button
          ><text class="player-tab-separator" /><button
            role="tab"
            :aria-selected="page === 1"
            :class="{ selected: page === 1 }"
            @click="page = 1"
          >
            歌词
          </button></view
        ><button
          role="button"
          class="button-icon player-more"
          aria-label="歌曲操作"
          @click="current && emit('more', current)"
        >
          <text class="ri-more-2-fill" /></button></view
      ><swiper
        class="player-pages"
        :current="page"
        :duration="280"
        @change="page = $event.detail.current"
        ><swiper-item
          ><view class="cover-stage"
            ><view class="player-cover"
              ><cover-art :src="current?.cover" radius="15px" large /></view
            ><view class="listening-state"
              ><view class="listening-mark" :class="{ playing }"><view /><view /><view /></view
              ><text>{{
                pendingTrack
                  ? `正在切换 · ${pendingTrack.title}`
                  : loading
                    ? '正在加载音乐'
                    : playing
                      ? '正在播放'
                      : '已暂停'
              }}</text></view
            ></view
          ></swiper-item
        ><swiper-item
          ><player-lyrics
            :lines="lyrics"
            :active-index="lyricIndex"
            :loading="lyricsLoading"
            :font-size="lyricFontSize"
            :song-id="current?.id"
            @seek="seek" /></swiper-item></swiper
      ><view class="player-lower"
        ><view class="song-heading"
          ><view class="song-info"
            ><text class="song-title ellipsis">{{ current?.title || '选择一首音乐' }}</text
            ><text class="song-artist ellipsis"
              >{{ current?.artist }}<text v-if="current?.album"> · {{ current.album }}</text></text
            ></view
          ><button
            role="button"
            class="button-icon favorite-button"
            :class="{ liked }"
            :aria-label="liked ? '取消喜欢' : '喜欢这首歌'"
            @click="current && toggleFavorite(current)"
          >
            <text :class="liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'" /></button></view
        ><view v-if="playerError" class="player-error"
          ><text>{{ playerError }}</text
          ><button role="button" @click="togglePlay">重试</button></view
        ><player-progress
          :can-seek="seekable"
          :position="position"
          :duration="duration || current?.duration || 0"
          :song-id="current?.id"
          @seek="seek"
        /><view class="playback-controls"
          ><button
            role="button"
            class="button-icon mode-button"
            :aria-label="
              mode === 'repeat' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '顺序播放'
            "
            @click="cycleMode"
          >
            <text
              :class="
                mode === 'repeat'
                  ? 'ri-repeat-one-line'
                  : mode === 'shuffle'
                    ? 'ri-shuffle-line'
                    : 'ri-order-play-line'
              "
            /></button
          ><button
            role="button"
            class="button-icon skip-button"
            aria-label="上一首"
            @click="previousTrack"
          >
            <text class="ri-skip-back-fill" /></button
          ><button
            role="button"
            class="main-play-button"
            :aria-label="playing ? '暂停' : '播放'"
            @click="togglePlay"
          >
            <text v-if="loading" class="spinner" /><text
              v-else
              :class="playing ? 'ri-pause-fill' : 'ri-play-fill'"
            /></button
          ><button
            role="button"
            class="button-icon skip-button"
            aria-label="下一首"
            @click="nextTrack()"
          >
            <text class="ri-skip-forward-fill" /></button
          ><button
            role="button"
            class="button-icon mode-button"
            aria-label="打开播放队列"
            @click="emit('queue')"
          >
            <text class="ri-play-list-2-line" /></button></view
        ><view class="player-footer"
          ><button
            role="button"
            :disabled="Boolean(current?.localUri)"
            @click="current && emit('download', current)"
          >
            <text
              :class="current?.localUri ? 'ri-folder-music-line' : 'ri-download-line'"
            /><text>{{ current?.localUri ? '本地文件' : '下载' }}</text></button
          ><button
            role="button"
            class="quality-entry"
            :disabled="Boolean(current?.localUri)"
            @click="emit('quality')"
          >
            <text class="format-mark">{{ resolvedFormat || 'HQ' }}</text
            ><text>{{ current?.localUri ? '原文件' : '音质' }}</text
            ><text v-if="!current?.localUri" class="ri-arrow-right-s-line" /></button
          ><button v-if="page === 1" role="button" aria-label="调整歌词字号" @click="changeFont">
            <text class="font-symbol">Aa</text><text>字号</text></button
          ><button v-else role="button" @click="page = 1">
            <text class="ri-file-music-line" /><text>歌词</text>
          </button></view
        ><spectrum-bars v-if="showSpectrum" /> </view></view
  ></view>
</template>
<style scoped>
.player-sheet {
  position: absolute;
  inset: 0;
  z-index: 110;
  background: #101c15;
  color: #f2f7f3;
  overflow: hidden;
  animation: sheet-in 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.player-background-image {
  position: absolute;
  inset: -55px;
  width: calc(100% + 110px);
  height: calc(100% + 110px);
  filter: blur(48px);
  opacity: 0.72;
}
.player-background-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(9, 22, 14, 0.55), rgba(9, 22, 14, 0.76) 54%, #0c1811);
}
.player-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
}
.player-heading {
  height: 70px;
  padding: 9px 16px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.collapse-player {
  font-size: 29px !important;
}
.player-more {
  font-size: 23px !important;
}
.player-tabs {
  display: flex;
  align-items: center;
  gap: 19px;
}
.player-tabs button {
  font-size: calc(15px + var(--font-size-adjustment)) !important;
  color: #a9bcae !important;
  padding: 10px 3px !important;
}
.player-tabs button.selected {
  color: #f3fcf5 !important;
  font-weight: 600 !important;
}
.player-tab-separator {
  height: 11px;
  width: 1px;
  background: rgba(228, 242, 231, 0.22);
}
.player-pages {
  flex: 1;
  min-height: 170px;
}
.cover-stage {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px 30px;
  gap: 26px;
}
.player-cover {
  width: min(100%, 328px, calc(100vh - 392px - var(--safe-top) - var(--safe-bottom)));
  width: min(100%, 328px, calc(100dvh - 392px - var(--safe-top) - var(--safe-bottom)));
  min-width: 110px;
  height: auto;
  aspect-ratio: 1;
  flex-shrink: 0;
  border-radius: 15px;
  box-shadow:
    0 22px 50px rgba(0, 0, 0, 0.24),
    0 0 0 1px rgba(255, 255, 255, 0.07);
}
.listening-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #b8cbbf;
  font-size: calc(11px + var(--font-size-adjustment));
  line-height: 1.5;
}
.listening-mark {
  height: 11px;
  display: flex;
  align-items: center;
  gap: 2px;
}
.listening-mark view {
  height: 6px;
  width: 2px;
  border-radius: 2px;
  background: #a7d3b3;
}
.listening-mark view:nth-child(2) {
  height: 11px;
}
.listening-mark view:nth-child(3) {
  height: 8px;
}
.listening-mark.playing view {
  animation: equalize 0.7s ease-in-out infinite alternate;
}
.listening-mark.playing view:nth-child(2) {
  animation-delay: -0.5s;
}
.listening-mark.playing view:nth-child(3) {
  animation-delay: -0.2s;
}
.player-lower {
  padding: 16px 25px 13px;
  flex-shrink: 0;
}
.song-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.song-info {
  flex: 1;
  min-width: 0;
}
.song-title {
  display: block;
  font-size: calc(26px + var(--font-size-adjustment));
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.5px;
}
.song-artist {
  display: block;
  font-size: calc(13px + var(--font-size-adjustment));
  color: #b1c2b6;
  margin-top: 9px;
}
.favorite-button {
  font-size: 26px !important;
  color: #e0ece4 !important;
}
.favorite-button.liked {
  color: #f17d87 !important;
}
.playback-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 19px -7px 16px;
}
.mode-button {
  color: #b9ccbf !important;
  font-size: 24px !important;
}
.skip-button {
  font-size: 32px !important;
}
.main-play-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border-radius: 50% !important;
  background: #eff9f1 !important;
  color: #173926 !important;
  font-size: 41px !important;
  transition: transform 0.16s ease;
}
.main-play-button:active {
  transform: scale(0.94);
}
.main-play-button .spinner {
  height: 26px;
  width: 26px;
}
.player-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px 2px;
  color: #a2b9aa;
}
.player-footer button {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: calc(12px + var(--font-size-adjustment)) !important;
  min-height: 40px;
}
.player-footer button > text:first-child {
  font-size: 21px;
}
.player-footer button[disabled] {
  background: transparent !important;
  opacity: 0.65;
}
.format-mark {
  font-size: 9px !important;
  letter-spacing: 0.5px;
  border: 1px solid #718c7b;
  border-radius: 4px;
  padding: 3px 4px;
  color: #c2d6c9;
}
.quality-entry {
  gap: 6px !important;
}
.quality-entry > .ri-arrow-right-s-line {
  font-size: 15px;
}
.font-symbol {
  font-size: 18px !important;
  font-weight: 500;
}
.player-error {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -7px 0 13px;
  color: #edd2a6;
  font-size: calc(12px + var(--font-size-adjustment));
  line-height: 1.5;
}
.player-error > text {
  flex: 1;
}
.player-error > button {
  padding: 7px 10px !important;
  background: rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px !important;
  white-space: nowrap;
}
@keyframes equalize {
  to {
    transform: scaleY(0.35);
  }
}
@media (max-height: 740px) {
  .player-heading {
    height: 62px;
  }
  .cover-stage {
    gap: 16px;
    padding-top: 7px;
    padding-bottom: 10px;
  }
  .player-lower {
    padding-top: 7px;
    padding-bottom: 6px;
  }
  .song-heading {
    margin-bottom: 12px;
  }
  .song-title {
    font-size: calc(24px + var(--font-size-adjustment));
  }
  .playback-controls {
    margin: 13px -7px 9px;
  }
  .main-play-button {
    height: 61px;
    width: 61px;
    font-size: 38px !important;
  }
  .player-footer {
    padding-top: 4px;
  }
}
.has-error .player-cover {
  width: min(100%, 328px, calc(100dvh - 450px - var(--safe-top) - var(--safe-bottom)));
}
@media (max-height: 520px) and (min-width: 650px) {
  .player-content {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    grid-template-rows: 55px minmax(0, 1fr);
  }
  .player-heading {
    grid-column: 1/-1;
    height: 55px;
  }
  .player-pages {
    min-height: 0;
    height: 100%;
  }
  .cover-stage {
    padding: 8px 16px;
    gap: 13px;
  }
  .player-cover,
  .has-error .player-cover {
    width: min(100%, 240px, calc(100dvh - 120px));
  }
  .player-lower {
    align-self: center;
    padding: 4px 14px 5px 6px;
  }
  .song-title {
    font-size: calc(20px + var(--font-size-adjustment));
  }
  .song-artist {
    font-size: calc(11px + var(--font-size-adjustment));
  }
  .song-heading {
    margin-bottom: 9px;
  }
  .main-play-button {
    height: 52px;
    width: 52px;
    font-size: 32px !important;
  }
  .playback-controls {
    margin: 10px -4px 7px;
  }
  .skip-button {
    font-size: 25px !important;
    width: 37px !important;
  }
  .mode-button {
    font-size: 20px !important;
    width: 31px !important;
  }
  .player-footer {
    padding-left: 0;
    padding-right: 0;
  }
  .player-footer button {
    font-size: 10px !important;
    gap: 4px;
  }
  .player-footer button > text:first-child {
    font-size: 18px;
  }
}
</style>
