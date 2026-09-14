<script setup lang="ts">
import { computed } from 'vue';

import {
  getLyricThemeColors,
  getPresetColorValue,
  optimizeColorForTheme
} from '@/utils/linearColor';

const props = defineProps<{
  visible: boolean;
  songName: string;
  isPlaying: boolean;
  hasSong: boolean;
  locked: boolean;
  settingsOpen: boolean;
  fontSize: number;
  theme: 'light' | 'dark';
  displayMode: 'single' | 'double' | 'scroll';
  color: string;
  showTranslation: boolean;
  hasTranslation: boolean;
}>();

const emit = defineEmits<{
  control: [action: 'prev' | 'playpause' | 'next'];
  lock: [];
  close: [];
  settings: [];
  fontSize: [delta: number];
  theme: [theme: 'light' | 'dark'];
  displayMode: [mode: 'single' | 'double' | 'scroll'];
  color: [color: string];
  translation: [];
}>();

const modes = [
  { value: 'single', label: '单行' },
  { value: 'double', label: '双行' },
  { value: 'scroll', label: '滚动' }
] as const;
const colorNames = ['清新绿', '天空蓝', '珊瑚红', '暖橙', '浅紫', '樱花粉'];
const colors = computed(() =>
  getLyricThemeColors().map((color, index) => ({
    raw: getPresetColorValue(color.id, props.theme),
    value: optimizeColorForTheme(getPresetColorValue(color.id, props.theme), props.theme),
    label: colorNames[index]
  }))
);
</script>

<template>
  <div
    class="desktop-lyric-toolbar"
    :class="{ 'is-visible': visible, 'is-locked': locked, 'is-light': theme === 'light' }"
  >
    <div v-if="!locked" class="lyric-toolbar-row">
      <div class="lyric-song" :title="songName || '拖动歌词可调整位置'">
        <i class="ri-draggable lyric-grip" aria-hidden="true" />
        <img class="lyric-logo" src="@/assets/logo.png" alt="" />
        <span>{{ songName || '桌面歌词' }}</span>
      </div>
      <div class="lyric-play-actions">
        <button
          class="lyric-tool"
          type="button"
          title="上一首"
          aria-label="上一首"
          :disabled="!hasSong"
          @click="emit('control', 'prev')"
        >
          <i class="ri-skip-back-fill" aria-hidden="true" />
        </button>
        <button
          class="lyric-tool lyric-play"
          type="button"
          :title="isPlaying ? '暂停' : '播放'"
          :aria-label="isPlaying ? '暂停' : '播放'"
          :disabled="!hasSong"
          @click="emit('control', 'playpause')"
        >
          <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'" aria-hidden="true" />
        </button>
        <button
          class="lyric-tool"
          type="button"
          title="下一首"
          aria-label="下一首"
          :disabled="!hasSong"
          @click="emit('control', 'next')"
        >
          <i class="ri-skip-forward-fill" aria-hidden="true" />
        </button>
      </div>
      <span class="lyric-toolbar-divider" aria-hidden="true" />
      <div class="lyric-window-actions">
        <button
          class="lyric-tool"
          :class="{ selected: settingsOpen }"
          type="button"
          title="歌词设置"
          aria-label="歌词设置"
          :aria-expanded="settingsOpen"
          aria-controls="desktop-lyric-settings"
          @click="emit('settings')"
        >
          <i class="ri-equalizer-line" aria-hidden="true" />
        </button>
        <button
          id="lyric-lock"
          class="lyric-tool"
          type="button"
          title="锁定歌词，鼠标可穿透"
          aria-label="锁定歌词"
          @click="emit('lock')"
        >
          <i class="ri-lock-unlock-line" aria-hidden="true" />
        </button>
        <button
          class="lyric-tool lyric-close"
          type="button"
          title="关闭桌面歌词"
          aria-label="关闭桌面歌词"
          @click="emit('close')"
        >
          <i class="ri-close-line" aria-hidden="true" />
        </button>
      </div>
    </div>
    <button
      v-else
      id="lyric-lock"
      class="lyric-unlock"
      type="button"
      title="解锁歌词"
      aria-label="解锁歌词"
      @click="emit('lock')"
    >
      <i class="ri-lock-line" aria-hidden="true" /> 解锁
    </button>

    <section
      v-if="settingsOpen && !locked"
      id="desktop-lyric-settings"
      class="lyric-settings"
      aria-label="歌词外观设置"
    >
      <div class="lyric-settings-row">
        <div class="lyric-option-group">
          <span class="lyric-option-label">显示</span>
          <div class="lyric-segmented" role="group" aria-label="歌词显示模式">
            <button
              v-for="mode in modes"
              :key="mode.value"
              class="lyric-option"
              :class="{ selected: displayMode === mode.value }"
              type="button"
              :aria-pressed="displayMode === mode.value"
              @click="emit('displayMode', mode.value)"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>
        <div class="lyric-option-group">
          <span class="lyric-option-label">字号</span>
          <button
            class="lyric-tool small"
            type="button"
            title="缩小字号"
            aria-label="缩小字号"
            :disabled="fontSize <= 12"
            @click="emit('fontSize', -2)"
          >
            <i class="ri-subtract-line" aria-hidden="true" />
          </button>
          <output class="lyric-font-size" aria-label="当前字号">{{ fontSize }}</output>
          <button
            class="lyric-tool small"
            type="button"
            title="放大字号"
            aria-label="放大字号"
            :disabled="fontSize >= 48"
            @click="emit('fontSize', 2)"
          >
            <i class="ri-add-line" aria-hidden="true" />
          </button>
        </div>
        <button
          class="lyric-option lyric-translation-toggle"
          :class="{ selected: showTranslation && hasTranslation }"
          type="button"
          :disabled="!hasTranslation"
          :title="hasTranslation ? '显示或隐藏翻译' : '当前歌词暂无翻译'"
          :aria-pressed="showTranslation && hasTranslation"
          @click="emit('translation')"
        >
          <i class="ri-translate-2" aria-hidden="true" /> 翻译
        </button>
      </div>
      <div class="lyric-settings-row">
        <div class="lyric-option-group">
          <span class="lyric-option-label">桌面</span>
          <div class="lyric-segmented" role="group" aria-label="适配桌面背景">
            <button
              class="lyric-option"
              :class="{ selected: theme === 'dark' }"
              type="button"
              :aria-pressed="theme === 'dark'"
              title="深色桌面使用浅色歌词"
              @click="emit('theme', 'dark')"
            >
              深色
            </button>
            <button
              class="lyric-option"
              :class="{ selected: theme === 'light' }"
              type="button"
              :aria-pressed="theme === 'light'"
              title="浅色桌面使用深色歌词"
              @click="emit('theme', 'light')"
            >
              浅色
            </button>
          </div>
        </div>
        <div class="lyric-option-group lyric-colors" role="group" aria-label="高亮颜色">
          <span class="lyric-option-label">高亮</span>
          <button
            v-for="preset in colors"
            :key="preset.label"
            class="lyric-color"
            type="button"
            :style="{ '--swatch': preset.value }"
            :title="preset.label"
            :aria-label="preset.label"
            :aria-pressed="color.toLowerCase() === preset.value.toLowerCase()"
            @click="emit('color', preset.raw)"
          />
          <label class="lyric-custom-color" title="自定义高亮颜色">
            <i class="ri-palette-line" aria-hidden="true" />
            <input
              type="color"
              aria-label="自定义高亮颜色"
              :value="color"
              @input="emit('color', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.desktop-lyric-toolbar {
  --glass-surface: rgb(249 253 250 / 15%);
  --glass-panel: rgb(29 43 35 / 58%);
  --glass-text: #f2f8f4;
  --glass-muted: #cfddd3;
  --glass-control: rgb(241 251 245 / 10%);
  --glass-hover: rgb(243 255 247 / 19%);
  --glass-selected: rgb(103 233 162 / 18%);
  --glass-accent: #9aebbc;
  position: absolute;
  top: 10px;
  left: 50%;
  z-index: 3;
  width: min(520px, calc(100% - 32px));
  transform: translateX(-50%);
  color: var(--glass-text);
  font:
    13px/1.4 'Microsoft YaHei UI',
    'PingFang SC',
    sans-serif;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 160ms ease,
    visibility 160ms ease;
}
.desktop-lyric-toolbar.is-light {
  --glass-surface: rgb(250 253 251 / 42%);
  --glass-panel: rgb(245 251 247 / 68%);
  --glass-text: #253c2f;
  --glass-muted: #4e6859;
  --glass-control: rgb(46 81 59 / 7%);
  --glass-hover: rgb(34 79 50 / 11%);
  --glass-selected: rgb(45 170 100 / 14%);
  --glass-accent: #096d3c;
}
.desktop-lyric-toolbar.is-visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
.lyric-toolbar-row,
.lyric-settings,
.lyric-unlock {
  background: var(--glass-surface);
  backdrop-filter: blur(18px) saturate(125%);
  -webkit-backdrop-filter: blur(18px) saturate(125%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 20%),
    0 3px 12px rgb(8 25 16 / 12%);
}
.lyric-toolbar-row {
  display: flex;
  align-items: center;
  height: 42px;
  gap: 9px;
  padding: 5px 9px;
  border-radius: 14px;
}
.lyric-song {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
  cursor: grab;
}
.lyric-song span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.lyric-grip {
  color: var(--glass-muted);
  font-size: 16px;
}
.lyric-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.lyric-play-actions,
.lyric-window-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}
.lyric-tool,
.lyric-option,
.lyric-color,
.lyric-unlock {
  border: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.lyric-tool {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  font-size: 17px;
  transition:
    background 140ms ease,
    color 140ms ease;
}
.lyric-tool:hover {
  background: var(--glass-hover);
}
.lyric-tool.lyric-play {
  color: var(--glass-accent);
  background: var(--glass-selected);
  border-radius: 50%;
  font-size: 21px;
}
.lyric-tool.lyric-play:hover {
  background: var(--glass-hover);
}
.lyric-tool.lyric-close:hover {
  background: #fbe8e6;
  color: #b74339;
}
.lyric-toolbar-divider {
  height: 17px;
  width: 1px;
  background: var(--glass-control);
}
.lyric-settings {
  background: var(--glass-panel);
  margin-top: 8px;
  padding: 10px 14px;
  border-radius: 14px;
}
.lyric-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.lyric-settings-row + .lyric-settings-row {
  margin-top: 10px;
}
.lyric-option-group {
  display: flex;
  align-items: center;
  gap: 7px;
}
.lyric-option-label {
  color: var(--glass-muted);
  font-size: 12px;
  white-space: nowrap;
}
.lyric-segmented {
  display: flex;
  padding: 2px;
  gap: 2px;
  border-radius: 7px;
  background: var(--glass-control);
}
.lyric-option {
  padding: 5px 8px;
  border-radius: 5px;
  background: transparent;
  font-size: 12px;
  white-space: nowrap;
}
.lyric-option:hover {
  background: var(--glass-hover);
}
.lyric-option.selected,
.lyric-tool.selected {
  color: var(--glass-accent);
  background: var(--glass-selected);
}
.lyric-font-size {
  min-width: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
.lyric-tool.small {
  width: 25px;
  height: 25px;
  background: var(--glass-control);
  font-size: 14px;
}
.lyric-colors {
  gap: 6px;
}
.lyric-color {
  width: 24px;
  height: 24px;
  padding: 4px;
  background: var(--swatch);
  background-clip: content-box;
  border-radius: 50%;
}
.lyric-color:hover,
.lyric-color[aria-pressed='true'] {
  box-shadow: inset 0 0 0 1.5px var(--swatch);
}
.lyric-custom-color {
  position: relative;
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 6px;
  background: var(--glass-control);
}
.lyric-custom-color input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.lyric-tool:disabled,
.lyric-option:disabled {
  opacity: 0.4;
  cursor: default;
}
.lyric-tool:focus-visible,
.lyric-option:focus-visible,
.lyric-color:focus-visible,
.lyric-unlock:focus-visible,
.lyric-custom-color:focus-within {
  outline: 2px solid #11985b;
  outline-offset: 2px;
}
.is-locked {
  width: auto;
}
.lyric-unlock {
  display: flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
}
@media (max-width: 540px) {
  .lyric-toolbar-row {
    gap: 5px;
  }
  .lyric-grip {
    display: none;
  }
  .lyric-settings {
    padding: 8px 10px;
  }
  .lyric-settings-row {
    gap: 5px;
  }
  .lyric-option-group {
    gap: 4px;
  }
  .lyric-option {
    padding-inline: 6px;
  }
  .lyric-colors {
    gap: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .desktop-lyric-toolbar,
  .lyric-tool {
    transition: none;
  }
}
</style>
