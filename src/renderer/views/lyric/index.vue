<template>
  <div
    class="lyric-window"
    :class="[lyricSetting.theme, { lyric_lock: lyricSetting.isLock }]"
    @mousedown="handleMouseDown"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="drag-overlay"></div>
    <!-- 顶部控制栏 -->
    <div class="control-bar" :class="{ 'control-bar-show': showControls }">
      <div class="font-size-controls">
        <n-button-group>
          <button
            type="button"
            class="control-button"
            title="缩小字号"
            aria-label="缩小字号"
            @click="decreaseFontSize"
          >
            <i class="ri-subtract-line"></i>
          </button>
          <button
            type="button"
            class="control-button"
            title="放大字号"
            aria-label="放大字号"
            @click="increaseFontSize"
          >
            <i class="ri-add-line"></i>
          </button>
        </n-button-group>
        <div class="desktop-song-title" :title="staticData.playMusic.name">
          {{ staticData.playMusic.name || '桌面歌词' }}
        </div>
      </div>
      <!-- 添加播放控制按钮 -->
      <div class="play-controls">
        <button
          type="button"
          class="control-button"
          title="上一首"
          aria-label="上一首"
          @click="handlePrev"
        >
          <i class="ri-skip-back-fill"></i>
        </button>
        <button
          class="control-button play-button"
          title="播放或暂停"
          aria-label="播放或暂停"
          @click="handlePlayPause"
        >
          <i :class="dynamicData.isPlay ? 'ri-pause-fill' : 'ri-play-fill'"></i>
        </button>
        <button
          type="button"
          class="control-button"
          title="下一首"
          aria-label="下一首"
          @click="handleNext"
        >
          <i class="ri-skip-forward-fill"></i>
        </button>
      </div>
      <div class="control-buttons">
        <button
          type="button"
          class="control-button"
          title="切换明暗"
          aria-label="切换明暗"
          @click="checkTheme"
        >
          <i v-if="lyricSetting.theme === 'light'" class="ri-sun-line"></i>
          <i v-else class="ri-moon-line"></i>
        </button>
        <button
          class="control-button theme-color-button"
          :class="{ active: showThemeColorPanel }"
          @click="toggleThemeColorPanel"
        >
          <i class="ri-palette-line"></i>
        </button>
        <!-- <button type="button" class="control-button" @click="handleTop">
          <i class="ri-pushpin-line" :class="{ active: lyricSetting.isTop }"></i>
        </button> -->
        <!-- 翻译开关按钮（仅当歌词有翻译时显示） -->
        <button
          v-if="hasTranslation"
          class="control-button"
          :title="showTranslation ? '隐藏翻译' : '显示翻译'"
          @click="lyricSetting.showTranslation = !lyricSetting.showTranslation"
        >
          <i class="ri-translate-2" :class="{ active: showTranslation }"></i>
        </button>

        <!-- 显示模式切换按钮（scroll → single → double → scroll 循环） -->
        <button
          class="control-button"
          :title="
            displayMode === 'scroll'
              ? '滚动模式'
              : displayMode === 'single'
                ? '单行模式'
                : '双行模式'
          "
          @click="cycleDisplayMode"
        >
          <i
            :class="{
              'ri-align-justify': displayMode === 'scroll',
              'ri-subtract-line': displayMode === 'single',
              'ri-layout-row-line': displayMode === 'double'
            }"
          ></i>
        </button>

        <button
          id="lyric-lock"
          type="button"
          class="control-button"
          title="锁定或解锁歌词"
          aria-label="锁定或解锁歌词"
          @click="handleLock"
        >
          <i v-if="lyricSetting.isLock" class="ri-lock-line"></i>
          <i v-else class="ri-lock-unlock-line"></i>
        </button>
        <button
          type="button"
          class="control-button"
          title="关闭桌面歌词"
          aria-label="关闭桌面歌词"
          @click="handleClose"
        >
          <i class="ri-close-line"></i>
        </button>
      </div>
    </div>

    <!-- 主题色选择面板 -->
    <theme-color-panel
      :visible="showThemeColorPanel"
      :current-color="currentHighlightColor"
      :theme="lyricSetting.theme"
      @color-change="handleColorChange"
      @close="handleThemeColorPanelClose"
    />

    <!-- 歌词显示区域 -->
    <div ref="containerRef" class="lyric-container">
      <!-- ① 滚动模式（默认） -->
      <div v-if="displayMode === 'scroll'" class="lyric-scroll">
        <div class="lyric-wrapper" :style="wrapperStyle">
          <template v-if="staticData.lrcArray?.length > 0">
            <div
              v-for="{ line, index } in scrollLines"
              v-memo="[
                line,
                index === currentIndex,
                index === currentIndex ? actualTime : -1,
                fontSize,
                showTranslation,
                currentHighlightColor
              ]"
              :key="index"
              class="lyric-line"
              :style="getDynamicLineStyle(line, showTranslation)"
              :class="{
                'lyric-line-current': index === currentIndex,
                'lyric-line-passed': index < currentIndex,
                'lyric-line-next': index === currentIndex + 1
              }"
            >
              <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
                <div
                  v-if="line.hasWordByWord && line.words && line.words.length > 0"
                  class="word-by-word-lyric"
                >
                  <template v-for="(word, wordIndex) in line.words" :key="wordIndex">
                    <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">
                      {{ word.text }} </span
                    ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                  </template>
                </div>
                <span v-else class="lyric-text-inner" :style="getLyricStyle(index)">
                  {{ line.text || '' }}
                </span>
              </div>
              <!-- ★ 翻译行：加入 showTranslation 控制 -->
              <div
                v-if="showTranslation && line.trText"
                class="lyric-translation"
                :style="{ fontSize: `${fontSize * 0.6}px` }"
              >
                {{ line.trText }}
              </div>
            </div>
          </template>
          <div v-else class="lyric-empty">无歌词</div>
        </div>
      </div>

      <!-- ② 单行模式 -->
      <div v-else-if="displayMode === 'single'" class="lyric-single-mode">
        <template v-if="staticData.lrcArray?.length > 0">
          <div class="lyric-line lyric-line-current">
            <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
              <div
                v-if="
                  staticData.lrcArray[currentIndex] != null &&
                  staticData.lrcArray[currentIndex].hasWordByWord &&
                  (staticData.lrcArray[currentIndex].words?.length ?? 0) > 0
                "
                class="word-by-word-lyric"
              >
                <template
                  v-for="(word, wordIndex) in staticData.lrcArray[currentIndex]!.words"
                  :key="wordIndex"
                >
                  <span class="lyric-word" :style="getWordStyle(currentIndex, wordIndex, word)">
                    {{ word.text }} </span
                  ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                </template>
              </div>
              <span v-else class="lyric-text-inner" :style="getLyricStyle(currentIndex)">
                {{ staticData.lrcArray[currentIndex]?.text || '' }}
              </span>
            </div>
            <div
              v-if="showTranslation && staticData.lrcArray[currentIndex]?.trText"
              class="lyric-translation"
              :style="{ fontSize: `${fontSize * 0.6}px` }"
            >
              {{ staticData.lrcArray[currentIndex]?.trText }}
            </div>
          </div>
        </template>
        <div v-else class="lyric-empty">无歌词</div>
      </div>

      <!-- ③ 双行模式（固定分组，每 2 行为一组） -->
      <div v-else class="lyric-double-mode" :class="{ 'group-fade': isGroupTransitioning }">
        <template v-if="staticData.lrcArray?.length > 0">
          <!-- currentGroupLines 最多 2 条，最后一组只有 1 行时自动只显示 1 行 -->
          <div
            v-for="line in currentGroupLines"
            :key="line.index"
            class="lyric-line"
            :class="{ 'lyric-line-current': line.index === currentIndex }"
          >
            <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
              <div
                v-if="line.hasWordByWord && line.words && line.words.length > 0"
                class="word-by-word-lyric"
              >
                <template v-for="(word, wordIndex) in line.words" :key="wordIndex">
                  <span class="lyric-word" :style="getWordStyle(line.index, wordIndex, word)">
                    {{ word.text }} </span
                  ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                </template>
              </div>
              <span v-else class="lyric-text-inner" :style="getLyricStyle(line.index)">
                {{ line.text || '' }}
              </span>
            </div>
            <div
              v-if="showTranslation && line.trText"
              class="lyric-translation"
              :style="{ fontSize: `${fontSize * 0.6}px` }"
            >
              {{ line.trText }}
            </div>
          </div>
        </template>
        <div v-else class="lyric-empty">无歌词</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import ThemeColorPanel from '@/components/lyric/ThemeColorPanel.vue';
import { SongResult } from '@/types/music';
import {
  getCurrentLyricThemeColor,
  optimizeColorForTheme,
  resetLyricThemeColor,
  saveLyricThemeColor,
  validateColor
} from '@/utils/linearColor';
import { shouldStartLyricWindowDrag } from '@/utils/lyricWindowDrag';

defineOptions({
  name: 'Lyric'
});
const windowData = window as any;
const containerRef = ref<HTMLElement | null>(null);
const containerHeight = ref(0);
const lineHeight = ref(60);
const currentIndex = ref(0);
// 字体大小控制
const fontSize = ref(24); // 默认字体大小
const fontSizeStep = 2; // 每次整的步长
const animationFrameId = ref<number | null>(null);
const lastUpdateTime = ref(performance.now());

// 静态数据
const staticData = ref<{
  lrcArray: Array<{
    text: string;
    trText: string;
    words?: Array<{ text: string; startTime: number; duration: number; space?: boolean }>;
    hasWordByWord?: boolean;
    startTime?: number;
    duration?: number;
  }>;
  lrcTimeArray: number[];
  allTime: number;
  playMusic: SongResult;
}>({
  lrcArray: [],
  lrcTimeArray: [],
  allTime: 0,
  playMusic: {} as SongResult
});

// 动态数据
const dynamicData = ref({
  nowTime: 0,
  correctionTime: 0,
  startCurrentTime: 0,
  nextTime: 0,
  isPlay: false
});

// 安全加载歌词设置
const loadLyricSettings = () => {
  try {
    const stored = localStorage.getItem('lyricData');
    if (stored) {
      const parsed = JSON.parse(stored);

      // 验证 highlightColor 字段
      let validatedHighlightColor = parsed.highlightColor;
      if (validatedHighlightColor && !validateColor(validatedHighlightColor)) {
        console.warn('Invalid stored highlight color, removing it');
        validatedHighlightColor = undefined;
      }

      // 确保所有必需字段存在并有效
      return {
        isTop: parsed.isTop ?? false,
        theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'dark',
        isLock: parsed.isLock ?? false,
        highlightColor: validatedHighlightColor,
        showTranslation: parsed.showTranslation ?? true,
        displayMode: (['scroll', 'single', 'double'].includes(parsed.displayMode)
          ? parsed.displayMode
          : 'scroll') as 'scroll' | 'single' | 'double'
      };
    }
  } catch (error) {
    console.error('Failed to load lyric settings:', error);
  }

  // 返回默认设置
  return {
    isTop: false,
    theme: 'dark' as 'light' | 'dark',
    isLock: false,
    highlightColor: undefined as string | undefined,
    showTranslation: true,
    displayMode: 'double' as 'scroll' | 'single' | 'double'
  };
};

const lyricSetting = ref(loadLyricSettings());

// 是否有翻译（控制翻译按钮是否显示）
const hasTranslation = computed(() => staticData.value.lrcArray.some((line) => line.trText));

// 双行模式：当前组索引（每 2 行为一组）
const currentGroupIndex = computed(() => Math.floor(currentIndex.value / 2));

// 双行模式：当前组的行数据（带原始索引）
// 注：slice 在越界时自动截断，最后一组只有 1 行时安全返回长度为 1 的数组
const currentGroupLines = computed(() => {
  const start = currentGroupIndex.value * 2;
  return staticData.value.lrcArray
    .slice(start, start + 2)
    .map((line, i) => ({ ...line, index: start + i }));
});

// 双行模式过渡动画状态
const isGroupTransitioning = ref(false);

// displayMode 和 showTranslation 的快捷 computed，template 中更简洁
const displayMode = computed(() => lyricSetting.value.displayMode);
const showTranslation = computed(() => lyricSetting.value.showTranslation);

let hideControlsTimer: number | null = null;

const isHovering = ref(false);

// 主题色相关状态
const showThemeColorPanel = ref(false);
const currentHighlightColor = ref('#1db954');

// 歌词窗主题色既要保留用户自定义颜色，又要在亮暗主题之间做可读性优化。
// 这里统一走一个解析入口，避免初始化和切换主题时把保存色覆盖回默认值。
const resolveHighlightColor = (theme: 'light' | 'dark', preferredColor?: string) => {
  if (preferredColor && validateColor(preferredColor)) {
    return optimizeColorForTheme(preferredColor, theme);
  }
  return getCurrentLyricThemeColor(theme);
};

// 计算是否栏
const showControls = computed(() => {
  if (lyricSetting.value.isLock) {
    return isHovering.value;
  }
  return true;
});

// 锁定态依赖桌面层鼠标穿透。
// 这里统一从一个入口同步状态，避免进入/离开窗口、重开歌词窗和切换锁定时出现穿透状态反转。
const syncIgnoreMouseState = (shouldIgnore: boolean) => {
  windowData.electron.ipcRenderer.send('set-ignore-mouse', shouldIgnore);
};

// 清除隐藏定时器
const clearHideTimer = () => {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer);
    hideControlsTimer = null;
  }
};

// 处理鼠标进入窗口
const handleMouseEnter = () => {
  if (lyricSetting.value.isLock) {
    isHovering.value = true;
    // 锁定态悬停需要临时收回鼠标穿透，否则控制栏会显示出来但无法点击。
    syncIgnoreMouseState(false);
  } else {
    syncIgnoreMouseState(false);
  }
};

// 处理鼠标离开窗口
const handleMouseLeave = () => {
  if (!lyricSetting.value.isLock) return;
  isHovering.value = false;
  syncIgnoreMouseState(true);

  // 强制重置背景色
  const lyricWindow = document.querySelector('.lyric-window') as HTMLElement;
  if (lyricWindow) {
    lyricWindow.style.background = 'transparent';
    // 使用 requestAnimationFrame 确保在下一帧重置
    requestAnimationFrame(() => {
      lyricWindow.style.background = 'transparent';
    });
  }
};

// 监听锁定状态变化
watch(
  () => lyricSetting.value.isLock,
  (newLock: boolean) => {
    if (newLock) {
      isHovering.value = false;
      // 锁定时自动关闭主题色面板
      showThemeColorPanel.value = false;
      syncIgnoreMouseState(true);
      return;
    }

    syncIgnoreMouseState(false);
  }
);

onMounted(() => {
  // 初始化时，如果是锁定状态，确保控制栏隐藏
  if (lyricSetting.value.isLock) {
    isHovering.value = false;
    syncIgnoreMouseState(true);
  }
});

onUnmounted(() => {
  clearHideTimer();
});

// 计算歌词滚动位置
const scrollOffset = ref(0);
const scrollLines = computed(() => {
  const start = Math.max(0, currentIndex.value - 4);
  return staticData.value.lrcArray
    .slice(start, currentIndex.value + 5)
    .map((line, offset) => ({ line, index: start + offset }));
});
const wrapperStyle = computed(() => ({ transform: `translateY(${scrollOffset.value}px)` }));
const measureCurrentLine = () => {
  if (displayMode.value !== 'scroll') return;
  const current = containerRef.value?.querySelector<HTMLElement>('.lyric-line-current');
  if (!current || !containerRef.value) return;
  // 根因：按固定行高累加忽略长歌词换行，字体变大或显示翻译时当前句会偏离窗口。
  // 仅渲染当前行前后各四句，并用真实布局测量居中，长歌词也不会与下一句重叠。
  scrollOffset.value =
    containerRef.value.clientHeight / 2 - current.offsetTop - current.offsetHeight / 2;
};
watch(
  [currentIndex, fontSize, showTranslation, displayMode, () => staticData.value.lrcArray],
  () => nextTick(measureCurrentLine),
  { flush: 'post' }
);
// 新增：根据是否有翻译文本动态计算每行的样式
const getDynamicLineStyle = (line: { text: string; trText: string }, withTranslation = true) => {
  const defaultHeight = lineHeight.value;
  if (withTranslation && line.trText) {
    const extraHeight = Math.round(fontSize.value * 0.6 * 1.4);
    return { minHeight: `${defaultHeight + extraHeight}px` };
  }
  return { minHeight: `${defaultHeight}px` };
};

// 更新容器高度和行高
const updateContainerHeight = () => {
  if (!containerRef.value) return;

  // 更新容器高度
  containerHeight.value = containerRef.value.clientHeight;

  // 计算基础行高(字体大小的2.5倍)
  const baseLineHeight = fontSize.value * 2.5;

  // 计算最大允许行高(容器高度的1/4)
  const maxAllowedHeight = containerHeight.value / 3;

  // 设置行高(不小于40px,不大于最大允许高度)
  lineHeight.value = Math.min(maxAllowedHeight, Math.max(40, baseLineHeight));
};

// 处理字体大小变化
const handleFontSizeChange = async () => {
  // 先保存字体大小
  saveFontSize();

  // 更新容器高度和行高
  updateContainerHeight();
};

// 增加字体大小
const increaseFontSize = async () => {
  if (fontSize.value < 48) {
    fontSize.value += fontSizeStep;
    await handleFontSizeChange();
  }
};

// 减小字体大小
const decreaseFontSize = async () => {
  if (fontSize.value > 12) {
    fontSize.value -= fontSizeStep;
    await handleFontSizeChange();
  }
};

// 保存字体大小到本地存储
const saveFontSize = () => {
  localStorage.setItem('lyricFontSize', fontSize.value.toString());
};

// 监听容器大小变化
onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    updateContainerHeight();
    measureCurrentLine();
  });

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }

  onUnmounted(() => {
    resizeObserver.disconnect();
  });
});
// 实际播放时间
const actualTime = ref(0);

// 计算当前行的进度（从本地 lrcTimeArray 取时间，避免依赖 IPC 传入的 startCurrentTime/nextTime）
// 行时间轴与播放器统一为秒；仅逐字 words 的时间仍为毫秒。
const currentProgress = computed(() => {
  const times = staticData.value.lrcTimeArray;
  const idx = currentIndex.value;
  const startTimeSec = times[idx];
  const endTimeSec = times[idx + 1] ?? staticData.value.allTime;
  // 使用严格判断，避免 startTimeSec=0 时被误判为无效
  if (startTimeSec === undefined || endTimeSec === undefined || endTimeSec <= startTimeSec)
    return 0;

  const currentTimeSec = actualTime.value; // 与 IPC 行时间轴保持相同单位
  const elapsed = currentTimeSec - startTimeSec;
  const duration = endTimeSec - startTimeSec;
  return Math.min(Math.max(elapsed / duration, 0), 1);
});

// 获取歌词样式
const getLyricStyle = (index: number) => {
  if (index !== currentIndex.value) return {};

  const progress = currentProgress.value * 100;

  // 使用更清晰的渐变实现
  return {
    background: `linear-gradient(to right, var(--highlight-color) ${progress}%, var(--text-color) ${progress}%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    // 优化字体渲染，减少发虚
    textRendering: 'optimizeLegibility' as const,
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const,
    // 使用 transform 而不是直接的 transition 来提高性能
    transform: 'translateZ(0)', // 启用硬件加速
    backfaceVisibility: 'hidden' as const, // 减少渲染问题
    transition: 'background 0.1s linear'
  };
};

// 逐字歌词样式函数
const getWordStyle = (
  lineIndex: number,
  _wordIndex: number,
  word: { text: string; startTime: number; duration: number }
) => {
  // 如果不是当前行，返回普通样式
  if (lineIndex !== currentIndex.value) {
    return {
      color: 'var(--text-color)',
      transition: 'color 0.3s ease',
      backgroundImage: 'none',
      WebkitTextFillColor: 'initial'
    };
  }

  // 当前行的逐字效果
  const currentTime = actualTime.value * 1000; // 转换为毫秒

  // 直接使用绝对时间比较
  const wordStartTime = word.startTime; // 单词开始的绝对时间（毫秒）
  const wordEndTime = word.startTime + word.duration;

  if (currentTime >= wordStartTime && currentTime < wordEndTime) {
    // 当前正在播放的单词 - 使用渐变进度效果
    const progress = Math.min((currentTime - wordStartTime) / word.duration, 1);
    const progressPercent = Math.round(progress * 100);

    return {
      backgroundImage: `linear-gradient(to right, var(--highlight-color) 0%, var(--highlight-color) ${progressPercent}%, var(--text-color) ${progressPercent}%, var(--text-color) 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      transition: 'all 0.1s ease'
    };
  } else if (currentTime >= wordEndTime) {
    // 已经播放过的单词 - 纯色显示
    return {
      color: 'var(--highlight-color)',
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  } else {
    // 还未播放的单词 - 普通状态
    return {
      color: 'var(--text-color)',
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  }
};

let lastPaintTime = 0;
const stopProgressAnimation = () => {
  if (animationFrameId.value !== null) cancelAnimationFrame(animationFrameId.value);
  animationFrameId.value = null;
};
const updateProgress = (frameTime: number) => {
  animationFrameId.value = null;
  if (!dynamicData.value.isPlay || document.hidden) return;
  // 根因：两个 watch 原先同时启动 RAF，循环数随暂停/播放增长；每帧还会刷新整首歌词。
  // 保留唯一循环，以 30fps 推进当前句，暂停、窗口隐藏和卸载时立即停止。
  if (frameTime - lastPaintTime >= 32) {
    lastPaintTime = frameTime;
    actualTime.value =
      dynamicData.value.nowTime +
      dynamicData.value.correctionTime +
      (performance.now() - lastUpdateTime.value) / 1000;
    let nextIndex = -1;
    for (let index = staticData.value.lrcTimeArray.length - 1; index >= 0; index -= 1) {
      if (staticData.value.lrcTimeArray[index] <= actualTime.value) {
        nextIndex = index;
        break;
      }
    }
    currentIndex.value = Math.max(0, nextIndex);
  }
  animationFrameId.value = requestAnimationFrame(updateProgress);
};
const syncProgressAnimation = () => {
  stopProgressAnimation();
  lastUpdateTime.value = performance.now();
  actualTime.value = dynamicData.value.nowTime + dynamicData.value.correctionTime;
  if (dynamicData.value.isPlay && !document.hidden) {
    animationFrameId.value = requestAnimationFrame(updateProgress);
  }
};
watch(
  () => [dynamicData.value.nowTime, dynamicData.value.isPlay, dynamicData.value.correctionTime],
  syncProgressAnimation,
  {
    immediate: true
  }
);
onMounted(() => document.addEventListener('visibilitychange', syncProgressAnimation));
onUnmounted(() => {
  stopProgressAnimation();
  document.removeEventListener('visibilitychange', syncProgressAnimation);
});
// 修改数据更新处
const handleDataUpdate = (parsedData: {
  type?: string;
  nowTime: number;
  correctionTime?: number;
  startCurrentTime: number;
  nextTime: number;
  isPlay: boolean;
  nowIndex: number;
  lrcArray?: Array<{ text: string; trText: string }>;
  lrcTimeArray?: number[];
  allTime?: number;
  playMusic?: SongResult;
}) => {
  // 确保数据存在且格式正确
  if (!parsedData) {
    console.error('Invalid update data received:', parsedData);
    return;
  }

  // 根据数据类型处理
  if (parsedData.type === 'update') {
    // 增量更新，只更新动态数据
    dynamicData.value = {
      ...dynamicData.value,
      correctionTime: parsedData.correctionTime ?? dynamicData.value.correctionTime,
      nowTime: Number.isFinite(parsedData.nowTime) ? parsedData.nowTime : dynamicData.value.nowTime,
      isPlay: typeof parsedData.isPlay === 'boolean' ? parsedData.isPlay : dynamicData.value.isPlay
    };

    // 更新索引（如果提供）
    if (typeof parsedData.nowIndex === 'number') {
      currentIndex.value = parsedData.nowIndex;
    }
    return;
  }

  // 完整更新或空歌词提示
  // 更新静态数据
  staticData.value = {
    lrcArray: parsedData.lrcArray || [],
    lrcTimeArray: parsedData.lrcTimeArray || [],
    allTime: parsedData.allTime || 0,
    playMusic: parsedData.playMusic || ({} as SongResult)
  };

  // 更新动态数据
  dynamicData.value = {
    nowTime: parsedData.nowTime || 0,
    correctionTime: parsedData.correctionTime || 0,
    startCurrentTime: parsedData.startCurrentTime || 0,
    nextTime: parsedData.nextTime || 0,
    isPlay: parsedData.isPlay
  };

  // 更新索引
  if (typeof parsedData.nowIndex === 'number') {
    currentIndex.value = parsedData.nowIndex;
  }
};

let removeLyricDataListener: (() => void) | undefined;

onMounted(() => {
  // 加载保存的字体大小
  const savedFontSize = localStorage.getItem('lyricFontSize');
  if (savedFontSize) {
    const savedSize = Number(savedFontSize);
    fontSize.value = Number.isFinite(savedSize) ? Math.min(48, Math.max(12, savedSize)) : 24;
    lineHeight.value = fontSize.value * 2.5;
  }

  // 初始化容器高度
  updateContainerHeight();
  window.addEventListener('resize', updateContainerHeight);

  // 监听歌词数据
  removeLyricDataListener = windowData.electron.ipcRenderer.on('receive-lyric', (_, data) => {
    try {
      const parsedData = JSON.parse(data);
      handleDataUpdate(parsedData);
    } catch (error) {
      console.error('Error parsing lyric data:', error);
    }
  });

  // 通知主窗口歌词窗口已就绪，请求发送完整歌词数据
  windowData.electron.ipcRenderer.send('lyric-ready');
});

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerHeight);
  removeLyricDataListener?.();
});

const checkTheme = () => {
  if (lyricSetting.value.theme === 'light') {
    lyricSetting.value.theme = 'dark';
  } else {
    lyricSetting.value.theme = 'light';
  }
};

// 主题色相关函数
const toggleThemeColorPanel = () => {
  showThemeColorPanel.value = !showThemeColorPanel.value;
};

const handleColorChange = (color: string) => {
  // 验证颜色有效性
  if (!validateColor(color)) {
    console.error('Invalid color received:', color);
    return;
  }

  try {
    currentHighlightColor.value = color;
    updateThemeColorWithTransition(color);

    // 更新 lyricSetting 中的 highlightColor
    lyricSetting.value.highlightColor = color;

    // 同时保存到专用的主题色存储
    saveLyricThemeColor(color);
  } catch (error) {
    console.error('Failed to handle color change:', error);
    // 恢复到默认颜色
    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    updateThemeColorWithTransition(defaultColor);
  }
};

const handleThemeColorPanelClose = () => {
  showThemeColorPanel.value = false;
};

// 导出重置函数以供将来使用
const resetThemeColor = () => {
  resetLyricThemeColor();
  const defaultColor = resolveHighlightColor(lyricSetting.value.theme);

  // 更新所有相关状态
  currentHighlightColor.value = defaultColor;
  lyricSetting.value.highlightColor = undefined;
  updateThemeColorWithTransition(defaultColor);
};

// 验证和修复颜色设置
const validateAndFixColorSettings = () => {
  try {
    // 检查当前高亮颜色是否有效
    if (currentHighlightColor.value && !validateColor(currentHighlightColor.value)) {
      console.warn('Current highlight color is invalid, resetting to default');
      const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
      currentHighlightColor.value = defaultColor;
      lyricSetting.value.highlightColor = undefined;
      updateCSSVariable('--lyric-highlight-color', defaultColor);
    }

    // 检查 lyricSetting 中的颜色是否有效
    if (lyricSetting.value.highlightColor && !validateColor(lyricSetting.value.highlightColor)) {
      console.warn('Stored highlight color is invalid, removing it');
      lyricSetting.value.highlightColor = undefined;
    }
  } catch (error) {
    console.error('Failed to validate color settings:', error);
    // 完全重置到默认状态
    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    lyricSetting.value.highlightColor = undefined;
    updateCSSVariable('--lyric-highlight-color', defaultColor);
  }
};

// 暴露函数
defineExpose({
  resetThemeColor,
  validateAndFixColorSettings
});

const updateCSSVariable = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const updateThemeColorWithTransition = (newColor: string) => {
  // 添加过渡类
  const lyricWindow = document.querySelector('.lyric-window');
  if (lyricWindow) {
    lyricWindow.classList.add('color-transitioning');
  }

  // 更新CSS变量
  updateCSSVariable('--lyric-highlight-color', newColor);

  // 移除过渡类
  setTimeout(() => {
    if (lyricWindow) {
      lyricWindow.classList.remove('color-transitioning');
    }
  }, 300);
};

const initializeThemeColor = () => {
  const initialColor = resolveHighlightColor(
    lyricSetting.value.theme,
    lyricSetting.value.highlightColor
  );
  currentHighlightColor.value = initialColor;
  updateCSSVariable('--lyric-highlight-color', initialColor);
};

// const handleTop = () => {
//   lyricSetting.value.isTop = !lyricSetting.value.isTop;
//   windowData.electron.ipcRenderer.send('top-lyric', lyricSetting.value.isTop);
// };

const handleLock = () => {
  lyricSetting.value.isLock = !lyricSetting.value.isLock;
  syncIgnoreMouseState(lyricSetting.value.isLock);
};

const handleClose = () => {
  windowData.electron.ipcRenderer.send('close-lyric');
};

const cycleDisplayMode = () => {
  const modes: Array<'scroll' | 'single' | 'double'> = ['scroll', 'single', 'double'];
  const current = modes.indexOf(lyricSetting.value.displayMode);
  lyricSetting.value.displayMode = modes[(current + 1) % modes.length];
};

// 安全保存歌词设置
const saveLyricSettings = (settings: typeof lyricSetting.value) => {
  try {
    localStorage.setItem('lyricData', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save lyric settings:', error);
  }
};

watch(
  () => lyricSetting.value,
  (newValue) => {
    saveLyricSettings(newValue);
  },
  { deep: true }
);

// 监听主题切换，自动调整颜色
watch(
  () => lyricSetting.value.theme,
  (newTheme) => {
    if (currentHighlightColor.value) {
      const optimizedColor = resolveHighlightColor(newTheme, lyricSetting.value.highlightColor);
      currentHighlightColor.value = optimizedColor;
      updateThemeColorWithTransition(optimizedColor);
    }
  }
);

// 双行模式：分组切换时触发淡出淡入过渡
// timer 类型必须为 ReturnType<typeof setTimeout> | null，不能用 number
let groupFadeTimer: ReturnType<typeof setTimeout> | null = null;

watch(currentGroupIndex, () => {
  if (displayMode.value !== 'double') return;
  if (groupFadeTimer !== null) clearTimeout(groupFadeTimer);
  isGroupTransitioning.value = true;
  groupFadeTimer = setTimeout(() => {
    isGroupTransitioning.value = false;
    groupFadeTimer = null;
  }, 300);
});

// 添加拖动相关变量
const isDragging = ref(false);
const startPosition = ref({ x: 0, y: 0 });
const lastMoveTime = ref(0);
const moveThrottleMs = 10; // 限制拖动事件发送频率，提高性能

// 处理鼠标按下事件
const handleMouseDown = (e: MouseEvent) => {
  // 主题色面板和顶部控制区都属于交互区，不能把点击误判成窗口拖动。
  if (!shouldStartLyricWindowDrag(e.target, lyricSetting.value.isLock)) {
    return;
  }

  // 只响应鼠标左键
  if (e.button !== 0) return;

  isDragging.value = true;
  startPosition.value = { x: e.screenX, y: e.screenY };
  lastMoveTime.value = performance.now();

  // 发送拖动开始信号到主进程
  windowData.electron.ipcRenderer.send('lyric-drag-start');

  // 添加全局鼠标事件监听
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;

    // 时间节流，避免过于频繁的更新
    const now = performance.now();
    if (now - lastMoveTime.value < moveThrottleMs) return;
    lastMoveTime.value = now;

    const deltaX = e.screenX - startPosition.value.x;
    const deltaY = e.screenY - startPosition.value.y;

    // 只有在实际移动时才发送事件
    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
      // 发送移动事件到主进程
      windowData.electron.ipcRenderer.send('lyric-drag-move', { deltaX, deltaY });
      startPosition.value = { x: e.screenX, y: e.screenY };
    }
  };

  const handleMouseUp = () => {
    if (!isDragging.value) return;
    isDragging.value = false;

    // 发送拖动结束信号到主进程
    windowData.electron.ipcRenderer.send('lyric-drag-end');

    // 移除事件监听
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // 添加全局事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// 组件卸载时清理
onUnmounted(() => {
  isDragging.value = false;
  if (groupFadeTimer !== null) {
    clearTimeout(groupFadeTimer);
    groupFadeTimer = null;
  }
});

onMounted(() => {
  const lyricLock = document.getElementById('lyric-lock');
  if (lyricLock) {
    lyricLock.onmouseenter = () => {
      if (lyricSetting.value.isLock) {
        syncIgnoreMouseState(false);
      }
    };
    lyricLock.onmouseleave = () => {
      if (lyricSetting.value.isLock) {
        syncIgnoreMouseState(true);
      }
    };
  }

  // 初始化主题色
  initializeThemeColor();

  // 验证和修复颜色设置
  validateAndFixColorSettings();
});

// 添加播放控制相关的函数
const handlePlayPause = () => {
  windowData.electron.ipcRenderer.send('control-back', 'playpause');
};

const handlePrev = () => {
  windowData.electron.ipcRenderer.send('control-back', 'prev');
};

const handleNext = () => {
  windowData.electron.ipcRenderer.send('control-back', 'next');
};
</script>

<style scoped>
html,
body,
#app {
  background-color: transparent !important;
  box-shadow: none !important;
  border: none !important;
}
</style>

<style lang="scss" scoped>
.lyric-window {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: transparent !important;
  user-select: none;
  transition: background-color 0.3s ease;
  cursor: default;
  border-radius: 14px;

  &.color-transitioning {
    .lyric-text-inner {
      transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .control-button {
      i {
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    }
  }

  &:hover {
    .control-bar {
      &-show {
        opacity: 1;
        visibility: visible;
      }
    }
  }

  &:active {
    cursor: grabbing;
  }

  &.dark {
    --text-color: #e6e6e6;
    --text-secondary: #ffffffea;
    --highlight-color: var(--lyric-highlight-color, #1ed760);
    --control-bg: rgba(255, 255, 255, 0.12);
    --control-hover-bg: rgba(255, 255, 255, 0.18);
    --control-border: rgba(255, 255, 255, 0.16);
    &:hover:not(.lyric_lock) {
      background: rgba(44, 44, 44, 0.466) !important;
    }
  }

  &.light {
    --text-color: #383838;
    --text-secondary: #282828ae;
    --highlight-color: var(--lyric-highlight-color, #1db954);
    --control-bg: rgba(255, 255, 255, 0.78);
    --control-hover-bg: rgba(255, 255, 255, 0.92);
    --control-border: rgba(255, 255, 255, 0.34);
    &:hover:not(.lyric_lock) {
      background: rgba(0, 0, 0, 0.434) !important;
    }
  }
}

.control-bar {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0 24px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  z-index: 100;

  .font-size-controls {
    -webkit-app-region: no-drag;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px;
    border: 1px solid var(--control-border);
    border-radius: 14px;
    background: var(--control-bg);
  }

  .play-controls {
    position: absolute;
    top: 0px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px;
    border: 1px solid var(--control-border);
    border-radius: 14px;
    background: var(--control-bg);
    -webkit-app-region: no-drag;

    .play-button {
      width: 40px;
      height: 40px;
      background: var(--highlight-color);
      color: #fff;
      i {
        font-size: 24px;
      }
    }
  }

  .control-buttons {
    -webkit-app-region: no-drag;
  }
}

.control-buttons {
  display: flex;
  gap: 10px;
  padding: 5px;
  border: 1px solid var(--control-border);
  border-radius: 14px;
  background: var(--control-bg);
  -webkit-app-region: no-drag;
}

.control-button {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 10px;
  color: var(--text-color);
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
  &:hover {
    background: var(--control-hover-bg);
  }

  &:active {
    transform: translateY(0);
  }

  i {
    font-size: 20px;
    text-shadow: none;

    &.active {
      color: var(--highlight-color);
    }
  }

  &.theme-color-button {
    &.active {
      background: var(--control-hover-bg);

      i {
        color: var(--highlight-color);
      }
    }
  }
}

.lyric-container {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 100;
}

// 单行模式容器：垂直居中，单行展示
.lyric-single-mode {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;

  .lyric-line {
    width: 100%;
    text-align: center;
  }
}

// 双行模式容器
.lyric-double-mode {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;
  // 分组切换淡出淡入
  transition: opacity 0.15s ease;

  &.group-fade {
    opacity: 0;
  }

  .lyric-line {
    width: 100%;
    text-align: center;
    // 同组非当前行：稍微暗化
    opacity: 0.55;
    transition: opacity 0.25s ease;

    &.lyric-line-current {
      opacity: 1;
    }
  }
}

.lyric-scroll {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}

.lyric-wrapper {
  will-change: transform;
  padding: 20vh 0;
  transform-origin: center center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lyric-line {
  padding: 4px 20px;
  text-align: center;
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  &.lyric-line-current {
    opacity: 1;

    // 当前播放歌词的特殊样式
    .lyric-text {
      // 移除阴影，避免干扰渐变效果
      text-shadow: none;

      .lyric-text-inner {
        // 为渐变文字添加轻微的外发光
        filter: none;
        // 确保渐变效果清晰
        -webkit-font-smoothing: antialiased;
      }
    }
  }

  &.lyric-line-passed {
    opacity: 0.6;
  }
}

.lyric-text {
  font-weight: 600;
  margin-bottom: 2px;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-all;
  transition: transform 0.2s ease;
  line-height: 1.4;
  // 优化字体渲染
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  text-shadow: none;

  .lyric-text-inner {
    transition: background 0.3s ease;
  }

  // 逐字歌词样式
  .word-by-word-lyric {
    display: inline-block;
    text-align: center;

    .lyric-word {
      display: inline-block;
      font-weight: inherit;
      font-size: inherit;
      letter-spacing: inherit;
      line-height: inherit;
      position: relative;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  }
}

.lyric-translation {
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  transition: font-size 0.2s ease;
  line-height: 1.4;

  text-shadow: none;
}

.lyric-empty {
  position: absolute;
  left: 50%;
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 132px;
  justify-content: center;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(30, 207, 115, 0.16);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-color) 78%, var(--highlight-color, #1ecf73) 22%);
  color: color-mix(in srgb, var(--text-color) 88%, var(--highlight-color, #1ecf73) 12%);
  font-size: 15px;
  font-weight: 600;
  padding: 13px 18px;
  text-shadow: none;
}

.lyric-empty::before {
  content: '♪';
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(30, 207, 115, 0.13);
  color: var(--highlight-color, #1ecf73);
  font-size: 15px;
  line-height: 1;
}

body {
  background-color: transparent !important;
  margin: 0;
}

.lyric-content {
  transition: font-size 0.2s ease;
}

.lyric-line-current {
  opacity: 1;
}

.control-bar {
  .control-buttons {
    .control-button {
      &:not(:has(.ri-lock-line)):not(:has(.ri-lock-unlock-line)) {
        .lyric_lock & {
          display: none;
        }
      }
    }
  }

  .lyric_lock & .font-size-controls {
    display: none;
  }

  .lyric_lock & .play-controls {
    display: none;
  }
}

.lyric_lock {
  background: transparent;
  &:hover {
    background: transparent;
  }

  #lyric-lock {
    position: absolute;
    top: 0;
    right: 72px;
    background: var(--control-bg);
  }
}

/* 工具栏只占一行，留出歌词的主要视区；透明桌面下使用细描边保住文字轮廓。 */
.control-bar {
  top: 8px;
  left: 10px;
  right: 10px;
  height: 36px;
  padding: 0;
  gap: 10px;
  align-items: center;
}
.lyric-window:focus-within .control-bar {
  opacity: 1;
  visibility: visible;
}
.control-bar .font-size-controls {
  flex: 1;
  min-width: 0;
  gap: 6px;
  padding: 3px;
  border-radius: 8px;
  border: 0;
}
.desktop-song-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
  font-size: 12px;
}
.control-bar .play-controls {
  position: static;
  transform: none;
  gap: 3px;
  padding: 3px;
  border-radius: 8px;
  border: 0;
}
.control-bar .control-buttons {
  flex: 0 0 auto;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  border: 0;
}
.control-bar .control-button {
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.control-bar .control-button i {
  font-size: 16px;
}
.control-bar .play-button {
  width: 30px;
  height: 30px;
}
.control-button:focus-visible {
  outline: 2px solid var(--highlight-color);
  outline-offset: 2px;
}
.lyric-container {
  top: 48px;
}
.lyric-wrapper {
  width: 100%;
  padding: 0;
  position: relative;
  flex-shrink: 0;
}
.lyric-text {
  font-weight: 650;
  overflow-wrap: anywhere;
  word-break: normal;
  paint-order: stroke fill;
}
.lyric-window.dark .lyric-text {
  -webkit-text-stroke: 0.65px rgba(9, 16, 12, 0.78);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
.lyric-window.light .lyric-text {
  -webkit-text-stroke: 0.65px rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.7);
}
.lyric-window.light:hover:not(.lyric_lock) {
  background: rgba(245, 248, 246, 0.94) !important;
}
.lyric-window.dark:hover:not(.lyric_lock) {
  background: rgba(16, 25, 20, 0.9) !important;
}
.lyric-line-current .lyric-text {
  text-shadow: inherit;
}
.lyric-translation {
  opacity: 0.85;
}
.lyric-empty {
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
}
@media (max-width: 640px) {
  .desktop-song-title {
    display: none;
  }
  .control-bar {
    gap: 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lyric-wrapper,
  .lyric-line,
  .lyric-double-mode {
    transition: none !important;
  }
}
</style>
