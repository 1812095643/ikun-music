<template>
  <n-drawer
    v-model:show="isVisible"
    height="100%"
    placement="bottom"
    :style="drawerBaseStyle"
    :to="`#layout-main`"
    :z-index="9998"
  >
    <!-- 背景层（用于图片模糊和明暗效果） -->
    <div class="background-layer" :style="dynamicBackgroundStyle"></div>
    <!-- 遮罩层，确保文本可读 -->
    <!-- isDark 为 true 说明字体颜色被计算为黑色（即背景很亮），为了在任何情况下都能看清黑字，我们给背景盖一层亮色遮罩 -->
    <div class="background-overlay" :class="isDark ? 'light-overlay' : 'dark-overlay'"></div>
    <div id="drawer-target" :class="[config.theme]" class="relative z-10">
      <!-- 左侧关闭按钮 -->
      <div
        class="control-left absolute top-8 left-8 z-[9999]"
        :class="{ 'pure-mode': config.pureModeEnabled }"
      >
        <div class="control-btn" @click="closeMusicFull">
          <i class="ri-arrow-down-s-line"></i>
        </div>
      </div>

      <!-- 右侧功能按钮组 -->
      <div
        class="control-right absolute top-8 right-8 z-[9999]"
        :class="{ 'pure-mode': config.pureModeEnabled }"
      >
        <n-popover trigger="click" placement="bottom" raw>
          <template #trigger>
            <div class="control-btn" :class="{ loading: lyricStore.loading }">
              <i class="ri-file-list-3-line"></i>
            </div>
          </template>
          <lyric-source-selector
            :candidates="lyricStore.candidates"
            :active-key="lyricStore.activeCandidateKey"
            :loading="lyricStore.loading"
            :error-message="lyricStore.errorMessage"
            @select="handleSelectLyricCandidate"
            @refresh="handleRefreshLyricCandidates"
          />
        </n-popover>

        <n-popover trigger="click" placement="bottom" raw>
          <template #trigger>
            <div class="control-btn">
              <i class="ri-settings-3-line"></i>
            </div>
          </template>
          <lyric-settings ref="lyricSettingsRef" />
        </n-popover>

        <div class="control-btn" @click="toggleFullScreen">
          <i :class="isFullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
        </div>
      </div>

      <div class="player-layout-container" :style="{ width: `${config.contentWidth}%` }">
        <div class="content-wrapper">
          <!-- 左侧：封面区域 (黑胶唱片模式) -->
          <div
            v-if="!config.hideCover"
            class="left-side"
            :class="{ 'only-cover': config.hideLyrics }"
          >
            <div class="vinyl-stage">
              <div class="vinyl-cd-container relative">
                <!-- Tonearm (Needle) -->
                <div class="tonearm-wrapper" :class="{ playing: playerStore.isPlay }">
                  <svg
                    class="tonearm-svg"
                    viewBox="0 0 100 150"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <!-- Tonearm Pivot Base -->
                    <circle
                      cx="50"
                      cy="20"
                      r="12"
                      fill="url(#metalGrad)"
                      stroke="#1a1a1a"
                      stroke-width="1.5"
                    />
                    <circle cx="50" cy="20" r="5" fill="#555" />

                    <!-- Tonearm Arm -->
                    <path
                      d="M50 20 L55 85 L38 120"
                      stroke="url(#metalGradArm)"
                      stroke-width="4.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M50 20 L55 85 L38 120"
                      stroke="#111"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />

                    <!-- Needle Head -->
                    <rect
                      x="29"
                      y="116"
                      width="18"
                      height="10"
                      rx="2"
                      transform="rotate(-15 38 121)"
                      fill="#1c1c1c"
                      stroke="#444"
                      stroke-width="1"
                    />
                    <rect
                      x="33"
                      y="119"
                      width="10"
                      height="4"
                      rx="0.5"
                      transform="rotate(-15 38 121)"
                      fill="#1ecf73"
                    />

                    <defs>
                      <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#cccccc" />
                        <stop offset="50%" stop-color="#888888" />
                        <stop offset="100%" stop-color="#aaaaaa" />
                      </linearGradient>
                      <linearGradient id="metalGradArm" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#e0e0e0" />
                        <stop offset="50%" stop-color="#999999" />
                        <stop offset="100%" stop-color="#555555" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                <!-- Rotating Vinyl Disc -->
                <div class="vinyl-disc-outer">
                  <div class="vinyl-disc" :class="{ playing: playerStore.isPlay }">
                    <!-- Vinyl Grooves Shine Overlay -->
                    <div class="vinyl-shine"></div>
                    <!-- Center Album Art Cover -->
                    <div class="vinyl-cover-wrap">
                      <img
                        v-if="vinylCoverUrl && !vinylCoverLoadFailed"
                        :src="vinylCoverUrl"
                        class="vinyl-cover"
                        alt=""
                        @error="vinylCoverLoadFailed = true"
                      />
                      <div v-else class="vinyl-cover-fallback">
                        <i class="ri-music-2-line"></i>
                      </div>
                    </div>
                    <!-- Vinyl Center Spindle Hole -->
                    <div class="vinyl-center-hole"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="music-info">
              <div class="music-content-name" v-html="playMusic.name"></div>
              <div class="music-content-singer">
                <n-ellipsis
                  class="text-ellipsis"
                  line-clamp="2"
                  :tooltip="{
                    contentStyle: { maxWidth: '600px' },
                    zIndex: 99999
                  }"
                >
                  <span
                    v-for="(item, index) in artistList"
                    :key="index"
                    class="cursor-pointer hover:text-primary"
                    @click="handleArtistClick(item.id)"
                  >
                    {{ item.name }}
                    {{ index < artistList.length - 1 ? ' / ' : '' }}
                  </span>
                </n-ellipsis>
              </div>
            </div>
          </div>

          <!-- 右侧：歌词区域 -->
          <div
            class="right-side"
            :class="{
              center: config.centerLyrics,
              hide: config.hideLyrics,
              'full-width': config.hideCover
            }"
          >
            <n-layout
              ref="lrcSider"
              class="music-lrc"
              :native-scrollbar="false"
              @mouseover="mouseOverLayout"
              @mouseleave="mouseLeaveLayout"
            >
              <!-- 歌曲信息 -->
              <div class="music-lrc-container">
                <div
                  v-if="config.hideCover"
                  class="music-info-header"
                  :style="{ textAlign: config.centerLyrics ? 'center' : 'left' }"
                >
                  <div class="music-info-name" v-html="playMusic.name"></div>
                  <div class="music-info-singer">
                    <span
                      v-for="(item, index) in artistList"
                      :key="index"
                      class="cursor-pointer hover:text-primary"
                      @click="handleArtistClick(item.id)"
                    >
                      {{ item.name }}
                      {{ index < artistList.length - 1 ? ' / ' : '' }}
                    </span>
                  </div>
                </div>
                <!-- 无时间戳歌词提示 -->
                <div
                  v-if="lrcArray.length > 0 && !supportAutoScroll"
                  class="music-lrc-text no-scroll-tip"
                >
                  <span>{{ t('player.lrc.noAutoScroll') }}</span>
                </div>
                <div
                  v-for="(item, index) in lrcArray"
                  :id="`music-lrc-text-${index}`"
                  :key="index"
                  class="music-lrc-text"
                  :class="{
                    'now-text': index === nowIndex,
                    'hover-text': item.text && item.startTime !== -1
                  }"
                  @click="item.startTime !== -1 ? setAudioTime(index) : null"
                >
                  <!-- 逐字歌词显示 -->
                  <div
                    v-if="item.hasWordByWord && item.words && item.words.length > 0"
                    class="word-by-word-lyric"
                  >
                    <template v-for="(word, wordIndex) in item.words" :key="wordIndex">
                      <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">
                        {{ word.text }} </span
                      ><span class="lyric-word" v-if="word.space">&nbsp;</span></template
                    >
                  </div>
                  <!-- 普通歌词显示 -->
                  <span v-else :style="getLrcStyle(index)">{{ item.text }}</span>
                  <div v-show="config.showTranslation" class="music-lrc-text-tr">
                    {{ item.trText }}
                  </div>
                </div>

                <!-- 无歌词 -->
                <div v-if="!lrcArray.length" class="music-lrc-text">
                  <span>{{ t('player.lrc.noLrc') }}</span>
                </div>
              </div>
              <!-- 歌词右下角矫正按钮组件 -->
              <lyric-correction-control
                v-if="!isMobile"
                :correction-time="correctionTime"
                @adjust="adjustCorrectionTime"
              />
            </n-layout>
          </div>
        </div>
        <!-- End of content-wrapper -->

        <!-- 底部控制栏 -->
        <div class="bottom-controls" :class="{ 'pure-mode': config.pureModeEnabled }">
          <simple-play-bar
            v-if="!config.hideMiniPlayBar"
            :pure-mode-enabled="config.pureModeEnabled"
            :isDark="textColors.theme === 'dark'"
            class="full-width-play-bar"
          />
        </div>
      </div>
      <!-- End of player-layout-container -->
    </div>
  </n-drawer>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Cover3D from '@/components/cover/Cover3D.vue';
import LyricCorrectionControl from '@/components/lyric/LyricCorrectionControl.vue';
import LyricSettings from '@/components/lyric/LyricSettings.vue';
import LyricSourceSelector from '@/components/lyric/LyricSourceSelector.vue';
import SimplePlayBar from '@/components/player/SimplePlayBar.vue';
import {
  adjustCorrectionTime,
  artistList,
  correctionTime,
  lrcArray,
  nowIndex,
  nowTime,
  playMusic,
  setAudioTime,
  textColors,
  useLyricProgress
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { loadLyricCandidates } from '@/services/lyricCandidateService';
import { useLyricStore } from '@/store/modules/lyric';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { DEFAULT_LYRIC_CONFIG, LyricConfig } from '@/types/lyric';
import { getImgUrl, isMobile } from '@/utils';
import { animateGradient, getHoverBackgroundColor, getTextColors } from '@/utils/linearColor';

const { t } = useI18n();
// 定义 refs
const lrcSider = ref<any>(null);
const isMouse = ref(false);
const currentBackground = ref('');
const animationFrame = ref<number | null>(null);
const isDark = ref(false);

// 计算自定义背景样式
const customBackgroundStyle = computed(() => {
  if (!config.value.useCustomBackground) {
    return null;
  }

  switch (config.value.backgroundMode) {
    case 'solid':
      return config.value.solidColor;
    case 'gradient': {
      const { colors, direction } = config.value.gradientColors;
      return `linear-gradient(${direction}, ${colors.join(', ')})`;
    }
    case 'image':
      if (!config.value.backgroundImage) return null;
      // 构建完整的背景样式，包括滤镜效果
      return config.value.backgroundImage;
    case 'css':
      return config.value.customCss || null;
    default:
      return null;
  }
});

// drawer 基础样式（非图片模式）
const drawerBaseStyle = computed(() => {
  // 图片模式时不设置背景，使用单独的背景层
  if (config.value.useCustomBackground && config.value.backgroundMode === 'image') {
    return { background: 'transparent' };
  }
  // 其他模式正常设置背景
  if (config.value.useCustomBackground && customBackgroundStyle.value) {
    return { background: customBackgroundStyle.value };
  }
  return { background: currentBackground.value || props.background };
});

// 背景图片层样式（只在图片模式下使用）
const backgroundImageStyle = computed(() => {
  const blur = config.value.imageBlur || 0;
  const brightness = config.value.imageBrightness || 100;
  return {
    backgroundImage: `url(${config.value.backgroundImage})`,
    filter: `blur(${blur}px) brightness(${brightness}%)`
  };
});

// 新的动态背景样式
const dynamicBackgroundStyle = computed(() => {
  // 如果开启了自定义背景且模式为 image
  if (
    config.value.useCustomBackground &&
    config.value.backgroundMode === 'image' &&
    config.value.backgroundImage
  ) {
    return backgroundImageStyle.value;
  }
  // 否则默认使用当前歌曲封面的深度模糊作为背景（QQ音乐沉浸式效果）
  const imgUrl = getImgUrl(playMusic.value?.picUrl, '1024y1024');
  return {
    backgroundImage: `url("${imgUrl}")`, // ADD QUOTES TO FIX SPACES IN URL
    filter: 'blur(80px) saturate(150%)',
    transform: 'scale(1.2)' // 稍微放大以隐藏模糊边缘
  };
});
const showStickyHeader = ref(false);
const lyricSettingsRef = ref<InstanceType<typeof LyricSettings>>();
const isSongChanging = ref(false);
const isFullScreen = ref(false);
const vinylCoverLoadFailed = ref(false);

const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });
const vinylCoverUrl = computed(() => {
  const picUrl = playMusic.value?.picUrl;
  return picUrl ? getImgUrl(picUrl, '300y300') : '';
});

watch(vinylCoverUrl, () => {
  vinylCoverLoadFailed.value = false;
});

watch(
  () => lyricSettingsRef.value?.config,
  (newConfig) => {
    if (newConfig) {
      config.value = newConfig;
    }
  },
  { deep: true, immediate: true }
);

// 监听本地配置变化，保存到 localStorage
watch(
  () => config.value,
  (newConfig) => {
    localStorage.setItem('music-full-config', JSON.stringify(newConfig));
    if (lyricSettingsRef.value) {
      lyricSettingsRef.value.config = newConfig;
    }
  },
  { deep: true }
);

const supportAutoScroll = computed(() => {
  return lrcArray.value.length > 0 && lrcArray.value[0].startTime !== -1;
});

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  background: {
    type: String,
    default: ''
  }
});

const themeMusic = {
  light: 'var(--qqm-bg, #f7f8fa)',
  dark: 'var(--qqm-bg, #050505)'
};

const emit = defineEmits(['update:modelValue']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 歌词滚动方法
const lrcScroll = (behavior: ScrollBehavior = 'smooth', forceTop: boolean = false) => {
  if (!isVisible.value || !lrcSider.value || !supportAutoScroll.value) return;

  if (forceTop) {
    lrcSider.value.scrollTo({
      top: 0,
      behavior
    });
    return;
  }

  if (isMouse.value) return;

  const nowEl = document.querySelector(`#music-lrc-text-${nowIndex.value}`) as HTMLElement;
  if (nowEl) {
    const containerHeight = lrcSider.value.$el.clientHeight;
    const elementTop = nowEl.offsetTop;
    const scrollTop = elementTop - containerHeight / 2 + nowEl.clientHeight / 2;

    lrcSider.value.scrollTo({
      top: scrollTop,
      behavior
    });
  }
};

const debouncedLrcScroll = useDebounceFn(lrcScroll, 200);

const mouseOverLayout = () => {
  if (isMobile.value) {
    return;
  }
  isMouse.value = true;
};

const mouseLeaveLayout = () => {
  if (isMobile.value) {
    return;
  }
  setTimeout(() => {
    isMouse.value = false;
    lrcScroll();
  }, 2000);
};

watch(nowIndex, () => {
  // 歌曲切换时不自动滚动
  if (isSongChanging.value) return;
  debouncedLrcScroll();
});

watch(
  () => isVisible.value,
  () => {
    if (isVisible.value) {
      nextTick(() => {
        lrcScroll('instant');
      });
    }
  }
);

const setTextColors = (background: string) => {
  if (!background) {
    textColors.value = getTextColors();
    document.documentElement.style.setProperty('--hover-bg-color', getHoverBackgroundColor(false));
    document.documentElement.style.setProperty('--text-color-primary', textColors.value.primary);
    document.documentElement.style.setProperty('--text-color-active', textColors.value.active);
    return;
  }

  // 更新文字颜色
  textColors.value = getTextColors(background);
  isDark.value = textColors.value.active === '#000000';

  document.documentElement.style.setProperty(
    '--hover-bg-color',
    getHoverBackgroundColor(isDark.value)
  );
  document.documentElement.style.setProperty('--text-color-primary', textColors.value.primary);
  document.documentElement.style.setProperty('--text-color-active', textColors.value.active);

  // 处理背景颜色动画
  if (currentBackground.value) {
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value);
    }
    const result = animateGradient(currentBackground.value, background, (gradient) => {
      currentBackground.value = gradient;
    });
    if (typeof result === 'number') {
      animationFrame.value = result;
    }
  } else {
    currentBackground.value = background;
  }
};

const settingsStore = useSettingsStore();
const targetBackground = computed(() => {
  if (
    config.value.useCustomBackground &&
    config.value.backgroundMode === 'image' &&
    config.value.backgroundImage
  ) {
    if (typeof customBackgroundStyle.value === 'string') {
      return customBackgroundStyle.value;
    }
  }
  // 核心修复：如果是沉浸式毛玻璃背景（即没有使用自定义图片），歌词颜色应该跟随当前封面主色调
  if (!config.value.useCustomBackground || config.value.backgroundMode !== 'image') {
    if (playMusic.value?.primaryColor) {
      return playMusic.value.primaryColor;
    }
  }

  if (config.value.theme !== 'default') {
    return themeMusic[config.value.theme] || props.background;
  }
  // 核心修复：如果没有主色调，且主题是跟随系统，使用全局设置的主题背景色计算文字，防止 props.background 因为 mock 数据传错导致白色背景白色文字
  return settingsStore.theme === 'dark' ? themeMusic.dark : themeMusic.light;
});

// 监听目标背景变化并更新文字颜色
watch(
  targetBackground,
  (newBg) => {
    if (newBg) {
      setTextColors(newBg);
    }
  },
  { immediate: true }
);

const { getLrcStyle: originalLrcStyle } = useLyricProgress();

const getLrcStyle = (index: number) => {
  const colors = textColors.value || getTextColors();
  const originalStyle = originalLrcStyle(index);

  if (index === nowIndex.value) {
    // 当前播放的歌词
    if (originalStyle.backgroundImage) {
      // 有渐变进度时，使用渐变效果
      return {
        ...originalStyle,
        backgroundImage: originalStyle.backgroundImage
          .replace(/#ffffff/g, colors.active)
          .replace(/#ffffff8a/g, `${colors.primary}`),
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent'
      };
    } else {
      return {
        color: colors.primary
      };
    }
  }

  // 非当前播放的歌词，使用普通颜色
  return {
    color: colors.primary
  };
};

// 逐字歌词样式函数
const getWordStyle = (lineIndex: number, _wordIndex: number, word: any) => {
  const colors = textColors.value || getTextColors();
  // 如果不是当前行，返回普通样式
  if (lineIndex !== nowIndex.value) {
    return {
      color: colors.primary,
      transition: 'color 0.3s ease',
      // 重置背景相关属性
      backgroundImage: 'none',
      WebkitTextFillColor: 'initial'
    };
  }

  // 当前行的逐字效果，应用歌词矫正时间
  const currentTime = (nowTime.value + correctionTime.value) * 1000; // 转换为毫秒，确保与word时间单位一致

  // 直接使用绝对时间比较
  const wordStartTime = word.startTime; // 单词开始的绝对时间（毫秒）
  const wordEndTime = word.startTime + word.duration;

  if (currentTime >= wordStartTime && currentTime < wordEndTime) {
    // 当前正在播放的单词 - 使用渐变进度效果
    const progress = Math.min((currentTime - wordStartTime) / word.duration, 1);
    const progressPercent = Math.round(progress * 100);

    return {
      backgroundImage: `linear-gradient(to right, ${colors.active} 0%, ${colors.active} ${progressPercent}%, ${colors.primary} ${progressPercent}%, ${colors.primary} 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: `0 0 8px ${colors.active}40`,
      transition: 'all 0.1s ease'
    };
  } else if (currentTime >= wordEndTime) {
    // 已经播放过的单词 - 纯色显示
    return {
      color: colors.active,
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  } else {
    // 还未播放的单词 - 普通状态
    return {
      color: colors.primary,
      WebkitTextFillColor: 'initial',
      transition: 'none'
    };
  }
};

// 组件卸载时清理动画
onBeforeUnmount(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
  }
});

const { navigateToArtist } = useArtist();

const handleArtistClick = (id: number) => {
  isVisible.value = false;
  navigateToArtist(id);
};

const setData = computed(() => settingsStore.setData);

// 监听字体变化并更新 CSS 变量
watch(
  () => [setData.value.fontFamily, setData.value.fontScope],
  ([newFont, fontScope]) => {
    const defaultFonts =
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    // 如果不是歌词模式或全局模式，使用默认字体
    if (fontScope !== 'lyric' && fontScope !== 'global') {
      document.documentElement.style.setProperty('--current-font-family', defaultFonts);
      return;
    }

    if (newFont === 'system-ui') {
      document.documentElement.style.setProperty('--current-font-family', defaultFonts);
    } else {
      // 处理多个字体，确保每个字体名都被正确引用
      const fontList = newFont.split(',').map((font) => {
        const trimmedFont = font.trim();
        // 如果字体名包含空格或特殊字符，添加引号（如果还没有引号的话）
        return /[\s'"()]/.test(trimmedFont) && !/^['"].*['"]$/.test(trimmedFont)
          ? `"${trimmedFont}"`
          : trimmedFont;
      });

      // 将选择的字体和默认字体组合
      document.documentElement.style.setProperty(
        '--current-font-family',
        `${fontList.join(', ')}, ${defaultFonts}`
      );
    }
  },
  { immediate: true }
);

// 监听滚动事件
const handleScroll = () => {
  if (!lrcSider.value || !config.value.hideCover) return;
  const { scrollTop } = lrcSider.value.$el;
  showStickyHeader.value = scrollTop > 100;
};

const playerStore = usePlayerStore();
const lyricStore = useLyricStore();

const handleSelectLyricCandidate = (key: string) => {
  const candidate = lyricStore.selectCandidate(key);
  if (!candidate) return;
  playerStore.playMusic = {
    ...playerStore.playMusic,
    lyric: candidate.lyric
  };
  nextTick(() => {
    lrcScroll('instant');
  });
};

const handleRefreshLyricCandidates = async () => {
  if (!playerStore.playMusic?.id || lyricStore.loading) return;
  lyricStore.setLoading(true);
  lyricStore.setErrorMessage('');
  try {
    const result = await loadLyricCandidates({ ...playerStore.playMusic });
    lyricStore.setCandidateResult(result);
    if (result.activeCandidate) {
      playerStore.playMusic = {
        ...playerStore.playMusic,
        lyric: result.activeCandidate.lyric
      };
    }
  } catch (error) {
    console.warn('手动刷新歌词候选失败:', error);
    lyricStore.setErrorMessage('歌词暂时没匹配到，可以稍后再试');
  } finally {
    lyricStore.setLoading(false);
  }
};

const closeMusicFull = () => {
  // 退出全屏模式
  if (isFullScreen.value && document.fullscreenElement) {
    document.exitFullscreen();
  }
  isVisible.value = false;
  playerStore.setMusicFull(false);
};

// 全屏切换方法
const toggleFullScreen = async () => {
  try {
    if (!document.fullscreenElement) {
      // 进入全屏
      await document.documentElement.requestFullscreen();
      isFullScreen.value = true;
    } else {
      // 退出全屏
      await document.exitFullscreen();
      isFullScreen.value = false;
    }
  } catch (error) {
    console.error('全屏切换失败:', error);
  }
};

// 监听全屏状态变化
const handleFullScreenChange = () => {
  isFullScreen.value = !!document.fullscreenElement;
};

// 添加滚动监听和全屏状态监听
onMounted(() => {
  if (lrcSider.value?.$el) {
    lrcSider.value.$el.addEventListener('scroll', handleScroll);
  }
  document.addEventListener('fullscreenchange', handleFullScreenChange);
});

// 移除滚动监听和全屏状态监听
onBeforeUnmount(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
  }
  if (lrcSider.value?.$el) {
    lrcSider.value.$el.removeEventListener('scroll', handleScroll);
  }
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  // 退出全屏模式
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});

// 监听字体大小变化
watch(
  () => config.value.fontSize,
  (newSize) => {
    document.documentElement.style.setProperty('--lyric-font-size', `${newSize}px`);
  }
);

// 监听字体粗细变化
watch(
  () => config.value.fontWeight,
  (newWeight) => {
    document.documentElement.style.setProperty('--lyric-font-weight', newWeight.toString());
  }
);

// 添加文字间距监听
watch(
  () => config.value.letterSpacing,
  (newSpacing) => {
    document.documentElement.style.setProperty('--lyric-letter-spacing', `${newSpacing}px`);
  }
);

// 添加行高监听
watch(
  () => config.value.lineHeight,
  (newLineHeight) => {
    document.documentElement.style.setProperty('--lyric-line-height', newLineHeight.toString());
  }
);

// 加载保存的配置
onMounted(() => {
  const savedConfig = localStorage.getItem('music-full-config');
  if (savedConfig) {
    config.value = { ...config.value, ...JSON.parse(savedConfig) };
  }
  if (lrcSider.value?.$el) {
    lrcSider.value.$el.addEventListener('scroll', handleScroll);
  }
});

// 添加对 playMusic.id 的监听，歌曲切换时滚动到顶部
watch(
  () => playMusic.value.id,
  (newId, oldId) => {
    // 只在歌曲真正切换时滚动到顶部
    if (newId !== oldId && newId) {
      isSongChanging.value = true;
      // 延迟滚动，确保 nowIndex 已重置
      setTimeout(() => {
        lrcScroll('instant', true);
        // 延迟恢复自动滚动，等待歌词数据更新
        setTimeout(() => {
          isSongChanging.value = false;
        }, 300);
      }, 100);
    }
  }
);

defineExpose({
  lrcScroll,
  config
});
</script>

<style scoped lang="scss">
.background-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
  transition: background-image 0.8s ease-in-out;
}

.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  transition: background-color 0.8s ease-in-out;
}

.dark-overlay {
  background-color: rgba(0, 0, 0, 0.65);
}

.light-overlay {
  background-color: rgba(255, 255, 255, 0.55);
}

.bottom-controls {
  @apply w-full flex-shrink-0 mt-8;
  height: 100px;
  z-index: 10;
  transition: opacity 0.3s ease;

  &.pure-mode {
    opacity: 0;
    pointer-events: none;
    &:hover {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.full-width-play-bar {
  width: 100% !important;
  max-width: 100% !important;
}

@keyframes round {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.background-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.drawer-back {
  @apply absolute bg-cover bg-center;
  z-index: -1;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
}

.drawer-back.paused {
  animation-play-state: paused;
}

#drawer-target {
  @apply top-0 left-0 absolute overflow-hidden rounded w-full h-full;
  animation-duration: 300ms;
  /* 移除原本的渐变背景，完全依赖 background-layer */
  background: transparent;

  .player-layout-container {
    @apply mx-auto h-full flex flex-col;
    max-width: 1360px;
    padding: 2.6rem 3rem 1.5rem;
    transition: width 0.3s ease;
  }

  .content-wrapper {
    @apply grid items-center flex-1;
    grid-template-columns: minmax(300px, 40%) 1fr;
    gap: 3.2rem;
    min-height: 0; /* 允许内部滚动区域正常工作 */

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
      gap: 2rem;
    }
  }

  .left-side {
    @apply flex flex-col items-center justify-center h-full;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;

    &.only-cover {
      @apply col-span-2;

      .vinyl-stage {
        height: min(66vh, 560px) !important;
      }

      .vinyl-cd-container {
        width: 60vh !important;
        height: 60vh !important;
      }

      .music-info {
        @apply max-w-[800px];
      }
    }

    .vinyl-stage {
      /* 固定黑胶舞台高度，避免歌曲名/歌手名行数变化把唱片整体顶高或压低。 */
      width: 100%;
      height: min(52vh, 470px);
      min-height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .vinyl-cd-container {
      position: relative;
      width: min(46vh, 420px);
      height: min(46vh, 420px);
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      aspect-ratio: 1;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: scale(1.02);
      }
    }

    .music-info {
      @apply w-full text-center max-w-[400px];
      height: 96px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      flex-shrink: 0;
      margin-top: 12px;

      .music-content-name {
        @apply mb-2 line-clamp-2;
        color: var(--qqm-text, var(--text-color-active));
        font-size: 26px;
        font-weight: 650;
        line-height: 1.25;
        letter-spacing: -0.03em;
        min-height: 32px;
      }

      .music-content-singer {
        font-size: 15px;
        font-weight: 500;
        opacity: 0.78;
        color: var(--qqm-muted, var(--text-color-primary));
        min-height: 22px;
      }
    }
  }

  .right-side {
    @apply flex flex-col justify-center h-full relative overflow-hidden;

    &.full-width {
      @apply col-span-2;
    }

    &.center {
      .music-lrc {
        @apply w-full mx-auto text-center;
      }

      .music-lrc-text {
        @apply text-center;
        transform-origin: center center;
      }

      .word-by-word-lyric {
        @apply justify-center;
      }
    }

    &.hide {
      @apply hidden;
    }

    .music-lrc {
      @apply w-full h-full;
      border-radius: 0;
      background: transparent !important;
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 15%,
        black 85%,
        transparent 100%
      );
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 15%,
        black 85%,
        transparent 100%
      );

      .music-info-header {
        @apply mb-8;

        .music-info-name {
          @apply text-4xl font-bold mb-2 line-clamp-2;
          color: var(--text-color-active);
        }

        .music-info-singer {
          @apply text-xl opacity-80;
          color: var(--text-color-primary);
        }
      }
    }

    .music-lrc-container {
      padding: 50vh 0;
      min-height: 100%;
    }

    .music-lrc-text {
      @apply cursor-pointer px-4 py-2;
      font-family: var(--current-font-family);
      font-weight: var(--lyric-font-weight, 600) !important;
      transition:
        opacity 0.3s ease,
        color 0.3s ease,
        transform 0.3s ease;
      background-color: transparent;
      font-size: var(--lyric-font-size, 22px) !important;
      letter-spacing: var(--lyric-letter-spacing, 0) !important;
      line-height: var(--lyric-line-height, 1.82) !important;
      opacity: 0.6;
      transform-origin: left center;

      &.now-text {
        opacity: 1;
        transform: scale(1.1);
        text-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }

      &.no-scroll-tip {
        @apply text-base opacity-60 cursor-default py-2;
        color: var(--text-color-primary);
        font-weight: normal;

        span {
          padding-right: 0;
        }

        &:hover {
          background-color: transparent;
        }
      }

      span {
        background-clip: text !important;
        -webkit-background-clip: text !important;
        padding-right: 30px;
      }

      &-tr {
        @apply font-normal;
        opacity: 0.7;
        color: var(--text-color-primary);
      }

      // 逐字歌词样式
      .word-by-word-lyric {
        @apply flex flex-wrap;

        .lyric-word {
          @apply inline-block;
          padding-right: 0;
          font-weight: inherit;
          font-size: inherit;
          letter-spacing: inherit;
          line-height: inherit;
          cursor: inherit;
          position: relative;

          &:hover {
            background-color: rgba(255, 255, 255, 0.1);
          }
        }
      }
    }

    .hover-text {
      &:hover {
        @apply opacity-100 rounded-lg;
        font-weight: 650;
        background-color: var(--hover-bg-color);

        span {
          color: var(--text-color-active) !important;
        }
      }
    }
  }
}

.mobile {
  #drawer-target {
    @apply p-4 pt-8;

    .content-wrapper {
      @apply flex-col justify-start p-0;
    }

    .music-img {
      display: none;
    }

    .music-lrc {
      height: calc(100vh - 260px) !important;
      width: 100vw;

      span {
        padding-right: 0px !important;
      }

      .hover-text {
        &:hover {
          background-color: transparent;
        }
      }

      .music-lrc-text {
        @apply text-xl text-center;
      }
    }

    .music-content {
      @apply h-[calc(100vh-120px)];
      width: 100vw !important;
    }
  }
}

.music-drawer {
  transition: none; // 移除之前的过渡效果，现在使用 JS 动画
}

// 添加全局字体样式
// 字体设置已移至上方或不再需要单独的 drawer-target 块
:root {
  --current-font-family:
    system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
}

.close-btn {
  opacity: 0.3;
  transition: opacity 0.18s ease;

  &:hover {
    opacity: 1;
  }
}

.control-left,
.control-right {
  &.pure-mode {
    @apply pointer-events-auto;

    .control-btn {
      @apply opacity-0 transition-opacity duration-200;
      pointer-events: none;
    }

    &:hover .control-btn {
      @apply opacity-100;
      pointer-events: auto;
    }
  }

  &:not(.pure-mode) .control-btn {
    pointer-events: auto;
  }
}

.control-right {
  @apply flex items-center gap-2;
}

.control-btn {
  @apply w-9 h-9 flex items-center justify-center cursor-pointer;
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 82%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--qqm-surface, #fff) 72%, transparent);
  backdrop-filter: blur(14px) saturate(1.1);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;

  i {
    @apply text-xl;
    color: var(--qqm-text, var(--text-color-active));
  }

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #fff));
    transform: translateY(-1px);

    i {
      opacity: 1;
    }
  }

  &.loading i {
    animation: lyric-source-spin 1s linear infinite;
  }
}

@keyframes lyric-source-spin {
  to {
    transform: rotate(360deg);
  }
}

.lyric-correction {
  .music-lrc:hover & {
    opacity: 1 !important;
    pointer-events: auto !important;
  }
}

/* Vinyl CD & Tonearm Styles */
.tonearm-wrapper {
  position: absolute;
  top: -10%;
  left: 56%;
  width: 19%;
  height: 30%;
  z-index: 10;
  transform-origin: 50% 13%;
  transform: rotate(-32deg);
  transition: transform 0.9s cubic-bezier(0.25, 1, 0.2, 1);
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
}

.tonearm-wrapper.playing {
  transform: rotate(-2deg);
}

.tonearm-svg {
  width: 100%;
  height: 100%;
}

.vinyl-disc-outer {
  width: 94%;
  height: 94%;
  border-radius: 9999px;
  padding: 5px;
  background: linear-gradient(135deg, #1f1f1f 0%, #000000 100%);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.5),
    0 0 40px var(--hover-bg-color),
    inset 0 1.5px 3px rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vinyl-disc {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: radial-gradient(
    circle,
    #202020 30%,
    #0c0c0c 38%,
    #141414 40%,
    #0a0a0a 55%,
    #181818 57%,
    #020202 68%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 16px rgba(0, 0, 0, 0.85);
  animation: spin-cd 18s linear infinite;
  animation-play-state: paused;
}

.vinyl-disc.playing {
  animation-play-state: running;
}

.vinyl-shine {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: conic-gradient(
    from 90deg at 50% 50%,
    transparent 0%,
    rgba(255, 255, 255, 0.05) 12%,
    transparent 24%,
    transparent 50%,
    rgba(255, 255, 255, 0.05) 62%,
    transparent 74%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 2;
}

.vinyl-cover-wrap {
  position: relative;
  width: 54%;
  height: 54%;
  border-radius: 9999px;
  overflow: hidden;
  background: radial-gradient(circle, #111 0%, #030303 68%);
  border: 4px solid #0d0d0d;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 0 18px rgba(0, 0, 0, 0.72);
}

.vinyl-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 9999px;
  transform: translateZ(0);
}

.vinyl-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: rgba(255, 255, 255, 0.42);
  background:
    conic-gradient(
      from 35deg,
      rgba(255, 255, 255, 0.06),
      transparent 18%,
      rgba(255, 255, 255, 0.035) 42%,
      transparent 70%
    ),
    radial-gradient(circle, #050505 0%, #000 72%);
}

.vinyl-cover-fallback i {
  font-size: 42px;
  opacity: 0.7;
}

.vinyl-center-hole {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: var(--qqm-bg, #f7f8fa);
  border: 3px solid #1a1a1a;
  z-index: 3;
  box-shadow: inset 0 1px 1.5px rgba(0, 0, 0, 0.65);
}

.dark .vinyl-center-hole {
  background: var(--qqm-bg, #111315);
}

@keyframes spin-cd {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
