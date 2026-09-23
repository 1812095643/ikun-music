<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';

import SpectrumBars from '@/components/player/SpectrumBars.vue';
import type { SongResult } from '@/types/music';
import { getImgUrl, secondToMinute } from '@/utils';

import { EMPTY_SPECTRUM, type SpectrumFrame } from '../../../shared/audioSpectrum';

type TrayPanelState = {
  song?: SongResult;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  favoriteIds: Array<number | string>;
  playMode: number;
  playListCount: number;
  playListIndex: number;
  currentTime: number;
  duration: number;
  theme: 'light' | 'dark';
  updatedAt: number;
};

const nowTime = ref(0);
const allTime = ref(0);
const isDraggingProgress = ref(false);
const dragProgress = ref(0);
const pendingCommand = ref<string | null>(null);
const spectrumFrame = shallowRef<SpectrumFrame>(EMPTY_SPECTRUM);
let removeSpectrumListener: (() => void) | undefined;
const previousVolume = ref(Number(localStorage.getItem('trayPreviousVolume') || '0.7'));
const removeTrayPanelStateListener = ref<(() => void) | null>(null);
const removeTrayPanelOpenedListener = ref<(() => void) | null>(null);
const listenerReadyTimer = ref<number | null>(null);

const getInitialTheme = (): 'light' | 'dark' => {
  const storedTheme = localStorage.getItem('theme');
  return storedTheme === 'dark' ? 'dark' : 'light';
};

const blockingCommandActions = new Set([
  'togglePlay',
  'prevPlay',
  'nextPlay',
  'toggleFavorite',
  'togglePlayMode',
  'openLyric'
]);

const transportCommandActions = new Set(['togglePlay', 'prevPlay', 'nextPlay']);

const externalState = reactive<TrayPanelState>({
  song: undefined,
  isPlaying: false,
  volume: 1,
  muted: false,
  favoriteIds: [],
  playMode: 0,
  playListCount: 0,
  playListIndex: 0,
  currentTime: 0,
  duration: 0,
  theme: getInitialTheme(),
  updatedAt: 0
});

const currentSong = computed(() => externalState.song as SongResult | undefined);
const hasSong = computed(() => Boolean(currentSong.value?.id));
const isPlaying = computed(() => Boolean(externalState.isPlaying));
const isDarkTheme = computed(() => externalState.theme === 'dark');
const isCommandPending = computed(() => Boolean(pendingCommand.value));
const isTransportCommandPending = computed(
  () => Boolean(pendingCommand.value) && transportCommandActions.has(pendingCommand.value as string)
);
const volume = computed(() => {
  const currentVolume = Number.isFinite(externalState.volume) ? externalState.volume : 1;
  return Math.max(0, Math.min(1, currentVolume || 0));
});
const volumePercent = computed(() => Math.round(volume.value * 100));
const isFavorite = computed(() => {
  const songId = currentSong.value?.id;
  if (!songId) return false;
  return (
    externalState.favoriteIds.includes(songId) || externalState.favoriteIds.includes(Number(songId))
  );
});
const coverUrl = computed(() => getImgUrl(currentSong.value?.picUrl, '160y160'));
const artistText = computed(() => getArtistText(currentSong.value) || '未知歌手');
const titleText = computed(() => currentSong.value?.name || '暂未播放歌曲');
const progressPercent = computed(() => {
  const duration = allTime.value;
  const current = isDraggingProgress.value ? dragProgress.value : nowTime.value;
  if (!duration || duration <= 0) return 0;
  return Math.max(0, Math.min(100, (current / duration) * 100));
});
const volumeIcon = computed(() => {
  if (volume.value <= 0) return 'ri-volume-mute-line';
  if (volume.value <= 0.5) return 'ri-volume-down-line';
  return 'ri-volume-up-line';
});
const playModeIcon = computed(() => {
  switch (externalState.playMode) {
    case 1:
      return 'ri-repeat-one-line';
    case 2:
      return 'ri-shuffle-line';
    default:
      return 'ri-repeat-2-line';
  }
});
const playModeText = computed(() => {
  switch (externalState.playMode) {
    case 1:
      return '单曲循环';
    case 2:
      return '随机播放';
    default:
      return '列表循环';
  }
});
const playlistMeta = computed(() => {
  const count = externalState.playListCount || 0;
  const index = Math.min(Math.max((externalState.playListIndex || 0) + 1, 1), Math.max(count, 1));
  return count > 0 ? `${index} / ${count}` : '播放列表为空';
});

const getArtistText = (song: SongResult | Record<string, any> | undefined) => {
  const artistGroups = [
    song?.ar,
    song?.artists,
    song?.song?.artists,
    song?.song?.ar,
    song?.album?.artists
  ];
  const artists = artistGroups.find((item) => Array.isArray(item)) as
    | Array<{ name?: string }>
    | undefined;

  if (!artists?.length) return '';
  return artists
    .map((artist) => artist?.name)
    .filter(Boolean)
    .join(' / ');
};

const syncProgressFromState = () => {
  const duration =
    Number(externalState.duration || 0) ||
    Number(currentSong.value?.dt || currentSong.value?.duration || 0) / 1000 ||
    0;
  const current = Number(externalState.currentTime || 0);
  allTime.value = Number.isFinite(duration) ? duration : 0;
  if (!isDraggingProgress.value && Number.isFinite(current)) {
    nowTime.value = current;
  }
};

const closeTrayPanel = () => {
  window.desktop?.hideTrayPanel?.();
};

const sendPanelCommand = (action: string, value?: number) => {
  // 根因：托盘面板以前把 requestState、音量拖动、进度拖动都当作“需要等待回包”的命令，
  // 第一次打开面板会被 requestState 锁住，用户马上点播放/拖音量就会被本地拦截，看起来像按钮失效。
  // 解决：只有播放、切歌、收藏、播放模式、打开歌词这类离散动作进入等待态；连续控制直接发送给主窗口。
  if (blockingCommandActions.has(action)) {
    pendingCommand.value = action;
  }
  window.desktop?.sendTrayPanelCommand?.({
    action,
    value
  });
  if (!blockingCommandActions.has(action)) return;
  window.setTimeout(() => {
    if (pendingCommand.value === action) pendingCommand.value = null;
  }, 1200);
};

const runPanelAction = (action: 'togglePlay' | 'prevPlay' | 'nextPlay' | 'toggleFavorite') => {
  if (isCommandPending.value) return;
  if (!hasSong.value && action !== 'togglePlay') return;
  sendPanelCommand(action);
};

const handlePlayToggle = () => {
  if (isCommandPending.value) return;
  if (!hasSong.value) return;
  sendPanelCommand('togglePlay');
};

const handleVolumeInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const nextVolume = Number(target.value) / 100;
  externalState.volume = nextVolume;
  externalState.muted = nextVolume <= 0;
  sendPanelCommand('setVolume', nextVolume);
  if (nextVolume > 0) {
    previousVolume.value = nextVolume;
    localStorage.setItem('trayPreviousVolume', String(nextVolume));
  }
};

const toggleMute = () => {
  if (volume.value > 0) {
    previousVolume.value = volume.value;
    localStorage.setItem('trayPreviousVolume', String(volume.value));
    externalState.volume = 0;
    externalState.muted = true;
    sendPanelCommand('setVolume', 0);
    return;
  }

  const restoredVolume = Number.isFinite(previousVolume.value)
    ? Math.max(0.1, Math.min(1, previousVolume.value))
    : 0.7;
  externalState.volume = restoredVolume;
  externalState.muted = false;
  sendPanelCommand('setVolume', restoredVolume);
};

const handleProgressInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const percent = Number(target.value) / 100;
  dragProgress.value = Math.max(0, allTime.value * percent);
};

const handleProgressCommit = () => {
  if (isTransportCommandPending.value) return;
  if (!hasSong.value || !allTime.value) return;
  isDraggingProgress.value = false;
  nowTime.value = dragProgress.value;
  externalState.currentTime = dragProgress.value;
  sendPanelCommand('seek', dragProgress.value);
};

const handleProgressStart = () => {
  isDraggingProgress.value = true;
  dragProgress.value = nowTime.value;
};

const showMainWindow = () => {
  sendPanelCommand('restoreWindow');
  closeTrayPanel();
};

const enterMiniMode = () => {
  sendPanelCommand('miniWindow');
  closeTrayPanel();
};

const openLyricWindow = () => {
  if (isCommandPending.value) return;
  if (!hasSong.value) return;
  sendPanelCommand('openLyric');
  closeTrayPanel();
};

const togglePlayMode = () => {
  if (isCommandPending.value) return;
  sendPanelCommand('togglePlayMode');
};

const quitApp = () => {
  window.desktop?.quitApp?.();
};

const getPanelStatePayload = (eventOrPayload: unknown, payload?: TrayPanelState) => {
  if (payload) return payload;
  return eventOrPayload as TrayPanelState;
};

const handlePanelState = (eventOrPayload: unknown, payload?: TrayPanelState) => {
  const state = getPanelStatePayload(eventOrPayload, payload);
  if (!state) return;
  if (!state.isPlaying || String(state.song?.id) !== String(externalState.song?.id)) {
    spectrumFrame.value = EMPTY_SPECTRUM;
  }
  externalState.song = state.song;
  externalState.isPlaying = Boolean(state.isPlaying);
  externalState.volume = Number(state.volume || 0);
  externalState.muted = Boolean(state.muted);
  externalState.favoriteIds = Array.isArray(state.favoriteIds) ? state.favoriteIds : [];
  externalState.playMode = Number(state.playMode || 0);
  externalState.playListCount = Number(state.playListCount || 0);
  externalState.playListIndex = Number(state.playListIndex || 0);
  externalState.currentTime = Number(state.currentTime || 0);
  externalState.duration = Number(state.duration || 0);
  externalState.theme = state.theme === 'dark' ? 'dark' : 'light';
  externalState.updatedAt = Number(state.updatedAt || Date.now());
  pendingCommand.value = null;
  localStorage.setItem('theme', externalState.theme);
  document.documentElement.classList.toggle('dark', externalState.theme === 'dark');
  syncProgressFromState();
};

const handlePanelOpened = () => {
  sendPanelCommand('requestState');
  syncProgressFromState();
};

let progressTimer: number | null = null;

watch(
  () => currentSong.value?.id,
  () => syncProgressFromState(),
  { immediate: true }
);

onMounted(() => {
  document.documentElement.classList.add('tray-panel-root');
  document.documentElement.classList.toggle('dark', externalState.theme === 'dark');
  syncProgressFromState();
  progressTimer = window.setInterval(syncProgressFromState, 500);

  if (window.desktop) {
    removeSpectrumListener = window.desktop.on('tray-panel-spectrum', (_, payload) => {
      if (String(payload?.songId) !== String(currentSong.value?.id)) return;
      if (!Array.isArray(payload?.frame?.left) || !Array.isArray(payload?.frame?.right)) return;
      spectrumFrame.value = isPlaying.value ? payload.frame : EMPTY_SPECTRUM;
    });
    removeTrayPanelStateListener.value = window.desktop.on('tray-panel-state', handlePanelState);
    removeTrayPanelOpenedListener.value = window.desktop.on('tray-panel-opened', handlePanelOpened);
  }
  // 根因：Tauri listen 底层是异步注册，兼容层为了保持 桌面运行时 风格返回了同步取消函数。
  // 如果面板 mounted 后立刻发送 requestState，主窗口可能马上回推 tray-panel-state，
  // 但当前 WebView 监听尚未真正落到 Tauri 事件系统里，第一包状态就被丢掉。
  // 解决：下一轮事件循环再请求一次，并由主窗口 500ms 定时推送兜底，确保首次打开能拿到真实播放数据。
  listenerReadyTimer.value = window.setTimeout(() => {
    sendPanelCommand('requestState');
  }, 0);
});

onUnmounted(() => {
  document.documentElement.classList.remove('tray-panel-root');
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
  removeSpectrumListener?.();
  if (listenerReadyTimer.value) {
    window.clearTimeout(listenerReadyTimer.value);
    listenerReadyTimer.value = null;
  }
  removeTrayPanelStateListener.value?.();
  removeTrayPanelOpenedListener.value?.();
});
</script>

<template>
  <main class="tray-panel-shell" :class="{ 'is-dark': isDarkTheme, 'is-light': !isDarkTheme }">
    <section class="tray-panel-card">
      <div class="tray-header">
        <div class="brand-mark">
          <span class="brand-dot"></span>
          <span>ikun音乐</span>
        </div>
        <button class="icon-button soft" title="关闭" @click="closeTrayPanel">
          <i class="ri-close-line"></i>
        </button>
      </div>

      <div class="song-section">
        <div class="cover-wrap" :class="{ playing: isPlaying }">
          <img v-if="coverUrl" class="cover-img" :src="coverUrl" alt="歌曲封面" />
          <div v-else class="cover-fallback">
            <i class="ri-music-2-line"></i>
          </div>
        </div>

        <div class="song-meta">
          <div class="song-title" :title="titleText">{{ titleText }}</div>
          <div class="song-artist" :title="artistText">{{ artistText }}</div>
          <div class="song-status">
            <span class="status-pill" :class="{ active: isPlaying }">
              {{ isPlaying ? '正在播放' : hasSong ? '已暂停' : '等待播放' }}
            </span>
            <span class="playlist-meta">{{ playlistMeta }}</span>
          </div>
        </div>
      </div>

      <div class="progress-block">
        <input
          class="range progress-range"
          type="range"
          min="0"
          max="100"
          step="0.1"
          :value="progressPercent"
          :disabled="!hasSong || !allTime || isTransportCommandPending"
          :style="{ '--range-value': `${progressPercent}%` }"
          @pointerdown="handleProgressStart"
          @input="handleProgressInput"
          @change="handleProgressCommit"
        />
        <div class="time-row">
          <span>{{ secondToMinute(isDraggingProgress ? dragProgress : nowTime) }}</span>
          <span>{{ secondToMinute(allTime) }}</span>
        </div>
      </div>
      <spectrum-bars class="tray-spectrum" compact :frame="spectrumFrame" :playing="isPlaying" />

      <div class="main-controls">
        <button
          class="icon-button"
          :disabled="!hasSong || isCommandPending"
          title="上一首"
          @click="runPanelAction('prevPlay')"
        >
          <i class="ri-skip-back-fill"></i>
        </button>
        <button
          class="play-button"
          :disabled="!hasSong || isCommandPending"
          :title="isPlaying ? '暂停' : '播放'"
          @click="handlePlayToggle"
        >
          <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
        </button>
        <button
          class="icon-button"
          :disabled="!hasSong || isCommandPending"
          title="下一首"
          @click="runPanelAction('nextPlay')"
        >
          <i class="ri-skip-forward-fill"></i>
        </button>
      </div>

      <div class="quick-actions">
        <button
          class="quick-action"
          :class="{ active: isFavorite }"
          :disabled="!hasSong || isCommandPending"
          title="收藏"
          @click="runPanelAction('toggleFavorite')"
        >
          <i :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'"></i>
          <span>{{ isFavorite ? '已喜欢' : '喜欢' }}</span>
        </button>
        <button
          class="quick-action"
          :disabled="isCommandPending"
          title="播放模式"
          @click="togglePlayMode"
        >
          <i :class="playModeIcon"></i>
          <span>{{ playModeText }}</span>
        </button>
        <button
          class="quick-action"
          :disabled="!hasSong || isCommandPending"
          title="歌词"
          @click="openLyricWindow"
        >
          <i class="ri-netease-cloud-music-line"></i>
          <span>歌词</span>
        </button>
      </div>

      <div class="volume-block">
        <button
          class="icon-button soft"
          :title="volume.valueOf() <= 0 ? '取消静音' : '静音'"
          @click="toggleMute"
        >
          <i :class="volumeIcon"></i>
        </button>
        <input
          class="range volume-range"
          type="range"
          min="0"
          max="100"
          step="1"
          :value="volumePercent"
          :style="{ '--range-value': `${volumePercent}%` }"
          @input="handleVolumeInput"
        />
        <span class="volume-text">{{ volumePercent }}%</span>
      </div>

      <div class="window-actions">
        <button class="window-action primary" @click="showMainWindow">
          <i class="ri-window-line"></i>
          <span>显示主窗口</span>
        </button>
        <button class="window-action" @click="enterMiniMode">
          <i class="ri-picture-in-picture-line"></i>
          <span>精简模式</span>
        </button>
        <button class="window-action danger" @click="quitApp">
          <i class="ri-shut-down-line"></i>
          <span>退出</span>
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.tray-panel-shell {
  --tray-bg: #f6f7f8;
  --tray-card-bg:
    radial-gradient(circle at 18% 8%, rgba(30, 207, 115, 0.1), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f7f8fa 48%, #eef1f3 100%);
  --tray-text: #151922;
  --tray-muted: rgba(64, 70, 78, 0.62);
  --tray-subtle: rgba(21, 25, 34, 0.07);
  --tray-subtle-hover: rgba(21, 25, 34, 0.11);
  --tray-border: rgba(21, 25, 34, 0.08);
  --tray-thumb-border: #eef1f3;
  --tray-panel-shadow: 0 18px 48px rgba(11, 17, 24, 0.16);
  --tray-primary: #1ecf73;
  --tray-primary-hover: #17bd66;
  --tray-primary-text: #0d1d13;
  --tray-primary-soft: #dff8e9;
  --tray-primary-soft-hover: #ccf2dc;
  --tray-danger: #ff637d;
  --tray-danger-hover: #e65065;
  --tray-danger-soft-hover: rgba(255, 99, 125, 0.12);
  --tray-cover-bg: linear-gradient(135deg, #e4e8ec, #f7f9fa);
  --tray-cover-shadow: 0 10px 22px rgba(11, 17, 24, 0.18);
  --tray-cover-border: rgba(21, 25, 34, 0.08);
  --tray-cover-playing-shadow: 0 14px 28px rgba(11, 17, 24, 0.2);
  --tray-cover-fallback: rgba(21, 25, 34, 0.36);
  --tray-thumb-bg: #ffffff;
  --tray-thumb-shadow: 0 3px 10px rgba(11, 17, 24, 0.18);
  --tray-primary-shadow: 0 12px 26px rgba(30, 207, 115, 0.26);
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  color: var(--tray-text);
  background: var(--tray-bg);
  font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', system-ui, sans-serif;
  font-weight: 500;
}

.tray-panel-shell.is-dark {
  --tray-bg: #101112;
  --tray-card-bg:
    radial-gradient(circle at 18% 8%, rgba(30, 207, 115, 0.18), transparent 34%),
    linear-gradient(180deg, #2a2c2e 0%, #171819 48%, #121314 100%);
  --tray-text: #f7faf8;
  --tray-muted: rgba(247, 250, 248, 0.58);
  --tray-subtle: rgba(255, 255, 255, 0.07);
  --tray-subtle-hover: rgba(255, 255, 255, 0.13);
  --tray-border: rgba(255, 255, 255, 0.08);
  --tray-thumb-border: #121314;
  --tray-panel-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
  --tray-primary-hover: #32de84;
  --tray-primary-soft: rgba(30, 207, 115, 0.17);
  --tray-primary-soft-hover: rgba(30, 207, 115, 0.24);
  --tray-cover-bg: linear-gradient(135deg, #3a3d3f, #171819);
  --tray-cover-shadow: 0 10px 22px rgba(0, 0, 0, 0.34);
  --tray-cover-border: rgba(255, 255, 255, 0.08);
  --tray-cover-playing-shadow: 0 14px 28px rgba(0, 0, 0, 0.36);
  --tray-cover-fallback: rgba(255, 255, 255, 0.55);
  --tray-thumb-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
}

.tray-panel-card {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 14px;
  background: var(--tray-card-bg);
  border: 1px solid var(--tray-border);
  box-shadow: var(--tray-panel-shadow);
}

.tray-header,
.song-section,
.song-status,
.main-controls,
.quick-actions,
.volume-block,
.window-actions,
.brand-mark {
  display: flex;
  align-items: center;
}

.tray-header {
  justify-content: space-between;
  margin-bottom: 14px;
}

.brand-mark {
  gap: 8px;
  color: color-mix(in srgb, var(--tray-text) 82%, transparent);
  font-size: 13px;
}

.brand-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #1ecf73;
  box-shadow: 0 0 16px rgba(30, 207, 115, 0.78);
}

.song-section {
  gap: 14px;
  min-height: 92px;
}

.cover-wrap {
  width: 88px;
  height: 88px;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 10px;
  background: var(--tray-cover-bg);
  box-shadow:
    var(--tray-cover-shadow),
    inset 0 0 0 1px var(--tray-cover-border);
}

.cover-wrap.playing {
  box-shadow:
    0 0 0 1px rgba(30, 207, 115, 0.36),
    var(--tray-cover-playing-shadow);
}

.cover-img,
.cover-fallback {
  width: 100%;
  height: 100%;
}

.cover-img {
  display: block;
  object-fit: cover;
}

.cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tray-cover-fallback);
  font-size: 34px;
}

.song-meta {
  min-width: 0;
  flex: 1;
}

.song-title,
.song-artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title {
  max-width: 206px;
  margin-bottom: 8px;
  color: var(--tray-text);
  font-size: 17px;
  line-height: 1.25;
}

.song-artist {
  max-width: 206px;
  color: var(--tray-muted);
  font-size: 12px;
}

.song-status {
  gap: 8px;
  margin-top: 13px;
  font-size: 11px;
}

.status-pill,
.playlist-meta {
  min-width: 0;
  height: 24px;
  padding: 0 9px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  color: color-mix(in srgb, var(--tray-text) 64%, transparent);
  background: var(--tray-subtle);
}

.status-pill.active {
  color: var(--tray-primary-text);
  background: var(--tray-primary);
}

.progress-block {
  margin-top: 14px;
}

.range {
  --range-value: 0%;
  width: 100%;
  height: 18px;
  margin: 0;
  appearance: none;
  cursor: pointer;
  background: transparent;
}

.range:disabled {
  cursor: default;
  opacity: 0.42;
}

.range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--tray-primary) 0%,
    var(--tray-primary) var(--range-value),
    color-mix(in srgb, var(--tray-text) 14%, transparent) var(--range-value),
    color-mix(in srgb, var(--tray-text) 14%, transparent) 100%
  );
}

.range::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  margin-top: -4.5px;
  appearance: none;
  border: 2px solid var(--tray-thumb-border);
  border-radius: 999px;
  background: var(--tray-thumb-bg);
  box-shadow: var(--tray-thumb-shadow);
}

.time-row {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  color: color-mix(in srgb, var(--tray-text) 50%, transparent);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.main-controls {
  justify-content: center;
  gap: 18px;
  margin-top: 8px;
}
.tray-spectrum {
  margin-top: 2px;
  color: var(--tray-primary);
}

.icon-button,
.play-button,
.quick-action,
.window-action {
  border: 0;
  outline: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition:
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 160ms cubic-bezier(0.22, 1, 0.36, 1),
    color 160ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.icon-button {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tray-subtle);
  color: color-mix(in srgb, var(--tray-text) 78%, transparent);
  font-size: 20px;
}

.icon-button.soft {
  width: 30px;
  height: 30px;
  font-size: 17px;
  background: var(--tray-subtle);
}

.play-button {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tray-primary-text);
  background: var(--tray-primary);
  font-size: 30px;
  box-shadow: var(--tray-primary-shadow);
}

.icon-button:hover,
.quick-action:hover,
.window-action:hover {
  transform: translateY(-1px);
  background: var(--tray-subtle-hover);
}

.play-button:hover {
  transform: translateY(-1px) scale(1.02);
  background: var(--tray-primary-hover);
}

button:disabled {
  cursor: default;
  opacity: 0.42;
}

button:disabled:hover {
  transform: none;
}

.quick-actions {
  gap: 8px;
  margin-top: 14px;
}

.quick-action {
  min-width: 0;
  height: 38px;
  flex: 1;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: color-mix(in srgb, var(--tray-text) 75%, transparent);
  background: var(--tray-subtle);
  font-size: 12px;
}

.quick-action span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action i {
  font-size: 17px;
}

.quick-action.active {
  color: var(--tray-danger);
  background: rgba(255, 99, 125, 0.12);
}

.volume-block {
  gap: 10px;
  margin-top: 12px;
  padding: 11px;
  border-radius: 9px;
  background: var(--tray-subtle);
}

.volume-range {
  flex: 1;
}

.volume-text {
  width: 42px;
  color: color-mix(in srgb, var(--tray-text) 68%, transparent);
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.window-actions {
  gap: 8px;
  margin-top: 12px;
}

.window-action {
  min-width: 0;
  height: 38px;
  flex: 1;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: color-mix(in srgb, var(--tray-text) 74%, transparent);
  background: var(--tray-subtle);
  font-size: 12px;
}

.window-action i {
  font-size: 16px;
}

.window-action.primary {
  color: var(--tray-primary-text);
  background: var(--tray-primary-soft);
}

.window-action.primary:hover {
  background: var(--tray-primary-soft-hover);
}

.window-action.danger:hover {
  color: var(--tray-danger-hover);
  background: var(--tray-danger-soft-hover);
}
</style>
