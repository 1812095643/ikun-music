<script setup lang="ts">
import { computed, onUnmounted, shallowRef } from 'vue';

import { useAudioEffects } from '@/hooks/useAudioEffects';
import {
  AUDIO_EFFECT_PRESET_OPTIONS,
  type AudioEffectPreset,
  getEffectPreset
} from '@/services/audioEffects';
import { audioService } from '@/services/audioService';

const emit = defineEmits<{ close: [] }>();
const state = useAudioEffects();
const selected = computed(() => getEffectPreset(state.value.preset));
const enabled = computed(() => state.value.preset !== 'off');
const status = computed(() =>
  !enabled.value
    ? '原声播放'
    : state.value.comparing
      ? '正在对比原声'
      : !state.value.hasTrack
        ? '播放后生效'
        : state.value.available
          ? '音效已生效'
          : '当前音源使用原声'
);
const selectPreset = (preset: AudioEffectPreset) => {
  clearTimeout(spaceTimer);
  audioService.setEffectPreset(preset);
};
const toggle = () => {
  clearTimeout(spaceTimer);
  audioService.setEffectEnabled(!enabled.value);
};
const updateMix = (event: Event) =>
  audioService.setEffectSettings({ mix: Number((event.target as HTMLInputElement).value) });
const spaceValue = shallowRef(state.value.settings.space);
let spaceTimer: ReturnType<typeof setTimeout>;
const updateSpace = (event: Event) => {
  spaceValue.value = Number((event.target as HTMLInputElement).value);
  clearTimeout(spaceTimer);
  spaceTimer = setTimeout(() => audioService.setEffectSettings({ space: spaceValue.value }), 160);
};
const reset = () => {
  clearTimeout(spaceTimer);
  if (selected.value) {
    audioService.setEffectPreset(selected.value.value);
    spaceValue.value = state.value.settings.space;
  }
};
onUnmounted(() => {
  clearTimeout(spaceTimer);
  audioService.compareOriginal(false);
});
</script>

<template>
  <section class="audio-effects-panel" role="dialog" aria-labelledby="effects-title">
    <header class="effects-header">
      <div class="effects-brand">
        <i class="ri-sound-module-line" aria-hidden="true" />
        <div>
          <h2 id="effects-title">声音实验室</h2>
          <p>找到你喜欢的听感</p>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="effects-switch"
          role="switch"
          :aria-checked="enabled"
          aria-label="开启音效"
          @click="toggle"
        >
          <span />
        </button>
        <button class="close-effects" aria-label="关闭音效面板" @click="emit('close')">
          <i class="ri-close-line" />
        </button>
      </div>
    </header>
    <div class="effects-body">
      <aside class="effects-presets" aria-label="音效预设">
        <span class="section-eyebrow">精选听感</span>
        <button
          v-for="preset in AUDIO_EFFECT_PRESET_OPTIONS"
          :key="preset.value"
          class="preset-row"
          :class="{ selected: state.preset === preset.value }"
          :aria-pressed="state.preset === preset.value"
          @click="
            selectPreset(preset.value);
            spaceValue = state.settings.space;
          "
        >
          <i :class="preset.icon" aria-hidden="true" /><span>{{ preset.label }}</span
          ><i
            v-if="state.preset === preset.value"
            class="ri-check-line preset-check"
            aria-hidden="true"
          />
        </button>
      </aside>
      <main class="effects-detail">
        <div class="effect-scene">
          <div class="scene-copy">
            <span class="scene-tag">{{ selected?.tag || '忠于原来的声音' }}</span>
            <h3>{{ selected?.label || '原声' }}</h3>
            <p>{{ selected?.description || '关闭音效，保留歌曲原本的细节与动态' }}</p>
          </div>
          <svg
            class="sound-space"
            viewBox="0 0 160 148"
            aria-hidden="true"
            :style="{ '--space-scale': 0.7 + state.settings.space / 180 }"
          >
            <g class="space-rings">
              <ellipse cx="80" cy="78" rx="66" ry="39" />
              <ellipse cx="80" cy="78" rx="48" ry="28" />
              <ellipse cx="80" cy="78" rx="29" ry="17" />
            </g>
            <path
              d="M62 78V65a18 18 0 0136 0v13M62 68h-3a5 5 0 00-5 5v8a5 5 0 005 5h6V69m33-1h3a5 5 0 015 5v8a5 5 0 01-5 5h-6V69"
              class="headphones"
            />
            <circle cx="128" cy="56" r="4" class="space-point" />
          </svg>
        </div>
        <div class="effect-status" role="status">
          <span :class="{ active: enabled && state.available && !state.comparing }" />{{ status
          }}<small v-if="selected?.value === 'spatial3d'">戴上耳机感受声场移动</small>
        </div>
        <div class="effects-adjustments" :class="{ disabled: !enabled }">
          <div class="adjustment-heading">
            <span>精细调节</span
            ><button :disabled="!enabled" @click="reset">
              <i class="ri-refresh-line" /> 恢复预设
            </button>
          </div>
          <label class="effect-slider"
            ><span class="slider-label"
              ><span>效果强度<small>原声与效果的混合比例</small></span
              ><output>{{ state.settings.mix }}<small>%</small></output></span
            ><input
              aria-label="效果强度"
              type="range"
              min="0"
              max="100"
              :value="state.settings.mix"
              :disabled="!enabled"
              :style="{ '--fill': state.settings.mix + '%' }"
              @input="updateMix"
            /><span class="slider-ends"><span>原声</span><span>浓郁</span></span></label
          >
          <label class="effect-slider"
            ><span class="slider-label"
              ><span>空间感<small>混响尾韵与声场范围</small></span
              ><output>{{ state.settings.space }}<small>%</small></output></span
            ><input
              aria-label="空间感"
              type="range"
              min="0"
              max="100"
              :value="state.settings.space"
              :disabled="!enabled"
              :style="{ '--fill': state.settings.space + '%' }"
              @input="updateSpace"
            /><span class="slider-ends"><span>贴近</span><span>开阔</span></span></label
          >
        </div>
        <footer class="effects-footer">
          <span>自动保存 · 切歌继续生效</span
          ><button
            class="compare-original"
            :class="{ comparing: state.comparing }"
            :disabled="!enabled || !state.available"
            :aria-pressed="state.comparing"
            @click="audioService.compareOriginal(!state.comparing)"
          >
            <i class="ri-volume-up-line" />{{ state.comparing ? '返回音效' : '对比原声' }}
          </button>
        </footer>
      </main>
    </div>
  </section>
</template>

<style scoped>
.audio-effects-panel {
  width: min(800px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  color: var(--qqm-text, #1b2621);
  background: var(--qqm-surface, #fbfcfb) !important;
  border: 0 !important;
  border-radius: 20px !important;
  box-shadow:
    0 0 0 1px rgb(20 35 25 / 6%),
    0 8px 40px rgb(15 32 22 / 18%) !important;
  font-family: inherit;
}
button {
  font-family: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--qqm-primary, #1ecf73);
  outline-offset: 4px;
}
.effects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 26px 30px;
  border-bottom: 1px solid var(--qqm-border, #edf0ed);
}
.effects-brand {
  display: flex;
  gap: 12px;
  align-items: center;
}
.effects-brand > i {
  font-size: 26px;
  color: var(--qqm-primary-strong, #119354);
}
.effects-brand h2 {
  font-size: 21px;
  font-weight: 650;
  margin: 0 0 3px;
  letter-spacing: -0.02em;
}
.effects-brand p {
  margin: 0;
  font-size: 12px;
  color: var(--qqm-muted, #778079);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 22px;
}
.effects-switch {
  width: 38px;
  height: 22px;
  border: 0;
  border-radius: 20px;
  padding: 3px;
  background: var(--qqm-border, #dce1de);
}
.effects-switch span {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 180ms ease;
  box-shadow: 0 1px 3px #0002;
}
.effects-switch[aria-checked='true'] {
  background: var(--qqm-primary-strong, #119354);
}
.effects-switch[aria-checked='true'] span {
  transform: translateX(16px);
}
.close-effects {
  width: 28px;
  height: 28px;
  background: transparent;
  border: 0;
  font-size: 22px;
  color: var(--qqm-muted);
}
.effects-body {
  display: grid;
  grid-template-columns: 206px 1fr;
}
.effects-presets {
  padding: 22px 16px 22px 20px;
  border-right: 1px solid var(--qqm-border, #edf0ed);
}
.section-eyebrow {
  display: block;
  margin: 0 12px 14px;
  font-size: 11px;
  color: var(--qqm-muted);
  letter-spacing: 0.12em;
}
.preset-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 43px;
  padding: 0 12px;
  margin: 3px 0;
  border: 0;
  border-radius: 8px;
  color: var(--qqm-text);
  background: transparent;
  text-align: left;
  font-size: 13px;
  transition:
    background 160ms,
    color 160ms;
}
.preset-row > i {
  font-size: 18px;
  color: var(--qqm-muted);
}
.preset-row:hover {
  background: color-mix(in srgb, var(--qqm-primary, #1ecf73) 6%, transparent);
}
.preset-row.selected {
  background: color-mix(in srgb, var(--qqm-primary, #1ecf73) 12%, transparent);
  color: var(--qqm-primary-strong, #119354);
  font-weight: 650;
}
.preset-row.selected > i {
  color: inherit;
}
.preset-check {
  margin-left: auto;
  font-size: 15px !important;
}
.effects-detail {
  padding: 16px 30px 24px;
  min-width: 0;
}
.effect-scene {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 145px;
  gap: 8px;
}
.scene-tag {
  color: var(--qqm-primary-strong, #119354);
  font-size: 11px;
  font-weight: 550;
}
.scene-copy h3 {
  font-size: 28px;
  margin: 9px 0 8px;
  font-weight: 600;
  letter-spacing: -0.04em;
}
.scene-copy p {
  font-size: 12px;
  line-height: 1.6;
  color: var(--qqm-muted);
  margin: 0;
}
.sound-space {
  width: 142px;
  flex: 0 0 142px;
  stroke: var(--qqm-primary-strong, #119354);
  fill: none;
}
.space-rings {
  stroke-width: 0.85;
  opacity: 0.23;
  transform: scale(var(--space-scale));
  transform-origin: 80px 78px;
  transition: transform 180ms ease;
}
.headphones {
  stroke-width: 2;
  stroke-linecap: round;
}
.space-point {
  fill: var(--qqm-primary, #1ecf73);
  stroke: none;
}
.effect-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--qqm-muted);
  min-height: 32px;
  padding-bottom: 12px;
}
.effect-status > span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--qqm-muted);
}
.effect-status > span.active {
  background: var(--qqm-primary, #1ecf73);
}
.effect-status small {
  margin-left: auto;
  font-size: 10px;
}
.effects-adjustments {
  border-top: 1px solid var(--qqm-border, #edf0ed);
  padding-top: 18px;
}
.effects-adjustments.disabled {
  opacity: 0.55;
}
.adjustment-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 19px;
}
.adjustment-heading button {
  background: transparent;
  border: 0;
  font-size: 11px;
  color: var(--qqm-muted);
}
.effect-slider {
  display: block;
  margin: 0 0 22px;
}
.slider-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 12px;
}
.slider-label > span small {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: var(--qqm-muted);
}
.slider-label output {
  font-size: 19px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.slider-label output small {
  font-size: 10px;
  margin-left: 3px;
  color: var(--qqm-muted);
}
.effect-slider input {
  display: block;
  width: 100%;
  height: 5px;
  border-radius: 6px;
  appearance: none;
  background: linear-gradient(
    to right,
    var(--qqm-primary-strong, #119354) var(--fill),
    var(--qqm-border, #dfe6e1) var(--fill)
  );
  cursor: pointer;
}
.effect-slider input::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--qqm-surface, #fff);
  border: 2px solid var(--qqm-primary-strong, #119354);
  box-shadow: 0 1px 3px #0002;
}
.slider-ends {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--qqm-muted);
  margin-top: 9px;
}
.effects-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  color: var(--qqm-muted);
  padding-top: 6px;
}
.compare-original {
  background: transparent;
  border: 1px solid var(--qqm-border, #dde5df);
  color: var(--qqm-text);
  font-size: 12px;
  padding: 9px 13px;
  border-radius: 7px;
}
.compare-original.comparing {
  border-color: var(--qqm-primary-strong);
  color: var(--qqm-primary-strong);
}
@media (max-width: 620px) {
  .effects-body {
    grid-template-columns: 1fr;
  }
  .effects-presets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 12px;
    border-right: 0;
  }
  .section-eyebrow {
    display: none;
  }
  .preset-row {
    justify-content: center;
    height: 36px;
    padding: 0 4px;
    gap: 4px;
    font-size: 11px;
  }
  .preset-row > i {
    font-size: 14px;
  }
  .preset-check {
    display: none;
  }
  .effects-detail {
    padding: 0 22px 22px;
  }
  .effect-scene {
    min-height: 115px;
  }
  .effects-header {
    padding: 20px;
  }
  .sound-space {
    width: 100px;
    flex-basis: 100px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
</style>
