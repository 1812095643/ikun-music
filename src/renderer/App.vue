<template>
  <div class="app-container h-full w-full" :class="{ mobile: isMobile, noElectron: !isElectron }">
    <n-config-provider :theme="theme === 'dark' ? darkTheme : lightTheme">
      <n-dialog-provider>
        <n-message-provider>
          <router-view></router-view>

          <!-- Splash Screen Overlay -->
          <transition name="splash-fade">
            <div v-if="showSplash && !isLyricWindow && !isTrayPanelWindow" class="splash-screen">
              <div class="splash-content">
                <div class="splash-logo-container">
                  <img src="@/assets/logo.png" class="splash-logo" alt="logo" />
                  <div class="splash-spinner-disc"></div>
                </div>
                <h1 class="splash-title">IKUN 音乐</h1>
                <p class="splash-subtitle">让生活充满音乐</p>
              </div>
            </div>
          </transition>
        </n-message-provider>
      </n-dialog-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { darkTheme, lightTheme } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { usePlayerStore } from '@/store/modules/player';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import type { Artist, SongResult } from '@/types/music';
import { isElectron, isLyricWindow } from '@/utils';
import { checkLoginStatus } from '@/utils/auth';
import {
  consumeMiniModeRestoreRoute,
  rememberMiniModeReturnRoute
} from '@/utils/miniModeNavigation';

import { allTime, initAudioListeners, initMusicHook, nowTime, openLyric } from './hooks/MusicHook';
import { audioService } from './services/audioService';
import { initLxMusicRunner } from './services/LxMusicSourceRunner';
import { isMobile } from './utils';
import { useAppShortcuts } from './utils/appShortcuts';

type TrayPanelStatePayload = {
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

const { locale } = useI18n();
const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const playerCoreStore = usePlayerCoreStore();
const userStore = useUserStore();
const router = useRouter();

const showSplash = ref(true);
const isTrayPanelWindow = computed(() => window.location.hash.includes('tray-panel'));
let removeTrayControlListener: (() => void) | null = null;
let removeTrayPanelOpenedListener: (() => void) | null = null;
let removeTrayPanelCommandListener: (() => void) | null = null;
let trayPanelStateTimer: number | null = null;

const getArtistText = (song: SongResult | Record<string, any> | null | undefined) => {
  const artistGroups = [
    song?.ar,
    song?.artists,
    song?.song?.artists,
    song?.song?.ar,
    song?.album?.artists
  ];
  const artists = artistGroups.find((item) => Array.isArray(item)) as Artist[] | undefined;

  if (artists?.length) {
    return artists
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(' / ');
  }

  return '';
};

const getTrayVolume = () => {
  const volume = playerStore.getVolume();
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
};

const normalizeFavoriteSongId = (id: number | string | undefined) => {
  if (typeof id === 'string' && id.includes('--')) return id;
  const numericId = Number(id);
  return Number.isFinite(numericId) ? numericId : id;
};

const getSoundTimeSnapshot = () => {
  const currentSound = audioService.getCurrentSound();
  const currentTime = currentSound ? Number(currentSound.seek() || 0) : nowTime.value || 0;
  const duration = currentSound ? Number(currentSound.duration() || 0) : allTime.value || 0;

  return {
    currentTime: Number.isFinite(currentTime) ? currentTime : 0,
    duration: Number.isFinite(duration) ? duration : 0
  };
};

/**
 * 同步系统托盘状态。
 * 根本原因：Tauri 原生托盘菜单由 Rust 创建，不会自动知道前端当前播放的歌曲、播放状态和音量。
 * 解决思路：把播放器 Pinia 状态作为唯一真源，主窗口每次播放/歌曲/音量变化时主动刷新托盘菜单文案。
 */
const syncTrayState = () => {
  if (
    !isElectron ||
    isLyricWindow.value ||
    isTrayPanelWindow.value ||
    !window.api?.updateTrayState
  ) {
    return;
  }

  const song = playerStore.playMusic as SongResult | undefined;
  const volume = getTrayVolume();

  window.api.updateTrayState({
    title: song?.name || '',
    artist: getArtistText(song),
    isPlaying: Boolean(playerStore.play),
    hasSong: Boolean(song?.id),
    volume,
    muted: volume <= 0
  });
};

const toggleTrayMute = () => {
  const currentVolume = getTrayVolume();

  if (currentVolume > 0) {
    localStorage.setItem('trayPreviousVolume', String(currentVolume));
    playerStore.setVolume(0);
    return;
  }

  const savedVolume = Number(localStorage.getItem('trayPreviousVolume') || '0.7');
  const nextVolume = Number.isFinite(savedVolume) ? Math.max(0.1, Math.min(1, savedVolume)) : 0.7;
  playerStore.setVolume(nextVolume);
};

const resumeCurrentSongFromTray = async () => {
  if (!playerStore.playMusic?.id) return false;

  const currentSound = audioService.getCurrentSound();
  const currentTrack = audioService.getCurrentTrack();
  const soundState =
    currentSound && typeof currentSound.state === 'function' ? currentSound.state() : '';
  const isSameSoundTrack =
    currentTrack?.id === playerStore.playMusic.id &&
    currentTrack?.source === playerStore.playMusic.source;

  // 根因：托盘面板与原生托盘以前复用了快捷键播放逻辑，暂停后再点播放会重新走解析链路，
  // 在线歌曲容易碰到上一次过期 URL 或加载中的 Howl 实例，表现为托盘按钮按了但主窗口不出声。
  // 解决：如果当前 Howler 实例仍可用，托盘恢复播放只调用 resume；只有实例丢失时才重建播放链路。
  if (currentSound && soundState === 'loaded' && isSameSoundTrack) {
    audioService.resume();
    await playerStore.setPlayMusic(true);
    playerStore.checkPlaybackState(playerStore.playMusic);
    return true;
  }

  const recovered = await playerStore.handlePlayMusic(
    {
      ...playerStore.playMusic,
      isFirstPlay: true,
      playMusicUrl: playerStore.playMusic.playMusicUrl?.startsWith('local://')
        ? playerStore.playMusic.playMusicUrl
        : undefined,
      expiredAt: playerStore.playMusic.playMusicUrl?.startsWith('local://')
        ? playerStore.playMusic.expiredAt
        : undefined
    },
    true
  );

  if (!recovered) {
    playerStore.setIsPlay(false);
  }

  return recovered;
};

const executeTrayPlaybackCommand = async (payload: any) => {
  const action = typeof payload === 'string' ? payload : payload?.action;
  if (!action) return false;

  switch (action) {
    case 'requestState':
      return true;
    case 'setVolume': {
      const nextVolume = Number(payload?.value);
      if (Number.isFinite(nextVolume)) {
        playerStore.setVolume(Math.max(0, Math.min(1, nextVolume)));
      }
      return true;
    }
    case 'seek': {
      const nextTime = Number(payload?.value);
      if (Number.isFinite(nextTime) && nextTime >= 0) {
        audioService.seek(nextTime);
        nowTime.value = nextTime;
      }
      return true;
    }
    case 'toggleMute':
      toggleTrayMute();
      return true;
    case 'togglePlay':
      if (playerStore.play) {
        await playerStore.handlePause();
      } else {
        await resumeCurrentSongFromTray();
      }
      return true;
    case 'togglePlayMode':
      playerStore.togglePlayMode();
      return true;
    case 'openLyric':
      openLyric();
      return true;
    case 'prevPlay':
      await playerStore.prevPlay();
      return true;
    case 'nextPlay':
      await playerStore.nextPlay();
      return true;
    case 'volumeUp':
      playerStore.increaseVolume(0.1);
      return true;
    case 'volumeDown':
      playerStore.decreaseVolume(0.1);
      return true;
    case 'toggleFavorite': {
      const favoriteId = normalizeFavoriteSongId(playerStore.playMusic?.id);
      if (favoriteId == null) return true;
      if (playerStore.favoriteList.includes(favoriteId)) {
        await playerStore.removeFromFavorite(favoriteId);
      } else {
        await playerStore.addToFavorite(favoriteId);
      }
      return true;
    }
    default:
      return false;
  }
};

const handleTrayControl = async (action: string) => {
  const handled = await executeTrayPlaybackCommand(action);
  if (handled) {
    syncTrayState();
    broadcastTrayPanelState();
  }
};

const broadcastTrayPanelState = () => {
  if (
    !isElectron ||
    isLyricWindow.value ||
    isTrayPanelWindow.value ||
    !window.electron?.ipcRenderer
  ) {
    return;
  }

  const song = playerStore.playMusic as SongResult | undefined;
  const timeSnapshot = getSoundTimeSnapshot();
  const state: TrayPanelStatePayload = {
    song: song?.id ? cloneDeep(song) : undefined,
    isPlaying: Boolean(playerStore.play),
    volume: getTrayVolume(),
    muted: getTrayVolume() <= 0,
    favoriteIds: [...(playerStore.favoriteList || [])],
    playMode: playerStore.playMode,
    playListCount: playerStore.playList?.length || 0,
    playListIndex: playerStore.playListIndex || 0,
    currentTime: timeSnapshot.currentTime,
    duration: timeSnapshot.duration,
    theme: theme.value,
    updatedAt: Date.now()
  };

  window.electron.ipcRenderer.send('tray-panel-state', state);
};

const handleTrayPanelCommand = async (payload: any) => {
  const action = typeof payload === 'string' ? payload : payload?.action;
  if (!action) return;

  await executeTrayPlaybackCommand(payload);
  broadcastTrayPanelState();
};

// 监听语言变化
watch(
  () => settingsStore.setData.language,
  (newLanguage) => {
    if (newLanguage && newLanguage !== locale.value) {
      locale.value = newLanguage;
    }
  },
  { immediate: true }
);

const theme = computed(() => {
  return settingsStore.theme;
});

// 监听字体变化并应用
watch(
  () => [settingsStore.setData.fontFamily, settingsStore.setData.fontScope],
  ([newFont, fontScope]) => {
    const appElement = document.body;
    if (newFont && fontScope === 'global') {
      appElement.style.fontFamily = newFont;
    } else {
      appElement.style.fontFamily = '';
    }
  }
);

const handleSetLanguage = (value: string) => {
  console.log('应用语言变更:', value);
  if (value) {
    locale.value = value;
  }
};

if (!isLyricWindow.value && !isTrayPanelWindow.value) {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
  settingsStore.initializeSystemFonts();

  // 初始化登录状态 - 从 localStorage 恢复用户信息和登录类型
  const loginInfo = checkLoginStatus();
  if (loginInfo.isLoggedIn) {
    if (loginInfo.user && !userStore.user) {
      userStore.setUser(loginInfo.user);
    }
    if (loginInfo.loginType && !userStore.loginType) {
      userStore.setLoginType(loginInfo.loginType);
    }
  }
}

handleSetLanguage(settingsStore.setData.language);

// 监听迷你模式状态
if (isElectron && !isTrayPanelWindow.value && window.api && window.electron?.ipcRenderer) {
  window.api.onLanguageChanged(handleSetLanguage);
  window.electron.ipcRenderer.on('mini-mode', (_, value) => {
    const nextMiniMode = Boolean(value);
    const currentMiniMode = settingsStore.isMiniMode;
    // Tauri 调整迷你窗尺寸、隐藏到托盘时会复用 mini-mode 事件；重复态不能再次覆盖返回路由。
    if (currentMiniMode === nextMiniMode) {
      return;
    }
    settingsStore.setMiniMode(nextMiniMode);
    if (nextMiniMode) {
      // 精简模式恢复时还要回到原页面的 query/hash，上下文不能只存 path。
      rememberMiniModeReturnRoute(router.currentRoute.value.fullPath);
      router.push('/mini');
    } else {
      const restoreRoute = consumeMiniModeRestoreRoute();
      if (restoreRoute) {
        router.push(restoreRoute);
      } else {
        router.push('/');
      }
    }
  });
}

if (isElectron && !isLyricWindow.value && !isTrayPanelWindow.value && window.api?.onTrayControl) {
  removeTrayControlListener = window.api.onTrayControl((action) => {
    void handleTrayControl(action);
  });
}

if (
  isElectron &&
  !isLyricWindow.value &&
  !isTrayPanelWindow.value &&
  window.electron?.ipcRenderer
) {
  removeTrayPanelOpenedListener = window.electron.ipcRenderer.on('tray-panel-opened', () => {
    broadcastTrayPanelState();
  });
  removeTrayPanelCommandListener = window.electron.ipcRenderer.on(
    'tray-panel-command',
    (_, payload) => {
      void handleTrayPanelCommand(payload);
    }
  );
}

watch(
  () => [
    playerStore.play,
    playerStore.playMusic?.id,
    playerStore.playMusic?.name,
    playerStore.playMusic?.picUrl,
    playerStore.playMusic?.ar,
    playerStore.playMusic?.artists,
    playerStore.playMusic?.song?.artists,
    playerStore.volume,
    playerStore.playMode,
    playerStore.playListIndex,
    playerStore.playList?.length,
    playerStore.favoriteList,
    theme.value
  ],
  () => {
    syncTrayState();
    broadcastTrayPanelState();
  },
  { immediate: true, deep: true }
);

// 使用应用内快捷键
if (!isTrayPanelWindow.value) {
  useAppShortcuts();
}

onMounted(async () => {
  setTimeout(() => {
    showSplash.value = false;
  }, 1500);

  if (isTrayPanelWindow.value) {
    showSplash.value = false;
    return;
  }

  playerStore.setIsPlay(false);
  if (isLyricWindow.value) {
    return;
  }

  trayPanelStateTimer = window.setInterval(broadcastTrayPanelState, 500);

  // 检查网络状态，离线时自动跳转到本地音乐页面
  if (!navigator.onLine) {
    console.log('检测到无网络连接，跳转到本地音乐页面');
    router.push('/local-music');
  }

  // 监听网络状态变化，断网时跳转到本地音乐页面
  window.addEventListener('offline', () => {
    console.log('网络连接断开，跳转到本地音乐页面');
    router.push('/local-music');
  });

  // 初始化 MusicHook，注入 playerStore
  initMusicHook(playerStore);
  // 初始化播放状态
  await playerStore.initializePlayState();

  // 初始化音频设备变化监听器
  playerCoreStore.initAudioDeviceListener();

  // 初始化落雪音源（如果有激活的音源）
  const activeLxApiId = settingsStore.setData?.activeLxMusicApiId;
  if (activeLxApiId) {
    const lxMusicScripts = settingsStore.setData?.lxMusicScripts || [];
    const activeScript = lxMusicScripts.find((script: any) => script.id === activeLxApiId);
    if (activeScript && activeScript.script) {
      try {
        console.log('[App] 初始化激活的落雪音源:', activeScript.name);
        await initLxMusicRunner(activeScript.script);
      } catch (error) {
        console.error('[App] 初始化落雪音源失败:', error);
      }
    }
  }

  // 如果有正在播放的音乐，则初始化音频监听器
  if (playerStore.playMusic && playerStore.playMusic.id) {
    // 使用 nextTick 确保 DOM 更新后再初始化
    await nextTick();
    initAudioListeners();
    if (isElectron && window.api) {
      window.api.sendSong(cloneDeep(playerStore.playMusic));
    }
  }

  audioService.releaseOperationLock();
});

onUnmounted(() => {
  removeTrayControlListener?.();
  removeTrayControlListener = null;
  removeTrayPanelOpenedListener?.();
  removeTrayPanelOpenedListener = null;
  removeTrayPanelCommandListener?.();
  removeTrayPanelCommandListener = null;
  if (trayPanelStateTimer) {
    window.clearInterval(trayPanelStateTimer);
    trayPanelStateTimer = null;
  }
});
</script>

<style lang="scss" scoped>
.app-container {
  user-select: none;
}

.mobile {
  .text-base {
    font-size: 14px !important;
  }
}

.html:has(.mobile) {
  font-size: 14px;
}

/* Splash Screen CSS */
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--qqm-bg, #f7f8fa);
  color: var(--qqm-text, #151922);
}

.dark .splash-screen {
  background: var(--qqm-bg, #111315);
  color: var(--qqm-text, #f4f7f8);
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.splash-logo-container {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-logo {
  position: absolute;
  width: 80px;
  height: 80px;
  object-fit: contain;
  z-index: 2;
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.splash-spinner-disc {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 9999px;
  border: 2.5px solid transparent;
  border-top-color: var(--qqm-primary, #1ecf73);
  border-bottom-color: var(--qqm-primary, #1ecf73);
  animation: spin-clockwise 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  z-index: 1;
}

.splash-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 5px;
  margin-bottom: 8px;
  background: linear-gradient(
    135deg,
    var(--qqm-primary, #1ecf73) 0%,
    var(--qqm-primary-strong, #0dbd62) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.splash-subtitle {
  font-size: 13px;
  color: var(--qqm-muted, #6f7580);
  font-weight: 600;
  letter-spacing: 3px;
  opacity: 0.8;
}

@keyframes spin-clockwise {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* transition fade out */
.splash-fade-enter-active,
.splash-fade-leave-active {
  transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}

.splash-fade-enter-from,
.splash-fade-leave-to {
  opacity: 0;
  transform: scale(1.04);
  filter: blur(8px);
}
</style>
