<template>
  <div class="lyric-settings-panel w-80 rounded-lg overflow-hidden">
    <!-- 标题栏 -->
    <div class="lyric-settings-header px-6 py-4">
      <h2 class="text-lg font-semibold tracking-tight text-white/90">
        {{ t('settings.lyricSettings.title') }}
      </h2>
    </div>

    <!-- 标签页导航 -->
    <div class="px-4 pt-3 pb-2">
      <div class="lyric-settings-tabs flex gap-1 p-1 rounded-lg">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="[
            'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
            activeTab === tab.key
              ? 'lyric-settings-tab-active text-white'
              : 'lyric-settings-tab-idle'
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div
      class="px-3 pb-3 max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
    >
      <!-- 显示设置 -->
      <div v-show="activeTab === 'display'" class="space-y-2 pt-2">
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.pureMode') }}</span>
          <input type="checkbox" v-model="config.pureModeEnabled" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.hideCover') }}</span>
          <input type="checkbox" v-model="config.hideCover" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.centerDisplay') }}</span>
          <input type="checkbox" v-model="config.centerLyrics" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.showTranslation') }}</span>
          <input type="checkbox" v-model="config.showTranslation" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.hideLyrics') }}</span>
          <input type="checkbox" v-model="config.hideLyrics" class="toggle-switch" />
        </div>
      </div>

      <!-- 界面设置 -->
      <div v-show="activeTab === 'interface'" class="space-y-4 pt-3">
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.showMiniPlayBar') }}</span>
          <input type="checkbox" v-model="showMiniPlayBar" class="toggle-switch" />
        </div>

        <div class="slider-group">
          <label class="slider-label">{{ t('settings.lyricSettings.contentWidth') }}</label>
          <input
            type="range"
            v-model.number="config.contentWidth"
            min="50"
            max="100"
            step="5"
            class="slider-primary"
          />
          <div class="slider-marks">
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <!-- 文字设置 -->
      <div v-show="activeTab === 'typography'" class="space-y-4 pt-3">
        <div class="slider-group">
          <label class="slider-label">{{ t('settings.lyricSettings.fontSize') }}</label>
          <input
            type="range"
            v-model.number="config.fontSize"
            min="12"
            max="32"
            step="1"
            class="slider-primary"
          />
          <div class="slider-marks">
            <span>{{ t('settings.lyricSettings.fontSizeMarks.small') }}</span>
            <span>{{ t('settings.lyricSettings.fontSizeMarks.medium') }}</span>
            <span>{{ t('settings.lyricSettings.fontSizeMarks.large') }}</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">{{ t('settings.lyricSettings.letterSpacing') }}</label>
          <input
            type="range"
            v-model.number="config.letterSpacing"
            min="-2"
            max="10"
            step="0.2"
            class="slider-primary"
          />
          <div class="slider-marks">
            <span>{{ t('settings.lyricSettings.letterSpacingMarks.compact') }}</span>
            <span>{{ t('settings.lyricSettings.letterSpacingMarks.default') }}</span>
            <span>{{ t('settings.lyricSettings.letterSpacingMarks.loose') }}</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">{{ t('settings.lyricSettings.fontWeight') }}</label>
          <input
            type="range"
            v-model.number="config.fontWeight"
            min="100"
            max="900"
            step="100"
            class="slider-primary"
          />
          <div class="slider-marks">
            <span>{{ t('settings.lyricSettings.fontWeightMarks.thin') }}</span>
            <span>{{ t('settings.lyricSettings.fontWeightMarks.normal') }}</span>
            <span>{{ t('settings.lyricSettings.fontWeightMarks.bold') }}</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">{{ t('settings.lyricSettings.lineHeight') }}</label>
          <input
            type="range"
            v-model.number="config.lineHeight"
            min="1"
            max="3"
            step="0.1"
            class="slider-primary"
          />
          <div class="slider-marks">
            <span>{{ t('settings.lyricSettings.lineHeightMarks.compact') }}</span>
            <span>{{ t('settings.lyricSettings.lineHeightMarks.default') }}</span>
            <span>{{ t('settings.lyricSettings.lineHeightMarks.loose') }}</span>
          </div>
        </div>
      </div>

      <!-- 背景设置 -->
      <div v-show="activeTab === 'background'" class="space-y-4 pt-3">
        <div class="setting-item">
          <span>{{ t('settings.lyricSettings.background.useCustomBackground') }}</span>
          <input type="checkbox" v-model="config.useCustomBackground" class="toggle-switch" />
        </div>

        <!-- 主题选择 -->
        <div v-if="!config.useCustomBackground" class="radio-group">
          <label class="radio-label">{{ t('settings.lyricSettings.backgroundTheme') }}</label>
          <div class="space-y-2">
            <label class="radio-item">
              <input type="radio" v-model="config.theme" value="default" class="radio-input" />
              <span>{{ t('settings.lyricSettings.themeOptions.default') }}</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="config.theme" value="light" class="radio-input" />
              <span>{{ t('settings.lyricSettings.themeOptions.light') }}</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="config.theme" value="dark" class="radio-input" />
              <span>{{ t('settings.lyricSettings.themeOptions.dark') }}</span>
            </label>
          </div>
        </div>

        <!-- 背景模式选择 -->
        <div v-if="config.useCustomBackground" class="radio-group">
          <label class="radio-label">{{
            t('settings.lyricSettings.background.backgroundMode')
          }}</label>
          <div class="grid grid-cols-2 gap-2">
            <label class="radio-item-compact">
              <input
                type="radio"
                v-model="config.backgroundMode"
                value="solid"
                class="radio-input"
              />
              <span>{{ t('settings.lyricSettings.background.modeOptions.solid') }}</span>
            </label>
            <label class="radio-item-compact">
              <input
                type="radio"
                v-model="config.backgroundMode"
                value="gradient"
                class="radio-input"
              />
              <span>{{ t('settings.lyricSettings.background.modeOptions.gradient') }}</span>
            </label>
            <label class="radio-item-compact">
              <input
                type="radio"
                v-model="config.backgroundMode"
                value="image"
                class="radio-input"
              />
              <span>{{ t('settings.lyricSettings.background.modeOptions.image') }}</span>
            </label>
            <label class="radio-item-compact">
              <input type="radio" v-model="config.backgroundMode" value="css" class="radio-input" />
              <span>{{ t('settings.lyricSettings.background.modeOptions.css') }}</span>
            </label>
          </div>
        </div>

        <!-- 纯色模式 -->
        <div
          v-if="config.useCustomBackground && config.backgroundMode === 'solid'"
          class="color-picker-group"
        >
          <label class="color-picker-label">{{
            t('settings.lyricSettings.background.solidColor')
          }}</label>
          <input type="color" v-model="config.solidColor" class="color-picker" />
        </div>

        <!-- 渐变模式 -->
        <div
          v-if="config.useCustomBackground && config.backgroundMode === 'gradient'"
          class="space-y-3"
        >
          <label class="color-picker-label">{{
            t('settings.lyricSettings.background.gradientEditor')
          }}</label>
          <div class="flex flex-wrap gap-2">
            <div v-for="(_, index) in config.gradientColors.colors" :key="index" class="relative">
              <input
                type="color"
                v-model="config.gradientColors.colors[index]"
                class="color-picker-small"
              />
              <button
                v-if="config.gradientColors.colors.length > 2"
                @click="removeGradientColor(index)"
                class="lyric-floating-action absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-md text-neutral-500 text-xs hover:text-primary transition-colors"
              >
                <i class="ri-close-line"></i>
              </button>
            </div>
          </div>

          <button
            v-if="config.gradientColors.colors.length < 5"
            @click="addGradientColor"
            class="lyric-settings-action w-full py-2 px-4 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 text-white/90"
          >
            <i class="ri-add-line"></i>
            {{ t('settings.lyricSettings.background.addColor') }}
          </button>

          <div class="select-group">
            <label class="select-label">{{
              t('settings.lyricSettings.background.gradientDirection')
            }}</label>
            <select v-model="config.gradientColors.direction" class="select-input">
              <option v-for="opt in gradientDirectionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- 图片模式 -->
        <div
          v-if="config.useCustomBackground && config.backgroundMode === 'image'"
          class="space-y-3"
        >
          <label class="color-picker-label">{{
            t('settings.lyricSettings.background.imageUpload')
          }}</label>
          <input
            type="file"
            accept="image/*"
            @change="handleImageChange"
            class="hidden"
            ref="fileInput"
          />
          <button
            @click="fileInput?.click()"
            class="lyric-settings-action w-full py-2 px-4 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 text-white/90"
          >
            <i class="ri-image-add-line"></i>
            {{ t('settings.lyricSettings.background.imageUpload') }}
          </button>

          <div v-if="config.backgroundImage" class="space-y-3">
            <div class="lyric-image-preview relative rounded-lg overflow-hidden">
              <img
                :src="config.backgroundImage"
                class="w-full max-h-40 object-cover"
                alt="Preview"
              />
              <button
                @click="clearBackgroundImage"
                class="lyric-floating-action absolute top-2 right-2 p-2 rounded-lg text-neutral-500 hover:text-primary transition-colors"
              >
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>

            <div class="slider-group">
              <label class="slider-label">{{
                t('settings.lyricSettings.background.imageBlur')
              }}</label>
              <input
                type="range"
                v-model.number="config.imageBlur"
                min="0"
                max="20"
                step="1"
                class="slider-primary"
              />
              <div class="slider-marks">
                <span>0</span>
                <span>10</span>
                <span>20px</span>
              </div>
            </div>

            <div class="slider-group">
              <label class="slider-label">{{
                t('settings.lyricSettings.background.imageBrightness')
              }}</label>
              <input
                type="range"
                v-model.number="config.imageBrightness"
                min="0"
                max="200"
                step="5"
                class="slider-primary"
              />
              <div class="slider-marks">
                <span>暗</span>
                <span>正常</span>
                <span>亮</span>
              </div>
            </div>
          </div>

          <p class="text-xs text-white/50">
            {{ t('settings.lyricSettings.background.fileSizeLimit') }}
          </p>
        </div>

        <!-- CSS 模式 -->
        <div v-if="config.useCustomBackground && config.backgroundMode === 'css'" class="space-y-2">
          <label class="color-picker-label">{{
            t('settings.lyricSettings.background.customCss')
          }}</label>
          <textarea
            v-model="config.customCss"
            :placeholder="t('settings.lyricSettings.background.customCssPlaceholder')"
            rows="4"
            class="lyric-custom-css-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none font-mono text-white/90"
          ></textarea>
          <p class="text-xs text-white/50">
            {{ t('settings.lyricSettings.background.customCssHelp') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { DEFAULT_LYRIC_CONFIG, LyricConfig } from '@/types/lyric';

const { t } = useI18n();
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });
const emit = defineEmits(['themeChange']);
const message = window.$message;
const activeTab = ref('display');
const fileInput = ref<HTMLInputElement>();

const tabs = computed(() => [
  { key: 'display', label: t('settings.lyricSettings.tabs.display') },
  { key: 'interface', label: t('settings.lyricSettings.tabs.interface') },
  { key: 'typography', label: t('settings.lyricSettings.tabs.typography') },
  { key: 'background', label: t('settings.lyricSettings.tabs.background') }
]);

const showMiniPlayBar = computed({
  get: () => !config.value.hideMiniPlayBar,
  set: (value: boolean) => {
    config.value.hideMiniPlayBar = !value;
    config.value.hidePlayBar = value;
  }
});

const gradientDirectionOptions = computed(() => [
  { label: t('settings.lyricSettings.background.directionOptions.toBottom'), value: 'to bottom' },
  { label: t('settings.lyricSettings.background.directionOptions.toTop'), value: 'to top' },
  { label: t('settings.lyricSettings.background.directionOptions.toRight'), value: 'to right' },
  { label: t('settings.lyricSettings.background.directionOptions.toLeft'), value: 'to left' },
  {
    label: t('settings.lyricSettings.background.directionOptions.toBottomRight'),
    value: 'to bottom right'
  },
  { label: t('settings.lyricSettings.background.directionOptions.angle45'), value: '45deg' }
]);

const addGradientColor = () => {
  if (config.value.gradientColors.colors.length < 5) {
    config.value.gradientColors.colors.push('#666666');
  }
};

const removeGradientColor = (index: number) => {
  if (config.value.gradientColors.colors.length > 2) {
    config.value.gradientColors.colors.splice(index, 1);
  }
};

const handleImageChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    message?.error(t('settings.lyricSettings.background.invalidImageFormat'));
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    message?.error(t('settings.lyricSettings.background.imageTooLarge'));
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    config.value.backgroundImage = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const clearBackgroundImage = () => {
  config.value.backgroundImage = undefined;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

watch(
  () => config.value,
  (newConfig) => {
    localStorage.setItem('music-full-config', JSON.stringify(newConfig));
    updateCSSVariables(newConfig);
  },
  { deep: true }
);

watch(
  () => config.value.theme,
  (newTheme) => {
    emit('themeChange', newTheme);
  }
);

const updateCSSVariables = (config: LyricConfig) => {
  document.documentElement.style.setProperty('--lyric-font-size', `${config.fontSize}px`);
  document.documentElement.style.setProperty('--lyric-letter-spacing', `${config.letterSpacing}px`);
  document.documentElement.style.setProperty(
    '--lyric-font-weight',
    config.fontWeight?.toString() || '400'
  );
  document.documentElement.style.setProperty('--lyric-line-height', config.lineHeight.toString());
};

onMounted(() => {
  const savedConfig = localStorage.getItem('music-full-config');
  if (savedConfig) {
    config.value = { ...config.value, ...JSON.parse(savedConfig) };
    updateCSSVariables(config.value);
  }
});

defineExpose({
  config
});
</script>

<style scoped>
.lyric-settings-panel {
  border: 1px solid color-mix(in srgb, #ffffff 10%, transparent);
  background: color-mix(in srgb, #0f172a 82%, var(--qqm-primary, #22c55e) 4%);
  backdrop-filter: blur(16px) saturate(1.08);
}

.lyric-settings-header {
  border-bottom: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
}

.lyric-settings-tabs {
  border: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
  background: color-mix(in srgb, #020617 22%, transparent);
}

.lyric-settings-tab-active {
  background: var(--qqm-primary, #22c55e);
}

.lyric-settings-tab-idle {
  color: color-mix(in srgb, #ffffff 72%, var(--qqm-primary, #22c55e) 4%);
}

.lyric-settings-tab-idle:hover {
  color: var(--qqm-on-primary, #ffffff);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, transparent);
}

.lyric-settings-action,
.lyric-custom-css-input {
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, transparent);
}

.lyric-settings-action:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 14%, transparent);
}

.lyric-custom-css-input:focus {
  border-color: var(--qqm-primary, #22c55e);
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: color-mix(in srgb, #ffffff 7%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 10%, transparent);
  border-radius: 12px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
  font-size: 13px;
  color: color-mix(in srgb, #ffffff 90%, var(--qqm-primary, #22c55e) 3%);
}

.setting-item:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, transparent);
}

/* 切换开关 */
.toggle-switch {
  appearance: none;
  width: 44px;
  height: 24px;
  background: color-mix(in srgb, #ffffff 12%, transparent);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s ease;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  left: 2px;
  top: 2px;
  transition: transform 0.3s ease;
}

.toggle-switch:checked {
  background: var(--qqm-primary, #22c55e);
}

.toggle-switch:checked::before {
  left: 22px;
}

/* 滑块组 */
.slider-group {
  padding: 10px 12px;
  background: color-mix(in srgb, #ffffff 7%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 10%, transparent);
  border-radius: 12px;
}

.slider-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  opacity: 0.8;
  margin-bottom: 8px;
}

.slider-primary {
  width: 100%;
  height: 4px;
  background: color-mix(in srgb, #ffffff 12%, transparent);
  border-radius: 2px;
  outline: none;
  appearance: none;
}

.slider-primary::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--qqm-primary, #22c55e);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: none;
}

.slider-primary::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--qqm-primary, #22c55e);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: none;
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  opacity: 0.5;
}

/* 单选框组 */
.radio-group {
  padding: 16px;
  background: color-mix(in srgb, #ffffff 5%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
  border-radius: 12px;
}

.radio-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  opacity: 0.7;
  margin-bottom: 12px;
}

.radio-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
  font-size: 14px;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
}

.radio-item:hover {
  background: color-mix(in srgb, #ffffff 7%, transparent);
}

/* 紧凑版单选项（用于横向布局） */
.radio-item-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
  font-size: 13px;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  background: color-mix(in srgb, #ffffff 5%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
}

.radio-item-compact:hover {
  background: color-mix(in srgb, #ffffff 10%, transparent);
  border-color: color-mix(in srgb, #ffffff 14%, transparent);
}

.radio-input {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--text-color-primary);
  opacity: 0.4;
  border-radius: 50%;
  margin-right: 12px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.radio-input:checked {
  border-color: var(--qqm-primary, #22c55e);
  opacity: 1;
}

.radio-input:checked::before {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--qqm-primary, #22c55e);
  border-radius: 50%;
  left: 2px;
  top: 2px;
}

/* 颜色选择器 */
.color-picker-group {
  padding: 16px;
  background: color-mix(in srgb, #ffffff 5%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
  border-radius: 12px;
}

.color-picker-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  opacity: 0.7;
  margin-bottom: 12px;
}

.color-picker {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
  border-radius: 8px;
}

/* 小尺寸颜色选择器（用于渐变） */
.color-picker-small {
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: transparent;
}

.color-picker-small::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker-small::-webkit-color-swatch {
  border: 2px solid color-mix(in srgb, #ffffff 18%, transparent);
  border-radius: 12px;
}

/* 下拉选择 */
.select-group {
  padding: 16px;
  background: color-mix(in srgb, #ffffff 5%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
  border-radius: 12px;
}

.select-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  opacity: 0.7;
  margin-bottom: 12px;
}

.select-input {
  width: 100%;
  padding: 10px 12px;
  background: color-mix(in srgb, #0f172a 18%, transparent);
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
  border-radius: 8px;
  color: color-mix(in srgb, #ffffff 82%, var(--qqm-primary, #22c55e) 4%);
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.select-input:focus {
  border-color: var(--qqm-primary, #22c55e);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, transparent);
}

/* 滚动条 */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, #ffffff 22%, transparent);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, #ffffff 30%, transparent);
}

.lyric-floating-action {
  border: 1px solid var(--qqm-border);
  background: color-mix(in srgb, var(--qqm-surface) 92%, transparent);
}

.lyric-floating-action:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface));
}

.lyric-image-preview {
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
}
</style>
