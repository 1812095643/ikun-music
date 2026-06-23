<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import {
  AUDIO_EFFECT_PRESET_OPTIONS,
  type AudioEffectPreset,
  audioService
} from '@/services/audioService';

const currentPreset = shallowRef<AudioEffectPreset>(audioService.getEffectPreset());

const isEffectAvailable = computed(() => audioService.isAudioEffectAvailable());

const selectPreset = (preset: AudioEffectPreset) => {
  currentPreset.value = preset;
  audioService.setEffectPreset(preset);
};
</script>

<template>
  <div class="audio-effects-panel">
    <div class="audio-effects-header">
      <div>
        <h3>音效</h3>
        <p>
          {{
            isEffectAvailable
              ? '选择接近 QQ 音乐的 KTV、录音棚、3D 等听感'
              : '当前音源优先保证播放成功，在线直链可能暂不支持音效'
          }}
        </p>
      </div>
    </div>

    <div class="audio-effects-grid">
      <button
        v-for="preset in AUDIO_EFFECT_PRESET_OPTIONS"
        :key="preset.value"
        class="audio-effect-option"
        :class="{ active: currentPreset === preset.value }"
        type="button"
        @click="selectPreset(preset.value)"
      >
        <span class="audio-effect-icon">
          <i :class="preset.icon"></i>
        </span>
        <span class="audio-effect-copy">
          <span class="audio-effect-name">{{ preset.label }}</span>
          <span class="audio-effect-desc">{{ preset.description }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.audio-effects-panel {
  width: min(520px, calc(100vw - 48px));
  padding: 22px;
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(20, 24, 31, 0.08)) 78%, #fff 22%);
  border-radius: 12px;
  background: color-mix(in srgb, var(--qqm-surface, #fff) 94%, transparent);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--qqm-text, #1f2329) 7%, transparent);
  backdrop-filter: blur(14px) saturate(1.12);
}

.audio-effects-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h3 {
    margin: 0 0 6px;
    color: var(--qqm-text, #151922);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
  }

  p {
    margin: 0;
    color: var(--qqm-muted, rgba(107, 114, 128, 1));
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }
}

.audio-effects-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.audio-effect-option {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--qqm-border, rgba(20, 24, 31, 0.08));
  border-radius: 10px;
  background: var(--qqm-surface, #fff);
  color: var(--qqm-text, #151922);
  text-align: left;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    transform 0.16s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
  }

  &:active {
    transform: scale(0.98);
  }

  &.active {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 42%, var(--qqm-border));
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 10%, var(--qqm-surface));
  }
}

.audio-effect-icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 10%, transparent);
  color: var(--qqm-primary-strong, #16a34a);

  i {
    font-size: 20px;
    line-height: 1;
  }
}

.audio-effect-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.audio-effect-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.audio-effect-desc {
  color: var(--qqm-muted, rgba(107, 114, 128, 1));
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

@media (max-width: 520px) {
  .audio-effects-grid {
    grid-template-columns: 1fr;
  }
}
</style>
