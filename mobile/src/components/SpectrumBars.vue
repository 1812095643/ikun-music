<script setup lang="ts">
import { computed } from 'vue';

import { spectrumFrame, spectrumUnavailable } from '@/services/spectrum';
import { playing } from '@/stores/player';
const channels = computed(() =>
  [spectrumFrame.value.left, spectrumFrame.value.right].map((values) =>
    Array.from({ length: 28 }, (_, index) =>
      playing.value ? Math.max(0, Math.min(1, values[index] || 0)) : 0
    )
  )
);
</script>
<template>
  <view
    class="spectrum-strip"
    role="img"
    :aria-label="spectrumFrame.channels === 1 ? '单声道音乐频谱' : '左右声道音乐频谱'"
  >
    <view v-for="(bars, channel) in channels" :key="channel" class="spectrum-channel"
      ><text class="spectrum-side">{{
        spectrumFrame.channels === 1 ? 'M' : channel === 0 ? 'L' : 'R'
      }}</text
      ><view class="spectrum-bars"
        ><view
          v-for="(value, index) in bars"
          :key="index"
          class="spectrum-bar"
          :style="{ transform: `scaleY(${value})` }" /></view
    ></view>
    <text v-if="playing && !spectrumFrame.ready" class="spectrum-unavailable">{{
      spectrumUnavailable ? '当前设备暂不支持频谱' : '正在等待音频频谱'
    }}</text>
  </view>
</template>
<style scoped>
.spectrum-strip {
  display: flex;
  gap: 22px;
  height: 36px;
  min-height: 36px;
  padding: 5px 28px 0;
  background: var(--qqm-surface);
  position: relative;
  flex-shrink: 0;
}
.spectrum-channel {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.spectrum-side {
  font-size: 9px;
  color: var(--qqm-muted);
  line-height: 1;
  padding-bottom: 2px;
}
.spectrum-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 27px;
  flex: 1;
  border-bottom: 1px solid var(--qqm-border);
}
.spectrum-bar {
  flex: 1;
  height: 100%;
  max-width: 18px;
  border-radius: 2px 2px 0 0;
  background: var(--qqm-primary);
  opacity: 0.65;
  transform-origin: bottom;
  transition: transform 90ms linear;
}
.spectrum-unavailable {
  position: absolute;
  inset: 8px 0 auto;
  text-align: center;
  font-size: 11px;
  color: var(--qqm-muted);
}
.player-sheet .spectrum-strip {
  background: transparent;
  padding: 6px 0 0;
  margin-top: 8px;
}
.player-sheet .spectrum-side {
  color: #a7bcae;
}
@media (prefers-reduced-motion: reduce) {
  .spectrum-bar {
    transition: none;
  }
}
</style>
