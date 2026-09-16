<template>
  <div class="mini-play-bar" :class="{ 'mini-mode': settingsStore.isMiniMode }">
    <div class="mini-main">
      <div class="mini-heading" @mousedown="startWindowDrag">
        <span class="mini-brand"><img src="@/assets/logo.png" alt="" /> ikun音乐</span>
        <span v-if="playMusic?.playLoading" class="mini-status">正在准备音乐</span>
        <button
          class="mini-restore"
          type="button"
          title="还原主窗口"
          aria-label="还原主窗口"
          @click="handleClose"
        >
          <i class="ri-fullscreen-line" aria-hidden="true" />
        </button>
      </div>
      <div class="mini-track">
        <button
          class="album-cover"
          type="button"
          :title="playMusic?.id ? '打开完整播放器' : '去选一首歌'"
          aria-label="打开完整播放器"
          @click="setMusicFull"
        >
          <img
            v-if="coverUrl && !imageFailed"
            :src="coverUrl"
            alt="当前歌曲封面"
            decoding="async"
            @error="imageFailed = true"
          />
          <i v-else class="ri-music-2-line empty-cover-icon" aria-hidden="true" />
        </button>
        <div class="track-content">
          <div class="song-info">
            <button
              type="button"
              class="song-title"
              :title="playMusic?.name || '选择一首喜欢的歌'"
              @click="setMusicFull"
            >
              {{ playMusic?.name || '选择一首喜欢的歌' }}
            </button>
            <div class="song-artist" :title="artistList.map((artist) => artist.name).join(' / ')">
              <template v-if="artistList.length">
                <span
                  v-for="(artist, index) in artistList"
                  :key="index"
                  @click="handleArtistClick(artist.id)"
                  >{{ artist.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}</span
                >
              </template>
              <span v-else>{{ playMusic?.id ? '未知歌手' : '好音乐，随时在身边' }}</span>
            </div>
          </div>
          <div class="control-row">
            <div class="control-buttons">
              <button
                class="control-button"
                type="button"
                aria-label="上一首"
                title="上一首"
                :disabled="!playMusic?.id"
                @click="handlePrev"
              >
                <i class="ri-skip-back-fill" aria-hidden="true" />
              </button>
              <button
                class="control-button play"
                type="button"
                :aria-label="play ? '暂停' : '播放'"
                :title="play ? '暂停' : '播放'"
                :disabled="!playMusic?.id || playMusic?.playLoading"
                @click="playMusicEvent"
              >
                <i
                  :class="
                    playMusic?.playLoading
                      ? 'ri-loader-4-line is-spinning'
                      : play
                        ? 'ri-pause-fill'
                        : 'ri-play-fill'
                  "
                  aria-hidden="true"
                />
              </button>
              <button
                class="control-button"
                type="button"
                aria-label="下一首"
                title="下一首"
                :disabled="!playMusic?.id"
                @click="handleNext"
              >
                <i class="ri-skip-forward-fill" aria-hidden="true" />
              </button>
            </div>
            <button
              class="tool-button favorite-button"
              type="button"
              :aria-label="isFavorite ? '取消收藏' : '收藏'"
              :title="isFavorite ? '取消收藏' : '收藏'"
              :disabled="!playMusic?.id"
              @click="toggleFavorite"
            >
              <i
                :class="isFavorite ? 'ri-heart-fill like-active' : 'ri-heart-line'"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
      <div class="mini-timeline">
        <span>{{ secondToMinute(nowTime) }}</span>
        <input
          type="range"
          min="0"
          :max="allTime || 1"
          step="0.1"
          :value="nowTime"
          :style="{ '--range-fill': `${progressPercent}%` }"
          :disabled="allTime <= 0"
          aria-label="播放进度"
          @change="seekFromRange"
        />
        <span>{{ secondToMinute(allTime) }}</span>
      </div>
      <div class="mini-tools">
        <div class="mini-volume" @wheel.prevent="handleVolumeWheel">
          <button
            class="tool-button"
            type="button"
            title="静音 / 恢复音量"
            aria-label="静音或恢复音量"
            @click="mute"
          >
            <i :class="getVolumeIcon" aria-hidden="true" />
          </button>
          <input
            v-model.number="volumeSlider"
            type="range"
            min="0"
            max="100"
            step="1"
            :style="{ '--range-fill': `${volumeSlider}%` }"
            aria-label="音量"
          />
        </div>
        <div class="secondary-actions">
          <song-download-button
            v-if="playMusic?.id"
            :item="playMusic"
            size="small"
            button-class="tool-button"
            title="下载歌曲"
          />
          <button
            class="tool-button lyric-button"
            type="button"
            title="桌面歌词"
            aria-label="桌面歌词"
            :disabled="!playMusic?.id"
            @click="toggleDesktopLyric"
          >
            词
          </button>
          <button
            class="tool-button queue-button"
            type="button"
            :aria-expanded="isPlaylistOpen"
            aria-label="播放列表"
            title="播放列表"
            @click="togglePlaylist"
          >
            <i class="ri-play-list-2-line" aria-hidden="true" /><span>{{ playList.length }}</span>
          </button>
        </div>
      </div>
    </div>
    <div v-if="!component && isPlaylistOpen" class="playlist-container">
      <div class="playlist-heading">
        <span
          >播放列表 <span class="queue-count">{{ playList.length }} 首</span></span
        ><button type="button" class="tool-button" aria-label="收起播放列表" @click="closePlaylist">
          <i class="ri-arrow-up-s-line" aria-hidden="true" />
        </button>
      </div>
      <n-scrollbar ref="palyListRef" class="playlist-scrollbar">
        <div v-if="!playList.length" class="mini-empty">
          <i class="ri-play-list-2-line" aria-hidden="true" /><span>播放列表还是空的</span
          ><button type="button" @click="handleClose">
            去选一首歌 <i class="ri-arrow-right-line" aria-hidden="true" />
          </button>
        </div>
        <div
          v-for="item in playList"
          :key="`${item.source}-${item.id}`"
          class="music-play-list-content"
        >
          <song-item class="mini-song" :item="item" mini /><button
            class="tool-button"
            type="button"
            :aria-label="`移除 ${item.name}`"
            title="从播放列表移除"
            @click.stop="handleDeleteSong(item)"
          >
            <i class="ri-close-line" aria-hidden="true" />
          </button>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onUnmounted, provide, ref, shallowRef, useTemplateRef, watch } from 'vue';

import SongDownloadButton from '@/components/common/SongDownloadButton.vue';
import SongItem from '@/components/common/SongItem.vue';
import { allTime, artistList, nowTime, openLyric, playMusic } from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { audioService } from '@/services/audioService';
import { usePlayerStore, useSettingsStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl, secondToMinute } from '@/utils';
import { restoreMainWindowFromMiniMode } from '@/utils/miniModeNavigation';

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const { navigateToArtist } = useArtist();
const coverUrl = computed(() => getImgUrl(playMusic.value?.picUrl, '200y200'));
const imageFailed = shallowRef(false);
watch(coverUrl, () => {
  imageFailed.value = false;
});
const progressPercent = computed(() =>
  allTime.value > 0 ? Math.min(100, Math.max(0, (nowTime.value / allTime.value) * 100)) : 0
);

/** 从标题空白处调用 Tauri 原生拖动，按钮仍只响应点击。 */
const startWindowDrag = (event: MouseEvent) => {
  if (event.button === 0 && !(event.target as HTMLElement).closest('button'))
    window.desktop.dragStart();
};
const toggleDesktopLyric = () => openLyric();
const seekFromRange = (event: Event) => {
  if (allTime.value <= 0) return;
  const time = Math.max(
    0,
    Math.min(allTime.value, Number((event.target as HTMLInputElement).value))
  );
  audioService.seek(time);
  nowTime.value = time;
};

withDefaults(
  defineProps<{
    pureModeEnabled?: boolean;
    component?: boolean;
  }>(),
  {
    component: false
  }
);

// 处理关闭按钮点击
const handleClose = () => {
  if (settingsStore.isMiniMode) {
    closePlaylist();
    window.desktop.restore();
  }
};

// 是否播放
const play = computed(() => playerStore.play as boolean);
// 播放列表
const playList = computed(() => playerStore.playList as SongResult[]);

const volumeSlider = computed({
  get: () => playerStore.volume * 100,
  set: (value) => {
    playerStore.setVolume(value / 100);
  }
});

// 迷你窗音量也要复用全局播放器状态，避免和主播放条、托盘状态出现分叉。
const getVolumeIcon = computed(() => {
  if (playerStore.volume === 0) return 'ri-volume-mute-line';
  if (playerStore.volume <= 0.5) return 'ri-volume-down-line';
  return 'ri-volume-up-line';
});

// 静音
const mute = () => {
  if (volumeSlider.value === 0) {
    volumeSlider.value = 30;
  } else {
    volumeSlider.value = 0;
  }
};

// 鼠标滚轮调整音量
const handleVolumeWheel = (e: WheelEvent) => {
  // 向上滚动增加音量，向下滚动减少音量
  const delta = e.deltaY < 0 ? 5 : -5;
  const newValue = Math.min(Math.max(volumeSlider.value + delta, 0), 100);
  volumeSlider.value = newValue;
};

// 收藏相关
const isFavorite = computed(() => {
  return playerStore.favoriteList.includes(playMusic.value.id);
});

const toggleFavorite = async (e: Event) => {
  e.stopPropagation();

  let favoriteId = playMusic.value.id;

  if (isFavorite.value) {
    playerStore.removeFromFavorite(favoriteId);
  } else {
    playerStore.addToFavorite(favoriteId);
  }
};

// 播放列表相关
const palyListRef = useTemplateRef('palyListRef') as any;
const isPlaylistOpen = ref(false);

const resetMiniPlaylistStyles = () => {
  document.body.style.height = '';
  document.body.style.overflow = '';
};

const syncMiniWindowSize = (showPlaylist: boolean) => {
  if (!settingsStore.isMiniMode) return;
  if (window.desktop && typeof window.desktop.resizeMiniWindow === 'function') {
    window.desktop.resizeMiniWindow(showPlaylist);
  }
};

const closePlaylist = () => {
  if (!isPlaylistOpen.value) {
    resetMiniPlaylistStyles();
    syncMiniWindowSize(false);
    return;
  }
  isPlaylistOpen.value = false;
  resetMiniPlaylistStyles();
  syncMiniWindowSize(false);
};

// 迷你窗里无法直接承接歌单抽屉，需要先恢复主窗口再由主布局打开抽屉。
provide('openPlaylistDrawer', (songId: number | string) => {
  if (settingsStore.isMiniMode && window.desktop?.restore) {
    restoreMainWindowFromMiniMode({
      beforeRestore: () => {
        closePlaylist();
        playerStore.setMusicFull(false);
      },
      playlistDrawerSongId: songId,
      restore: window.desktop.restore
    });
  }
});

// 切换播放列表显示/隐藏
const togglePlaylist = () => {
  isPlaylistOpen.value = !isPlaylistOpen.value;
  console.log('切换播放列表状态', isPlaylistOpen.value);

  // 调整窗口大小
  if (settingsStore.isMiniMode) {
    try {
      if (isPlaylistOpen.value) {
        // 打开播放列表时调整DOM
        document.body.style.height = 'auto';
        document.body.style.overflow = 'visible';

        // 使用新的专用 API 调整窗口大小
        syncMiniWindowSize(true);
      } else {
        // 关闭播放列表时强制调整DOM
        resetMiniPlaylistStyles();

        // 使用新的专用 API 调整窗口大小
        syncMiniWindowSize(false);
      }
    } catch (error) {
      console.error('调整窗口大小失败:', error);
    }
  }

  // 如果打开列表，滚动到当前播放歌曲
  if (isPlaylistOpen.value) {
    scrollToPlayList();
  }
};

const scrollToPlayList = () => {
  setTimeout(() => {
    const currentIndex = playerStore.playListIndex;
    const itemHeight = 69; // 每个列表项的高度
    palyListRef.value?.scrollTo({
      top: currentIndex * itemHeight,
      behavior: 'smooth'
    });
  }, 50);
};

const handleDeleteSong = (song: SongResult) => {
  playerStore.removeFromPlayList(song.id as number);
};

// 艺术家点击
const handleArtistClick = (id: number) => {
  navigateToArtist(id);
};

// 播放控制
const handlePrev = () => playerStore.prevPlay();
const handleNext = () => playerStore.nextPlay();

const playMusicEvent = async () => {
  try {
    await playerStore.setPlay(playerStore.playMusic);
  } catch (error) {
    console.error('播放出错:', error);
    playerStore.nextPlay();
  }
};

// 切换到完整播放器
const setMusicFull = () => {
  if (settingsStore.isMiniMode && window.desktop?.restore) {
    // 迷你窗本身不承载完整播放器，先把状态切到展开，再恢复主窗口承接完整播放页。
    restoreMainWindowFromMiniMode({
      beforeRestore: () => {
        closePlaylist();
        playerStore.setMusicFull(Boolean(playMusic.value?.id));
      },
      restore: window.desktop.restore
    });
    return;
  }

  playerStore.setMusicFull(Boolean(playMusic.value?.id));
};

watch(
  () => settingsStore.isMiniMode,
  (isMiniMode) => {
    if (!isMiniMode) {
      closePlaylist();
    }
  }
);

onUnmounted(() => {
  closePlaylist();
});
</script>
<style scoped lang="scss">
/* 精简窗沿用主界面的浅色底、绿色主按钮与细线图标，封面/曲名优先于次要工具。 */
.mini-play-bar {
  --mini-track: color-mix(in srgb, var(--qqm-muted, #6b7470) 17%, transparent);
  height: 100%;
  min-height: 184px;
  overflow: hidden;
  background: var(--qqm-surface, #fafcfb);
  color: var(--qqm-text, #202724);
}
.mini-main {
  box-sizing: border-box;
  height: 184px;
  padding: 10px 16px;
  display: grid;
  grid-template-rows: 16px 80px 18px 24px;
  row-gap: 8px;
}
.mini-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: grab;
}
.mini-brand {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--qqm-muted);
}
.mini-brand img {
  width: 15px;
  height: 15px;
  border-radius: 3px;
  object-fit: cover;
}
.mini-status {
  font-size: 10px;
  color: var(--qqm-muted);
}
.mini-restore {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  color: var(--qqm-muted);
  border-radius: 5px;
  font-size: 15px;
}
.mini-track {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.album-cover {
  width: 80px;
  height: 80px;
  flex: 0 0 80px;
  overflow: hidden;
  border-radius: 9px;
  background: color-mix(in srgb, var(--qqm-muted, #7a8780) 12%, transparent);
  color: var(--qqm-muted);
}
.album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.empty-cover-icon {
  font-size: 30px;
  opacity: 0.5;
}
.track-content {
  height: 80px;
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
}
.song-info {
  min-width: 0;
}
.song-title {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 15px;
  line-height: 22px;
  font-weight: 650;
  color: inherit;
}
.song-artist {
  font-size: 11px;
  line-height: 17px;
  color: var(--qqm-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-artist span {
  cursor: pointer;
}
.control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
}
.control-buttons {
  display: flex;
  align-items: center;
  gap: 14px;
}
.control-button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 28px;
  color: inherit;
  font-size: 21px;
  border: 0 !important;
  background: transparent !important;
  border-radius: 50% !important;
  transition:
    color 150ms,
    transform 150ms;
}
.control-button.play {
  width: 34px;
  height: 34px;
  color: #fff !important;
  background: var(--qqm-primary-strong, #149761) !important;
  font-size: 23px;
}
.control-button.play .ri-play-fill {
  margin-left: 2px;
}
.control-button:not(:disabled):hover {
  color: var(--qqm-primary-strong);
  transform: scale(1.06);
}
.control-button:active {
  transform: scale(0.96);
}
.mini-tools,
.secondary-actions,
.mini-volume {
  display: flex;
  align-items: center;
}
.mini-tools {
  justify-content: space-between;
}
.secondary-actions {
  gap: 10px;
}
.tool-button {
  height: 26px;
  min-width: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--qqm-muted);
  font-size: 15px;
  border-radius: 5px;
}
.tool-button:not(:disabled):hover,
.mini-restore:hover {
  color: var(--qqm-primary-strong);
  background: var(--qqm-primary-soft);
}
.favorite-button {
  margin-right: -4px;
}
.like-active {
  color: var(--qqm-primary-strong);
}
.lyric-button {
  font-size: 12px;
  font-weight: 500;
}
.mini-volume {
  gap: 5px;
}
.mini-volume input {
  width: 60px;
}
.queue-button {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.queue-button i {
  font-size: 17px;
}
.mini-timeline {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--qqm-muted);
}
.mini-timeline input {
  flex: 1;
  min-width: 0;
}
input[type='range'] {
  appearance: none;
  -webkit-appearance: none;
  height: 3px;
  border-radius: 9px;
  background: linear-gradient(
    to right,
    var(--qqm-primary-strong, #149761) var(--range-fill, 0%),
    var(--mini-track) var(--range-fill, 0%)
  );
  cursor: pointer;
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--qqm-primary-strong, #149761);
}
input[type='range']::-moz-range-thumb {
  border: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--qqm-primary-strong, #149761);
}
input[type='range']:disabled::-webkit-slider-thumb {
  opacity: 0;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
input:disabled {
  cursor: default;
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--qqm-primary-strong);
  outline-offset: 3px;
}
.playlist-container {
  height: calc(100vh - 184px);
  background: var(--qqm-surface);
  border-top: 1px solid var(--qqm-border);
}
.playlist-heading {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 600;
}
.queue-count {
  margin-left: 6px;
  font-size: 10px;
  color: var(--qqm-muted);
  font-weight: 400;
}
.playlist-scrollbar {
  height: calc(100% - 42px);
}
.music-play-list-content {
  display: flex;
  align-items: center;
  padding: 3px 10px;
}
.mini-song {
  flex: 1;
  min-width: 0;
}
.mini-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 34px 16px;
  font-size: 12px;
  color: var(--qqm-muted);
}
.mini-empty > i {
  font-size: 28px;
  opacity: 0.45;
}
.mini-empty button {
  color: var(--qqm-primary-strong);
  font-size: 11px;
}
.is-spinning {
  animation: mini-spin 1s linear infinite;
}
@keyframes mini-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-spinning {
    animation: none;
  }
  .control-button {
    transition: none;
  }
}
</style>
