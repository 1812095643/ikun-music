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
    <!-- 遮罩与歌词共用局部主题，封面的明暗不再反转文字颜色。 -->
    <div class="background-overlay" :class="isLightPlayer ? 'light-overlay' : 'dark-overlay'"></div>
    <div id="drawer-target" :class="[config.theme]" class="relative z-10" :style="playerStyle">
      <!-- 左侧关闭按钮 -->
      <div
        class="control-left absolute top-8 left-8 z-[9999]"
        :class="{ 'pure-mode': config.pureModeEnabled }"
      >
        <button
          class="control-btn"
          type="button"
          title="收起播放器"
          aria-label="收起播放器"
          @click="closeMusicFull"
        >
          <i class="ri-arrow-down-s-line"></i>
        </button>
      </div>

      <!-- 右侧功能按钮组 -->
      <div
        class="control-right absolute top-8 right-8 z-[9999]"
        :class="{ 'pure-mode': config.pureModeEnabled }"
      >
        <n-popover trigger="click" placement="bottom" raw>
          <template #trigger>
            <button
              class="control-btn"
              type="button"
              title="切换歌词来源"
              aria-label="切换歌词来源"
              :class="{ loading: lyricStore.loading }"
            >
              <i class="ri-file-list-3-line"></i>
            </button>
          </template>
          <lyric-source-selector
            :song-name="playerStore.playMusic.name"
            :artist="playerStore.playMusic.ar?.map((artist) => artist.name).join(' / ')"
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
            <button class="control-btn" type="button" title="歌词设置" aria-label="歌词设置">
              <i class="ri-settings-3-line"></i>
            </button>
          </template>
          <lyric-settings ref="lyricSettingsRef" />
        </n-popover>

        <button
          class="control-btn"
          type="button"
          title="精简模式"
          aria-label="精简模式"
          @click="window.desktop.miniWindow()"
        >
          <i class="ri-picture-in-picture-line" />
        </button>
        <button
          class="control-btn"
          type="button"
          title="桌面歌词"
          aria-label="桌面歌词"
          @click="openLyric()"
        >
          <i class="ri-text" />
        </button>
        <button
          class="control-btn"
          type="button"
          :title="isFullScreen ? '退出全屏' : '全屏'"
          :aria-label="isFullScreen ? '退出全屏' : '全屏'"
          @click="toggleFullScreen"
        >
          <i :class="isFullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
        </button>
      </div>

      <div
        class="player-layout-container"
        :style="{ width: `min(100%, max(${config.contentWidth}%, 900px))` }"
      >
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
                        v-if="loadedArtwork && !vinylCoverLoadFailed"
                        :src="loadedArtwork"
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
              <div class="music-content-name">{{ playMusic.name }}</div>
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
              <button
                v-if="artworkStatus === 'error'"
                type="button"
                class="artwork-retry"
                @click="retryArtwork"
              >
                封面暂未加载 · 重试
              </button>
              <button
                v-if="customArtworkStatus === 'error'"
                type="button"
                class="artwork-retry"
                @click="retryCustomArtwork"
              >
                背景暂未加载 · 重试
              </button>
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
              @wheel.passive="pauseLyricFollow"
              @touchstart.passive="pauseLyricFollow"
            >
              <!-- 歌曲信息 -->
              <div class="music-lrc-container">
                <div
                  v-if="config.hideCover"
                  class="music-info-header"
                  :style="{ textAlign: config.centerLyrics ? 'center' : 'left' }"
                >
                  <div class="music-info-name">{{ playMusic.name }}</div>
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
                  v-memo="[
                    item,
                    index === nowIndex,
                    index === nowIndex ? nowTime : -1,
                    correctionTime,
                    config.showTranslation,
                    lyricColors
                  ]"
                  :id="`music-lrc-text-${index}`"
                  :key="index"
                  class="music-lrc-text"
                  :class="{
                    'now-text': index === nowIndex,
                    'hover-text': item.text && item.startTime !== -1
                  }"
                  :role="item.startTime !== -1 ? 'button' : undefined"
                  :tabindex="item.startTime !== -1 ? 0 : undefined"
                  :aria-current="index === nowIndex ? 'true' : undefined"
                  @click="seekLyricLine(index)"
                  @keydown.enter.prevent="seekLyricLine(index)"
                  @keydown.space.prevent="seekLyricLine(index)"
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
            <button
              v-if="isMouse"
              type="button"
              class="resume-lyric-follow"
              @click="resumeLyricFollow"
            >
              回到当前歌词 <i class="ri-focus-3-line" aria-hidden="true" />
            </button>
          </div>
        </div>
        <!-- End of content-wrapper -->

        <!-- 底部控制栏 -->
        <div class="bottom-controls" :class="{ 'pure-mode': config.pureModeEnabled }">
          <simple-play-bar
            v-if="!config.hideMiniPlayBar"
            :pure-mode-enabled="config.pureModeEnabled"
            :isDark="lyricColors.theme === 'dark'"
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
  openLyric,
  playMusic,
  setAudioTime
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useLyricSelection } from '@/hooks/useLyricSelection';
import { usePlayerArtwork } from '@/hooks/usePlayerArtwork';
import { useLyricStore } from '@/store/modules/lyric';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { DEFAULT_LYRIC_CONFIG, LyricConfig } from '@/types/lyric';
import { getImgUrl, isMobile } from '@/utils';

const { t } = useI18n();
// 定义 refs
const lrcSider = ref<any>(null);
const isMouse = ref(false);
const window = globalThis.window;
// 文字、主题与用户字号都限定在播放器内，避免浅色首页的黑字覆盖沉浸页。
const playerStyle = computed(() => ({
  '--qqm-text': isLightPlayer.value ? '#202724' : '#f4f7f6',
  '--qqm-muted': lyricColors.value.primary,
  '--text-color-primary': lyricColors.value.primary,
  '--text-color-active': lyricColors.value.active,
  '--hover-bg-color': isLightPlayer.value ? 'rgba(20, 40, 27, 0.05)' : 'rgba(230, 255, 237, 0.06)',
  '--lyric-font-size': `${config.value.fontSize}px`,
  '--lyric-font-weight': String(config.value.fontWeight),
  '--lyric-letter-spacing': `${config.value.letterSpacing}px`,
  '--lyric-line-height': String(config.value.lineHeight)
}));

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

// 图片加载前、超时或失败时始终有确定的底色，不把透明背景透到首页。
const drawerBaseStyle = computed(() => ({
  background:
    config.value.useCustomBackground && config.value.backgroundMode !== 'image'
      ? customBackgroundStyle.value || playerBaseColor.value
      : playerBaseColor.value
}));
const dynamicBackgroundStyle = computed(() => ({
  backgroundImage: loadedBackground.value
    ? `url(${JSON.stringify(loadedBackground.value)})`
    : 'none',
  filter:
    config.value.useCustomBackground && config.value.backgroundMode === 'image'
      ? `blur(${config.value.imageBlur || 0}px) brightness(${config.value.imageBrightness ?? 100}%)`
      : 'blur(36px) saturate(115%)',
  transform: 'scale(1.12)'
}));
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

const emit = defineEmits(['update:modelValue']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const settingsStore = useSettingsStore();
const isLightPlayer = computed(
  () =>
    config.value.theme === 'light' ||
    (config.value.theme === 'default' && settingsStore.theme === 'light')
);
const playerBaseColor = computed(() => (isLightPlayer.value ? '#edf1ef' : '#141b18'));
// 根因：封面取色、首页主题和全屏歌词各自修改 document 根变量，容易出现白底白字或黑底黑字。
// 让遮罩和歌词使用同一份局部主题；封面只负责氛围，不再改变可读性颜色。
const lyricColors = computed(() => ({
  active: isLightPlayer.value ? '#17633e' : '#f2fff7',
  primary: isLightPlayer.value ? '#56645b' : '#b3c2b9',
  theme: isLightPlayer.value ? 'light' : 'dark'
}));
const artworkSource = computed(() =>
  isVisible.value
    ? getImgUrl(
        playMusic.value?.picUrl || playMusic.value?.al?.picUrl || playMusic.value?.album?.picUrl,
        '512y512'
      )
    : ''
);
const {
  loadedUrl: loadedArtwork,
  status: artworkStatus,
  retry: retryArtwork
} = usePlayerArtwork(artworkSource);
const customImageSource = computed(() =>
  isVisible.value && config.value.useCustomBackground && config.value.backgroundMode === 'image'
    ? config.value.backgroundImage || ''
    : ''
);
const {
  loadedUrl: loadedCustomBackground,
  status: customArtworkStatus,
  retry: retryCustomArtwork
} = usePlayerArtwork(customImageSource);
const loadedBackground = computed(() =>
  config.value.useCustomBackground
    ? config.value.backgroundMode === 'image'
      ? loadedCustomBackground.value
      : ''
    : loadedArtwork.value
);
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

  const nowEl = lrcSider.value.$el.querySelector(
    `#music-lrc-text-${nowIndex.value}`
  ) as HTMLElement;
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
// 抽屉异步挂载和歌词晚到都可能发生在 visible 的首个 nextTick 之后，
// 等滚动容器与歌词实际就绪再对齐，避免第一句停在视区底部。
watch(
  [lrcSider, () => lrcArray.value, () => config.value.fontSize, () => config.value.showTranslation],
  () => nextTick(() => lrcScroll('auto')),
  { flush: 'post' }
);

let followTimer: ReturnType<typeof setTimeout> | undefined;
const resumeLyricFollow = () => {
  clearTimeout(followTimer);
  isMouse.value = false;
  nextTick(() => lrcScroll());
};
const pauseLyricFollow = () => {
  // 根因：旧 mouseover 会让静止的鼠标永久阻止跟随。只在用户滚动时暂停，
  // 五秒后恢复，同时提供按钮立即回到当前行，歌词点击仍可直接跳转播放进度。
  isMouse.value = true;
  clearTimeout(followTimer);
  followTimer = setTimeout(resumeLyricFollow, 5000);
};
const seekLyricLine = (index: number) => {
  if (lrcArray.value[index]?.startTime === -1) return;
  setAudioTime(index);
  resumeLyricFollow();
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

// 普通 LRC 只有整行时间戳，不伪造逐字填色；当前行始终使用高对比度强调色。
const getLrcStyle = (index: number) => ({
  color: index === nowIndex.value ? lyricColors.value.active : lyricColors.value.primary
});
// 逐字歌词样式函数
const getWordStyle = (lineIndex: number, _wordIndex: number, word: any) => {
  const colors = lyricColors.value;
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
      transition: 'none'
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
  clearTimeout(followTimer);
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

const { selectLyric: handleSelectLyricCandidate, searchLyrics: handleRefreshLyricCandidates } =
  useLyricSelection();

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
  if (lrcSider.value?.$el) {
    lrcSider.value.$el.removeEventListener('scroll', handleScroll);
  }
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  // 退出全屏模式
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});

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
  background-color: rgba(10, 18, 14, 0.78);
}

.light-overlay {
  background-color: rgba(242, 246, 243, 0.88);
}

.bottom-controls {
  @apply w-full flex-shrink-0 mt-3;
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
    padding: 4.5rem clamp(20px, 3vw, 48px) 16px;
    transition: width 0.3s ease;
  }

  .content-wrapper {
    @apply grid items-center flex-1;
    grid-template-columns: minmax(220px, 42%) minmax(0, 1fr);
    gap: clamp(28px, 4vw, 64px);
    min-height: 0; /* 允许内部滚动区域正常工作 */

    @media (max-width: 1024px) {
      grid-template-columns: minmax(200px, 40%) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
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
      height: min(44vh, 380px);
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .vinyl-cd-container {
      position: relative;
      width: min(36vh, 340px);
      height: min(36vh, 340px);
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
      opacity: 1;
      transform-origin: left center;

      &.now-text {
        opacity: 1;
        transform: translateX(2px);
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
  box-shadow: inset 0 1px 1.5px rgba(10, 18, 14, 0.78);
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

.artwork-retry {
  font-size: 12px;
  color: var(--qqm-muted);
  margin-top: 10px;
  cursor: pointer;
}
#drawer-target {
  background: transparent !important;
}
#drawer-target .music-info,
#drawer-target .music-lrc {
  background: transparent !important;
  border: 0 !important;
}
/* 手动浏览歌词时只浮出一个恢复入口，不遮挡当前歌词和底部控制条。 */
.resume-lyric-follow {
  position: absolute;
  right: 16px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 18px;
  color: var(--qqm-text);
  background: color-mix(in srgb, var(--qqm-text) 12%, transparent);
  font-size: 12px;
  cursor: pointer;
}
#drawer-target button:focus-visible,
#drawer-target [role='button']:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 4px;
}
#drawer-target .music-lrc-text-tr {
  font-size: 0.62em !important;
  line-height: 1.6;
  margin-top: 2px;
}
@media (max-height: 720px) {
  #drawer-target .left-side .vinyl-stage {
    height: 32vh;
  }
  #drawer-target .left-side .vinyl-cd-container {
    width: 30vh;
    height: 30vh;
  }
  #drawer-target .left-side .music-info {
    height: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  #drawer-target *,
  .background-layer {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
</style>
