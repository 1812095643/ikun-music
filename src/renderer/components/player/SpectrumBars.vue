<script setup lang="ts">
import { useDocumentVisibility, useElementVisibility } from '@vueuse/core';
import { computed, onActivated, onDeactivated, onScopeDispose, shallowRef, watch } from 'vue';

import { subscribeAudioSpectrum } from '@/services/spectrumService';
import { usePlayerStore } from '@/store/modules/player';

import { EMPTY_SPECTRUM, SPECTRUM_BANDS, type SpectrumFrame } from '../../../shared/audioSpectrum';

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    frame?: SpectrumFrame;
    playing?: boolean;
    showLabels?: boolean;
  }>(),
  {
    compact: false,
    showLabels: false
  }
);
const playerStore = usePlayerStore();
const root = shallowRef<HTMLElement>();
const visible = useElementVisibility(root);
const documentVisibility = useDocumentVisibility();
const active = shallowRef(true);
const sampled = shallowRef(EMPTY_SPECTRUM);
const frame = computed(() => props.frame || sampled.value);
const isPlaying = computed(() => props.playing ?? playerStore.isPlay);
const channels = computed(() =>
  [frame.value.left, frame.value.right].map((values) =>
    Array.from({ length: SPECTRUM_BANDS }, (_, index) => {
      if (!frame.value.ready) return 0;

      // 两侧从中心向外渐弱，左右声道仍使用各自的频谱数据，视觉上连成一条完整的律动带。
      const centerWeight = 0.82 + 0.18 * (1 - index / Math.max(1, SPECTRUM_BANDS - 1));
      return Math.min(1, Math.max(0, (values[index] || 0) * centerWeight));
    })
  )
);
let unsubscribe: (() => void) | undefined;
watch(
  () => !props.frame && active.value && visible.value && documentVisibility.value === 'visible',
  (enabled) => {
    unsubscribe?.();
    unsubscribe = enabled
      ? subscribeAudioSpectrum((value) => {
          sampled.value = value;
        })
      : undefined;
    if (!enabled) sampled.value = EMPTY_SPECTRUM;
  },
  { immediate: true }
);
onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
});
onScopeDispose(() => unsubscribe?.());
</script>

<template>
  <div
    ref="root"
    class="spectrum-strip"
    :class="{ compact, fallback: isPlaying && !frame.ready }"
    role="img"
    aria-label="左右声道音乐频谱"
    :data-ready="frame.ready"
  >
    <div v-for="(bars, channel) in channels" :key="channel" class="spectrum-channel">
      <span v-if="showLabels" class="spectrum-side">{{ channel === 0 ? 'L' : 'R' }}</span>
      <div class="spectrum-bars">
        <i
          v-for="(value, index) in bars"
          :key="index"
          class="spectrum-bar"
          :style="{ '--spectrum-index': index, transform: `scaleY(${Math.max(0.045, value)})` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.spectrum-strip {
  display: flex;
  gap: 0;
  height: 44px;
  min-width: 0;
  pointer-events: none;
  color: var(--qqm-primary, #1ecf73);
}
.spectrum-channel {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: flex-end;
}
.spectrum-side {
  font-size: 8px;
  line-height: 1;
  opacity: 0.65;
  padding-bottom: 1px;
}
.spectrum-bars {
  display: flex;
  align-items: flex-end;
  flex: 1;
  min-width: 0;
  gap: 4px;
  height: 100%;
}
.spectrum-channel:first-child .spectrum-bars {
  flex-direction: row-reverse;
}
.spectrum-bar {
  flex: 1;
  min-width: 1px;
  height: 100%;
  border-radius: 3px 3px 1px 1px;
  background: currentColor;
  opacity: 0.58;
  transform-origin: bottom;
  transition: transform 80ms linear;
  will-change: transform;
}
.fallback .spectrum-bar {
  animation: spectrum-pulse 720ms ease-in-out infinite alternate;
  animation-delay: calc(var(--spectrum-index, 0) * -42ms);
}
.compact {
  height: 24px;
}
.compact .spectrum-bars {
  gap: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .spectrum-bar {
    transition: none;
  }
}
@keyframes spectrum-pulse {
  from {
    transform: scaleY(0.16);
  }
  to {
    transform: scaleY(0.76);
  }
}
</style>
