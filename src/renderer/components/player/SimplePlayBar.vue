<template>
  <div class="simple-play-bar" :class="{ 'dark-theme': isDarkMode }" ref="playBarRef">
    <div class="container">
      <!-- 进度条区域 -->
      <div class="progress-wrapper">
        <span class="time current-time">{{ formatTime(displayTime) }}</span>
        <div
          class="progress-bar"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="handleProgressMouseDown"
          @click.stop="handleProgressClick"
        >
          <div class="progress-track"></div>
          <div class="progress-fill" :style="{ width: `${progressPercentage}%` }">
            <div class="progress-handle"></div>
          </div>
        </div>
        <span class="time total-time">{{ formatTime(allTime) }}</span>
      </div>

      <!-- 控制区域 -->
      <div class="controls-wrapper">
        <div class="left-controls">
          <button class="control-btn small-btn" @click="togglePlayMode" title="播放模式">
            <i
              class="iconfont"
              :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"
            ></i>
          </button>
        </div>

        <div class="center-controls">
          <button class="control-btn" @click="handlePrev" title="上一首">
            <i class="iconfont icon-prev"></i>
          </button>
          <button class="control-btn play-btn" @click="playMusicEvent" title="播放/暂停">
            <i class="iconfont" :class="play ? 'icon-stop' : 'icon-play'"></i>
          </button>
          <button class="control-btn" @click="handleNext" title="下一首">
            <i class="iconfont icon-next"></i>
          </button>
        </div>

        <div class="right-controls">
          <div class="volume-control" title="音量">
            <i class="iconfont" :class="getVolumeIcon" @click="mute"></i>
            <div class="volume-slider">
              <n-slider
                v-model:value="volumeSlider"
                :step="1"
                :tooltip="false"
                @wheel.prevent="handleVolumeWheel"
              ></n-slider>
            </div>
          </div>
          <song-download-button
            v-if="playMusic?.id"
            :item="playMusic"
            size="small"
            title="下载歌曲"
          />
          <button class="control-btn small-btn" @click="openPlayListDrawer" title="播放列表">
            <i class="iconfont icon-list"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';

import { allTime, nowTime, playMusic } from '@/hooks/MusicHook';
import { usePlayMode } from '@/hooks/usePlayMode';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { secondToMinute } from '@/utils';

const SongDownloadButton = defineAsyncComponent(
  () => import('@/components/common/SongDownloadButton.vue')
);

const props = withDefaults(
  defineProps<{
    isDark: boolean;
  }>(),
  {
    isDark: false
  }
);

const playerStore = usePlayerStore();
const playBarRef = ref<HTMLElement | null>(null);

// 播放状态
const play = computed(() => playerStore.isPlay);

// 播放模式
const { playMode, playModeIcon, togglePlayMode } = usePlayMode();

// 音量控制
const audioVolume = ref(
  localStorage.getItem('volume') ? parseFloat(localStorage.getItem('volume') as string) : 1
);

const volumeSlider = computed({
  get: () => audioVolume.value * 100,
  set: (value) => {
    localStorage.setItem('volume', (value / 100).toString());
    audioService.setVolume(value / 100);
    audioVolume.value = value / 100;
  }
});

// 音量图标
const getVolumeIcon = computed(() => {
  if (audioVolume.value === 0) return 'ri-volume-mute-line';
  if (audioVolume.value <= 0.5) return 'ri-volume-down-line';
  return 'ri-volume-up-line';
});

// 静音切换
const mute = () => {
  if (volumeSlider.value === 0) {
    volumeSlider.value = 30;
  } else {
    volumeSlider.value = 0;
  }
};

// 鼠标滚轮调整音量
const handleVolumeWheel = (e: WheelEvent) => {
  const delta = e.deltaY < 0 ? 5 : -5;
  const newValue = Math.min(Math.max(volumeSlider.value + delta, 0), 100);
  volumeSlider.value = newValue;
};

// 播放控制
const handlePrev = () => playerStore.prevPlay();
const handleNext = () => playerStore.nextPlay();

const playMusicEvent = async () => {
  try {
    await playerStore.setPlay({ ...playMusic.value });
  } catch (error) {
    console.error('播放出错:', error);
    playerStore.nextPlay();
  }
};

// 进度条控制
const isDragging = ref(false);
const dragProgress = ref(0); // 拖拽时的预览进度 (0-100)

// 计算当前显示的进度百分比
const progressPercentage = computed(() => {
  if (isDragging.value) {
    return dragProgress.value;
  }
  if (allTime.value === 0) return 0;
  return (nowTime.value / allTime.value) * 100;
});

// 计算显示的时间
const displayTime = computed(() => {
  if (isDragging.value) {
    return (dragProgress.value / 100) * allTime.value;
  }
  return nowTime.value;
});

// 计算进度百分比的辅助函数
const calculateProgress = (clientX: number, element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return percent * 100;
};

// 更新音频进度
const seekToProgress = (percentage: number) => {
  const targetTime = (percentage / 100) * allTime.value;
  audioService.seek(targetTime);
  // 不立即更新 nowTime,让音频服务的回调来更新,避免不同步
};

// 鼠标按下开始拖拽
const handleProgressMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // 只响应左键

  const target = e.currentTarget as HTMLElement;
  isDragging.value = true;
  dragProgress.value = calculateProgress(e.clientX, target);

  // 添加全局鼠标移动和释放监听
  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (isDragging.value) {
      dragProgress.value = calculateProgress(moveEvent.clientX, target);
    }
  };

  const handleMouseUp = () => {
    if (isDragging.value) {
      // 拖拽结束,执行跳转
      seekToProgress(dragProgress.value);
      isDragging.value = false;
    }
    // 移除事件监听
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // 防止文本选择
  e.preventDefault();
};

// 点击进度条跳转
const handleProgressClick = (e: MouseEvent) => {
  // 如果正在拖拽,不处理点击事件
  if (isDragging.value) return;

  const target = e.currentTarget as HTMLElement;
  const percentage = calculateProgress(e.clientX, target);
  seekToProgress(percentage);
};

// 格式化时间
const formatTime = (seconds: number) => {
  return secondToMinute(seconds);
};

// 打开播放列表抽屉
const openPlayListDrawer = () => {
  playerStore.setPlayListDrawerVisible(true);
};

// 深色模式
const isDarkMode = computed(() => props.isDark);

// 主题颜色应用函数
const applyThemeColor = (colorValue: string) => {
  if (!colorValue || !playBarRef.value) return;

  console.log('应用主题色:', colorValue);
  const playBarElement = playBarRef.value;

  // 解析RGB值
  const rgbMatch = colorValue.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

  if (rgbMatch) {
    const [_, r, g, b] = rgbMatch.map(Number);

    // 计算颜色亮度 (0-255)
    // 使用加权平均值公式: 0.299*R + 0.587*G + 0.114*B
    const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    console.log(`主题色亮度: ${brightness}/255`);

    // 设置主色
    playBarElement.style.setProperty('--fill-color', colorValue);

    // 亮度自适应处理
    if (brightness > 200) {
      // 非常亮的颜色
      // 深化主色以增加对比度
      const darkenedColor = `rgb(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)})`;
      playBarElement.style.setProperty('--fill-color-alt', darkenedColor);
      playBarElement.style.setProperty('--fill-color-transparent', `rgba(${r}, ${g}, ${b}, 0.5)`); // 提高透明度
      playBarElement.style.setProperty('--text-on-fill', '#000000'); // 亮色背景上用黑色文字
      playBarElement.style.setProperty('--high-contrast-color', '#000000'); // 高对比度颜色
      playBarElement.classList.add('light-theme-color');
      playBarElement.classList.remove('dark-theme-color');
    } else if (brightness < 50) {
      // 非常暗的颜色
      // 提亮主色以增加可见性
      const lightenedColor = `rgb(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)})`;
      playBarElement.style.setProperty('--fill-color-alt', lightenedColor);
      playBarElement.style.setProperty('--fill-color-transparent', `rgba(${r}, ${g}, ${b}, 0.7)`); // 提高透明度
      playBarElement.style.setProperty('--text-on-fill', '#ffffff'); // 暗色背景上用白色文字
      playBarElement.style.setProperty('--high-contrast-color', '#ffffff'); // 高对比度颜色
      playBarElement.classList.add('dark-theme-color');
      playBarElement.classList.remove('light-theme-color');
    } else {
      // 计算辅助色和高亮色
      // 普通亮度颜色，正常处理
      playBarElement.style.setProperty('--fill-color-alt', colorValue); // 保持一致
      playBarElement.style.setProperty('--fill-color-transparent', `rgba(${r}, ${g}, ${b}, 0.25)`);
      // 根据亮度决定文本颜色
      const textColor = brightness > 125 ? '#000000' : '#ffffff';
      playBarElement.style.setProperty('--text-on-fill', textColor);
      playBarElement.style.setProperty('--high-contrast-color', textColor);
      playBarElement.classList.remove('light-theme-color');
      playBarElement.classList.remove('dark-theme-color');
    }

    // 设置亮色（用于高亮效果）
    const lightenedColor = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
    playBarElement.style.setProperty('--fill-color-light', lightenedColor);
  } else {
    // 无法解析RGB值时的默认设置
    playBarElement.style.setProperty('--fill-color', colorValue);
    playBarElement.style.setProperty('--fill-color-transparent', `${colorValue}40`);
    playBarElement.style.setProperty('--fill-color-light', `${colorValue}80`);
    playBarElement.style.setProperty('--fill-color-alt', colorValue);
    playBarElement.style.setProperty('--text-on-fill', '#ffffff');
    playBarElement.style.setProperty('--high-contrast-color', '#ffffff');
  }
};

// 监听主题色变化
watch(
  () => playerStore.playMusic.primaryColor,
  (newVal) => {
    if (newVal) {
      applyThemeColor(newVal);
    }
  }
);

onMounted(() => {
  if (playerStore.playMusic?.primaryColor) {
    setTimeout(() => {
      applyThemeColor(playerStore.playMusic.primaryColor as string);
    }, 50);
  }
});
</script>

<style lang="scss" scoped>
.simple-play-bar {
  @apply w-full;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  padding: 0 20px;
  transition: opacity 0.3s ease;

  /* 默认变量 */
  --text-on-fill: var(--qqm-on-primary, #ffffff);
  --high-contrast-color: var(--qqm-on-primary, #ffffff);

  &.dark-theme {
    --text-color: var(--qqm-text, #f1f1f1);
    --muted-color: rgba(255, 255, 255, 0.5);
    --track-color: rgba(255, 255, 255, 0.1);
    --track-color-hover: rgba(255, 255, 255, 0.2);
    --fill-color: var(--qqm-primary, #22c55e);
    --fill-color-alt: var(--qqm-primary-strong, #16a34a);
    --button-bg: rgba(255, 255, 255, 0.06);
    --button-hover: rgba(255, 255, 255, 0.12);
  }

  &:not(.dark-theme) {
    --text-color: var(--qqm-text, #111111);
    --muted-color: rgba(0, 0, 0, 0.5);
    --track-color: rgba(0, 0, 0, 0.08);
    --track-color-hover: rgba(0, 0, 0, 0.15);
    --fill-color: var(--qqm-primary, #22c55e);
    --fill-color-alt: var(--qqm-primary-strong, #16a34a);
    --button-bg: rgba(0, 0, 0, 0.04);
    --button-hover: rgba(0, 0, 0, 0.08);
  }

  &.light-theme-color {
    .control-btn.play-btn {
      color: var(--text-on-fill);
    }
  }
}

.container {
  @apply flex flex-col w-full max-w-[1000px] mx-auto;
}

/* 进度条区域 */
.progress-wrapper {
  @apply flex items-center justify-between w-full mb-3;

  .time {
    @apply text-sm font-medium w-12 text-center;
    color: var(--muted-color);
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    @apply relative cursor-pointer h-1.5 flex-1 mx-4;
    user-select: none;
    transition: height 0.2s ease;

    .progress-track {
      @apply absolute inset-0 rounded-full transition-colors duration-200;
      background-color: var(--track-color);
    }

    .progress-fill {
      @apply absolute top-0 left-0 h-full rounded-full;
      background: var(--fill-color);

      .progress-handle {
        @apply absolute right-0 top-1/2 rounded-full opacity-0 transition-opacity duration-200;
        width: 10px;
        height: 10px;
        background: white;
        transform: translate(50%, -50%);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
    }

    &:hover,
    &.is-dragging {
      height: 6px;
      .progress-track {
        background-color: var(--track-color-hover);
      }
      .progress-handle {
        opacity: 1;
      }
    }
  }
}

/* 控制区域 */
.controls-wrapper {
  @apply flex items-center justify-between w-full h-14;
}

.left-controls,
.right-controls {
  @apply flex items-center gap-4 w-[160px];
}

.right-controls {
  @apply justify-end;
}

.center-controls {
  @apply flex items-center justify-center gap-6;
}

.control-btn {
  @apply flex items-center justify-center rounded-full outline-none border-0 transition-all duration-200;
  color: var(--text-color);
  background: transparent;
  width: 38px;
  height: 38px;
  cursor: pointer;

  &:hover {
    background-color: var(--button-bg);
    transform: scale(1.05);
  }

  &:active {
    background-color: var(--button-hover);
    transform: scale(0.95);
  }

  &.play-btn {
    background: var(--fill-color);
    color: var(--text-on-fill);
    width: 58px;
    height: 58px;
    box-shadow: 0 6px 18px var(--fill-color-transparent);

    &:hover {
      background: var(--fill-color-alt);
      transform: scale(1.1);
      box-shadow: 0 8px 24px var(--fill-color-light);
    }

    &:active {
      transform: scale(0.94);
    }

    .iconfont {
      font-size: 1.8rem;
    }
    .icon-play {
      margin-left: 4px; /* 播放图标视觉居中调整 */
    }
  }

  &.small-btn {
    width: 32px;
    height: 32px;
  }

  .iconfont {
    @apply text-2xl;
  }
}

.volume-control {
  @apply flex items-center space-x-2 relative;
  color: var(--text-color);

  .iconfont {
    @apply cursor-pointer;
    font-size: 1.25rem;
    &:hover {
      color: var(--fill-color);
    }
  }

  .volume-slider {
    @apply w-20;

    :deep(.n-slider) {
      --n-rail-height: 4px;
      --n-fill-color: var(--fill-color);
      --n-rail-color: var(--track-color);
      --n-handle-size: 10px;

      .n-slider-rail {
        @apply rounded-full;
      }
      .n-slider-rail__fill {
        background: var(--fill-color);
      }
      .n-slider-handle {
        @apply opacity-0 transition-opacity duration-200;
        background: white;
        border: 2px solid var(--fill-color);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      &:hover .n-slider-handle {
        @apply opacity-100;
      }
    }
  }
}

.intelligence-active {
  color: var(--qqm-primary, #22c55e);
}
</style>
