<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue';

import DesktopLyricLine from '@/components/lyric/DesktopLyricLine.vue';
import DesktopLyricToolbar from '@/components/lyric/DesktopLyricToolbar.vue';
import type { ILyricText, SongResult } from '@/types/music';
import { getDesktopLyricPointer } from '@/utils/desktopBridge';
import {
  getDefaultHighlightColor,
  optimizeColorForTheme,
  validateColor
} from '@/utils/linearColor';
import { shouldStartLyricWindowDrag } from '@/utils/lyricWindowDrag';

defineOptions({ name: 'Lyric' });

type DisplayMode = 'single' | 'double' | 'scroll';
interface DesktopLyricSettings {
  theme: 'light' | 'dark';
  isLock: boolean;
  highlightColor?: string;
  showTranslation: boolean;
  displayMode: DisplayMode;
}
interface LyricPayload {
  type?: string;
  nowTime?: number;
  correctionTime?: number;
  isPlay?: boolean;
  nowIndex?: number;
  lrcArray?: ILyricText[];
  lrcTimeArray?: number[];
  allTime?: number;
  playMusic?: SongResult;
}

const windowData = window as any;
const windowRef = useTemplateRef<HTMLElement>('lyricWindow');
const containerRef = useTemplateRef<HTMLElement>('container');

/** 兼容已有配色和显示模式；缺失字段采用双行，避免旧设置意外退回密集滚动模式。 */
const loadSettings = (): DesktopLyricSettings => {
  const defaults: DesktopLyricSettings = {
    theme: 'dark',
    isLock: false,
    showTranslation: true,
    displayMode: 'double'
  };
  try {
    const stored = JSON.parse(localStorage.getItem('lyricData') || '{}');
    return {
      theme: stored.theme === 'light' ? 'light' : 'dark',
      isLock: stored.isLock === true,
      highlightColor: validateColor(stored.highlightColor) ? stored.highlightColor : undefined,
      showTranslation: stored.showTranslation !== false,
      displayMode: ['single', 'double', 'scroll'].includes(stored.displayMode)
        ? stored.displayMode
        : 'double'
    };
  } catch (error) {
    console.warn('桌面歌词设置未能读取，已使用默认外观：', error);
    return defaults;
  }
};

const lyricSetting = ref(loadSettings());
const fontSize = shallowRef(32);
const settingsOpen = shallowRef(false);
const isHovering = shallowRef(false);
const keyboardFocus = shallowRef(false);
const containerHeight = shallowRef(128);
const staticData = shallowRef({
  lrcArray: [] as ILyricText[],
  lrcTimeArray: [] as number[],
  allTime: 0,
  playMusic: {} as SongResult
});
const dynamicData = shallowRef({ nowTime: 0, correctionTime: 0, isPlay: false });
const actualTime = shallowRef(0);
const currentIndex = shallowRef(0);
const scrollOffset = shallowRef(0);

const hasTranslation = computed(() => staticData.value.lrcArray.some((line) => line.trText));
const displayMode = computed(() => lyricSetting.value.displayMode);
const currentHighlightColor = computed(() => {
  const { theme, highlightColor } = lyricSetting.value;
  return optimizeColorForTheme(highlightColor || getDefaultHighlightColor(theme), theme);
});
const windowStyle = computed(() => ({ '--lyric-accent': currentHighlightColor.value }));
// 根因：旧版未锁定时恒定返回 true，工具栏始终占满窗口。现在只在悬停、键盘操作或设置展开时显示。
const showControls = computed(() => isHovering.value || keyboardFocus.value || settingsOpen.value);
const currentProgress = computed(() => {
  const times = staticData.value.lrcTimeArray;
  const start = times[currentIndex.value];
  const end = times[currentIndex.value + 1] ?? staticData.value.allTime;
  return start !== undefined && end > start
    ? Math.min(1, Math.max(0, (actualTime.value - start) / (end - start)))
    : 0;
});

// 双行始终显示当前句和下一句，不再每两句整组淡出，切换时也不会先显示上一组或短暂空白。
const visibleLines = computed(() => {
  const start =
    displayMode.value === 'scroll' ? Math.max(0, currentIndex.value - 4) : currentIndex.value;
  const end =
    displayMode.value === 'scroll'
      ? currentIndex.value + 5
      : start + (displayMode.value === 'single' ? 1 : 2);
  return staticData.value.lrcArray
    .slice(start, end)
    .map((line, offset) => ({ line, index: start + offset }));
});
const renderedFontSize = computed(() => {
  if (displayMode.value === 'scroll') return fontSize.value;
  const withTranslation =
    lyricSetting.value.showTranslation && visibleLines.value.some(({ line }) => line.trText);
  const rows = visibleLines.value.length > 1 ? 1.78 : 1;
  // 原生窗口可被缩小；预留两行与翻译的真实行高，最大字号也不会从窗口下方被截掉。
  const available = (containerHeight.value - 22) / (rows * (1.42 + (withTranslation ? 0.82 : 0)));
  return Math.min(fontSize.value, Math.max(12, Math.floor(available)));
});
const emptyText = computed(() =>
  staticData.value.playMusic.name ? '这首歌暂无歌词' : '播放一首歌，歌词就会出现在这里'
);

/** 按真实行高居中滚动，字号、翻译和视口变化后再测量，不在播放帧里反复强制布局。 */
const measureLayout = () => {
  if (!containerRef.value) return;
  containerHeight.value = containerRef.value.clientHeight;
  if (displayMode.value !== 'scroll') return;
  const current = containerRef.value.querySelector<HTMLElement>('.lyric-line-current');
  if (current)
    scrollOffset.value = containerHeight.value / 2 - current.offsetTop - current.offsetHeight / 2;
};
watch(
  [
    currentIndex,
    fontSize,
    displayMode,
    () => lyricSetting.value.showTranslation,
    () => staticData.value.lrcArray
  ],
  () => nextTick(measureLayout),
  { flush: 'post' }
);

let animationFrameId: number | null = null;
let lastUpdateTime = performance.now();
let lastPaintTime = 0;
const updateCurrentIndex = () => {
  const times = staticData.value.lrcTimeArray;
  if (!times.length) return;
  let index = times.length - 1;
  while (index > 0 && times[index] > actualTime.value) index -= 1;
  currentIndex.value = Math.min(index, Math.max(0, staticData.value.lrcArray.length - 1));
};
const stopProgressAnimation = () => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
};
const updateProgress = (frameTime: number) => {
  animationFrameId = null;
  if (!dynamicData.value.isPlay || document.hidden) return;
  // 延续已修复的单循环：30fps 只推进当前句，暂停、窗口隐藏和卸载立即停止。
  if (frameTime - lastPaintTime >= 32) {
    lastPaintTime = frameTime;
    actualTime.value =
      dynamicData.value.nowTime +
      dynamicData.value.correctionTime +
      (performance.now() - lastUpdateTime) / 1000;
    updateCurrentIndex();
  }
  animationFrameId = requestAnimationFrame(updateProgress);
};
const syncProgressAnimation = () => {
  stopProgressAnimation();
  lastUpdateTime = performance.now();
  actualTime.value = dynamicData.value.nowTime + dynamicData.value.correctionTime;
  updateCurrentIndex();
  if (dynamicData.value.isPlay && !document.hidden)
    animationFrameId = requestAnimationFrame(updateProgress);
};

/** 复用主播放器的完整/增量 IPC 契约；暂停、切歌和空歌词均立即刷新，不等待下一播放帧。 */
const handleDataUpdate = (data: LyricPayload) => {
  if (!data || typeof data !== 'object') return;
  if (data.type !== 'update') {
    staticData.value = {
      lrcArray: Array.isArray(data.lrcArray) ? data.lrcArray : [],
      lrcTimeArray: Array.isArray(data.lrcTimeArray) ? data.lrcTimeArray : [],
      allTime: data.allTime || 0,
      playMusic: data.playMusic || ({} as SongResult)
    };
    currentIndex.value = 0;
  }
  dynamicData.value = {
    nowTime: Number.isFinite(data.nowTime) ? data.nowTime! : dynamicData.value.nowTime,
    correctionTime: Number.isFinite(data.correctionTime)
      ? data.correctionTime!
      : dynamicData.value.correctionTime,
    isPlay: typeof data.isPlay === 'boolean' ? data.isPlay : dynamicData.value.isPlay
  };
  if (Number.isFinite(data.nowIndex))
    currentIndex.value = Math.max(
      0,
      Math.min(data.nowIndex!, staticData.value.lrcArray.length - 1)
    );
  syncProgressAnimation();
};

let lastIgnoreMouse: boolean | undefined;
const syncIgnoreMouseState = (ignore: boolean) => {
  if (lastIgnoreMouse === ignore) return;
  lastIgnoreMouse = ignore;
  windowData.desktop.send('set-ignore-mouse', ignore);
};
let lockPointerTimer: ReturnType<typeof setInterval> | undefined;
let pointerCheckPending = false;
/** 锁定期间低频检查鼠标，只在解锁按钮上收回穿透，歌词文字区域仍可点击下面的应用。 */
const checkLockedPointer = async () => {
  if (pointerCheckPending || !lyricSetting.value.isLock) return;
  pointerCheckPending = true;
  try {
    const pointer = await getDesktopLyricPointer();
    if (!pointer || !lyricSetting.value.isLock || !windowRef.value) return;
    isHovering.value =
      pointer.x >= 0 &&
      pointer.x <= window.innerWidth &&
      pointer.y >= 0 &&
      pointer.y <= window.innerHeight;
    const unlock = windowRef.value.querySelector('#lyric-lock')?.getBoundingClientRect();
    const overUnlock =
      unlock &&
      pointer.x >= unlock.left &&
      pointer.x <= unlock.right &&
      pointer.y >= unlock.top &&
      pointer.y <= unlock.bottom;
    syncIgnoreMouseState(!overUnlock);
  } catch (error) {
    // 无法读取原生鼠标位置时恢复可交互状态，避免把用户困在无法解锁的窗口里。
    stopLockPointerTracking();
    lyricSetting.value.isLock = false;
    syncIgnoreMouseState(false);
    console.warn('歌词锁定已解除，请重试：', error);
  } finally {
    pointerCheckPending = false;
  }
};
const stopLockPointerTracking = () => {
  if (lockPointerTimer) clearInterval(lockPointerTimer);
  lockPointerTimer = undefined;
};
const startLockPointerTracking = () => {
  stopLockPointerTracking();
  if (!windowData.__TAURI_INTERNALS__) return;
  lockPointerTimer = setInterval(() => {
    void checkLockedPointer();
  }, 160);
};
let hideControlsTimer: ReturnType<typeof setTimeout> | undefined;
const clearHideTimer = () => {
  if (hideControlsTimer) clearTimeout(hideControlsTimer);
  hideControlsTimer = undefined;
};
const handleMouseEnter = () => {
  clearHideTimer();
  isHovering.value = true;
  if (!lyricSetting.value.isLock) syncIgnoreMouseState(false);
};
const handleMouseLeave = () => {
  clearHideTimer();
  hideControlsTimer = setTimeout(() => {
    isHovering.value = false;
  }, 180);
  if (lyricSetting.value.isLock) syncIgnoreMouseState(true);
};
const handleFocusIn = (event: FocusEvent) => {
  keyboardFocus.value =
    event.target instanceof HTMLElement && event.target.matches(':focus-visible');
};
const handleFocusOut = (event: FocusEvent) => {
  if (!windowRef.value?.contains(event.relatedTarget as Node | null)) keyboardFocus.value = false;
};
const handleEscape = () => {
  settingsOpen.value = false;
  keyboardFocus.value = false;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
};
const changeFontSize = (delta: number) => {
  fontSize.value = Math.max(12, Math.min(48, fontSize.value + delta));
  try {
    localStorage.setItem('lyricFontSize', String(fontSize.value));
  } catch (error) {
    console.warn('字号暂未保存，本次调整仍然生效：', error);
  }
};
const changeColor = (color: string) => {
  if (validateColor(color)) lyricSetting.value.highlightColor = color;
};
const handleLock = () => {
  lyricSetting.value.isLock = !lyricSetting.value.isLock;
};
watch(
  () => lyricSetting.value.isLock,
  (locked) => {
    settingsOpen.value = false;
    keyboardFocus.value = false;
    isHovering.value = false;
    syncIgnoreMouseState(locked);
    if (locked) startLockPointerTracking();
    else stopLockPointerTracking();
  }
);
watch(
  lyricSetting,
  (settings) => {
    try {
      // 保留既有设置中的其他字段，避免这次外观整理覆盖播放器保存的选项。
      const previous = JSON.parse(localStorage.getItem('lyricData') || '{}');
      localStorage.setItem('lyricData', JSON.stringify({ ...previous, ...settings }));
    } catch (error) {
      console.warn('歌词设置暂未保存，本次调整仍然生效：', error);
    }
  },
  { deep: true }
);

let dragPosition: { x: number; y: number } | null = null;
let lastMoveTime = 0;
const handleMouseMove = (event: MouseEvent) => {
  if (!dragPosition || performance.now() - lastMoveTime < 10) return;
  const deltaX = event.screenX - dragPosition.x;
  const deltaY = event.screenY - dragPosition.y;
  if (deltaX || deltaY) windowData.desktop.send('lyric-drag-move', { deltaX, deltaY });
  dragPosition = { x: event.screenX, y: event.screenY };
  lastMoveTime = performance.now();
};
const endDrag = () => {
  if (dragPosition) windowData.desktop.send('lyric-drag-end');
  dragPosition = null;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', endDrag);
};
const handleMouseDown = (event: MouseEvent) => {
  if (event.button !== 0 || !shouldStartLyricWindowDrag(event.target, lyricSetting.value.isLock))
    return;
  endDrag();
  dragPosition = { x: event.screenX, y: event.screenY };
  lastMoveTime = performance.now();
  windowData.desktop.send('lyric-drag-start');
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', endDrag);
};

let removeLyricDataListener: (() => void) | undefined;
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  try {
    const saved = Number(localStorage.getItem('lyricFontSize'));
    if (saved > 0 && Number.isFinite(saved)) fontSize.value = Math.max(12, Math.min(48, saved));
  } catch (error) {
    console.warn('已使用默认歌词字号：', error);
  }
  resizeObserver = new ResizeObserver(measureLayout);
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  document.addEventListener('visibilitychange', syncProgressAnimation);
  window.addEventListener('blur', endDrag);
  removeLyricDataListener = windowData.desktop.on('receive-lyric', (_: unknown, data: string) => {
    try {
      handleDataUpdate(JSON.parse(data));
    } catch (error) {
      console.error('歌词数据未能解析，请切歌后重试：', error);
    }
  });
  // 桌面桥接层等待原生监听注册完成后才发 ready，保留首次打开/暂停时的完整同步握手。
  windowData.desktop.send('lyric-ready');
  syncIgnoreMouseState(lyricSetting.value.isLock);
  if (lyricSetting.value.isLock) startLockPointerTracking();
});
onUnmounted(() => {
  stopProgressAnimation();
  stopLockPointerTracking();
  clearHideTimer();
  endDrag();
  resizeObserver?.disconnect();
  removeLyricDataListener?.();
  document.removeEventListener('visibilitychange', syncProgressAnimation);
  window.removeEventListener('blur', endDrag);
});
</script>

<template>
  <div
    ref="lyricWindow"
    class="lyric-window"
    :class="[lyricSetting.theme, { 'lyric-locked': lyricSetting.isLock }]"
    :style="windowStyle"
    tabindex="0"
    aria-label="桌面歌词，移入鼠标或按 Tab 显示操作"
    @mousedown="handleMouseDown"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
    @keydown.esc="handleEscape"
  >
    <desktop-lyric-toolbar
      :visible="showControls"
      :song-name="staticData.playMusic.name || ''"
      :has-song="!!staticData.playMusic.id"
      :is-playing="dynamicData.isPlay"
      :locked="lyricSetting.isLock"
      :settings-open="settingsOpen"
      :font-size="fontSize"
      :theme="lyricSetting.theme"
      :display-mode="displayMode"
      :color="currentHighlightColor"
      :show-translation="lyricSetting.showTranslation"
      :has-translation="hasTranslation"
      @control="windowData.desktop.send('control-back', $event)"
      @lock="handleLock"
      @close="windowData.desktop.send('close-lyric')"
      @settings="settingsOpen = !settingsOpen"
      @font-size="changeFontSize"
      @theme="lyricSetting.theme = $event"
      @display-mode="lyricSetting.displayMode = $event"
      @color="changeColor"
      @translation="lyricSetting.showTranslation = !lyricSetting.showTranslation"
    />
    <div ref="container" class="lyric-container" :class="`mode-${displayMode}`">
      <div
        v-if="visibleLines.length"
        class="lyric-lines"
        :style="
          displayMode === 'scroll' ? { transform: `translateY(${scrollOffset}px)` } : undefined
        "
      >
        <desktop-lyric-line
          v-for="{ line, index } in visibleLines"
          :key="index"
          v-memo="[
            line,
            index === currentIndex,
            index === currentIndex ? actualTime : 0,
            renderedFontSize,
            lyricSetting.showTranslation,
            displayMode
          ]"
          :line="line"
          :active="index === currentIndex"
          :actual-time="index === currentIndex ? actualTime : 0"
          :progress="index === currentIndex ? currentProgress : 0"
          :font-size="
            index === currentIndex ? renderedFontSize : Math.round(renderedFontSize * 0.78)
          "
          :show-translation="lyricSetting.showTranslation"
        />
      </div>
      <div v-else class="lyric-empty">
        <i class="ri-music-2-line" aria-hidden="true" /><span>{{ emptyText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 透明规则限定到正在挂载的歌词路由。原先 scoped 的 html/body 根本匹配不到文档根节点。 */
:global(html:has(.lyric-window)),
:global(body:has(.lyric-window)),
:global(#app:has(.lyric-window)) {
  background: transparent !important;
}
.lyric-window {
  --lyric-text: #f7faf8;
  --lyric-secondary: #e3ede7;
  --lyric-shadow: rgb(8 22 14 / 65%);
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: transparent;
  user-select: none;
  outline: none;
  font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  cursor: grab;
}
.lyric-window.light {
  --lyric-text: #24362c;
  --lyric-secondary: #475d50;
  --lyric-shadow: rgb(255 255 255 / 80%);
}
.lyric-window:active {
  cursor: grabbing;
}
.lyric-window.lyric-locked {
  cursor: default;
}
.lyric-container {
  position: absolute;
  inset: 62px 30px 16px;
  overflow: hidden;
}
.lyric-lines {
  display: flex;
  position: relative;
  min-height: 100%;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}
.mode-scroll {
  mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
}
.mode-scroll .lyric-lines {
  min-height: 0;
  justify-content: flex-start;
  gap: 14px;
  transition: transform 220ms ease-out;
}
.lyric-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--lyric-text);
  font-size: 19px;
  font-weight: 500;
  filter: drop-shadow(0 1px 1.2px var(--lyric-shadow));
}
.lyric-empty i {
  font-size: 22px;
  color: var(--lyric-accent);
}
@media (max-width: 620px) {
  .lyric-container {
    inset-inline: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mode-scroll .lyric-lines {
    transition: none;
  }
}
</style>
