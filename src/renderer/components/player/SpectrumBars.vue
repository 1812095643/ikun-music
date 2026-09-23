<script setup lang="ts">
import { useDocumentVisibility, useElementVisibility } from '@vueuse/core';
import { computed, onActivated, onDeactivated, onScopeDispose, shallowRef, watch } from 'vue';

import { subscribeAudioSpectrum } from '@/services/spectrumService';
import { usePlayerStore } from '@/store/modules/player';

import { EMPTY_SPECTRUM, SPECTRUM_BANDS, type SpectrumFrame } from '../../../shared/audioSpectrum';

const props = defineProps<{ compact?: boolean; frame?: SpectrumFrame; playing?: boolean }>();
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
    Array.from({ length: SPECTRUM_BANDS }, (_, index) =>
      frame.value.ready ? Math.min(1, Math.max(0, values[index] || 0)) : 0
    )
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
      <span class="spectrum-side">{{ channel === 0 ? 'L' : 'R' }}</span>
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
  gap: 18px;
  height: 26px;
  min-width: 0;
  pointer-events: none;
  color: var(--qqm-primary, #1ecf73);
}
.spectrum-channel {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 7px;
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
  gap: 3px;
  height: 100%;
}
.spectrum-bar {
  flex: 1;
  min-width: 1px;
  height: 100%;
  border-radius: 2px 2px 0 0;
  background: currentColor;
  opacity: 0.62;
  transform-origin: bottom;
  transition: transform 80ms linear;
}
.fallback .spectrum-bar {
  animation: spectrum-pulse 720ms ease-in-out infinite alternate;
  animation-delay: calc(var(--spectrum-index, 0) * -42ms);
}
.compact {
  height: 18px;
  gap: 12px;
}
.compact .spectrum-bars {
  gap: 2px;
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
