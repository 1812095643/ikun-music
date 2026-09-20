<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue';

import {
  current,
  cycleMode,
  mode,
  pendingTrack,
  queue,
  queueIndex,
  requestTrack
} from '@/stores/player';

import CoverArt from './CoverArt.vue';
import SheetFrame from './SheetFrame.vue';
const emit = defineEmits<{ close: [] }>();
const target = shallowRef(`queued-${Math.max(0, queueIndex.value - 2)}`);
const modeName = computed(
  () => ({ sequence: '顺序播放', repeat: '单曲循环', shuffle: '随机播放' })[mode.value]
);
function locate() {
  target.value = '';
  void nextTick(() => {
    target.value = `queued-${Math.max(0, queueIndex.value - 2)}`;
  });
}
watch(queueIndex, locate);
</script>
<template>
  <sheet-frame :title="`播放队列（${queue.length}）`" @close="emit('close')"
    ><view class="queue-tools"
      ><button role="button" @click="cycleMode">
        <text
          :class="
            mode === 'shuffle'
              ? 'ri-shuffle-line'
              : mode === 'repeat'
                ? 'ri-repeat-one-line'
                : 'ri-order-play-line'
          "
        /><text>{{ modeName }}</text></button
      ><button role="button" :disabled="!current" @click="locate">
        <text class="ri-focus-3-line" /><text>定位当前</text>
      </button></view
    ><scroll-view scroll-y class="queue-scroll" :scroll-into-view="target" scroll-with-animation
      ><view v-if="!queue.length" class="state-box"
        ><text
          class="empty-symbol ri-play-list-2-line"
        />选一首喜欢的歌，播放队列就会出现在这里。</view
      ><button
        v-for="(song, index) in queue"
        :id="`queued-${index}`"
        :key="`${song.id}-${index}`"
        role="button"
        class="queue-row"
        :class="{ selected: current?.id === song.id }"
        @click="requestTrack(index)"
      >
        <view class="queue-cover"><cover-art :src="song.cover" radius="8px" /></view
        ><view class="queue-song"
          ><text class="queue-title ellipsis">{{ song.title }}</text
          ><text class="queue-artist ellipsis">{{ song.artist }}</text></view
        ><text v-if="pendingTrack?.id === song.id" class="spinner" /><text
          v-else-if="current?.id === song.id"
          class="ri-equalizer-line"
        /><text v-else class="queue-duration"
          >{{ Math.floor(song.duration / 60) }}:{{
            String(Math.floor(song.duration % 60)).padStart(2, '0')
          }}</text
        ></button
      ><view style="height: 10px" /></scroll-view
  ></sheet-frame>
</template>
<style scoped>
.queue-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px 15px;
  border-bottom: 1px solid var(--qqm-border);
}
.queue-tools button {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--qqm-muted) !important;
  font-size: calc(12px + var(--font-size-adjustment)) !important;
  min-height: 32px;
}
.queue-tools button > text:first-child {
  font-size: 19px;
}
.queue-scroll {
  height: 50vh;
}
.queue-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 22px !important;
  text-align: left;
  width: 100%;
}
.queue-row.selected {
  background: var(--qqm-primary-soft) !important;
}
.queue-cover {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
}
.queue-song {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.queue-title {
  font-size: calc(15px + var(--font-size-adjustment));
}
.queue-artist {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.queue-row.selected .queue-title {
  color: var(--qqm-accent-text);
}
.queue-row .ri-equalizer-line {
  font-size: 20px;
  color: var(--qqm-accent-text);
}
.queue-row .spinner {
  width: 16px;
  height: 16px;
  color: var(--qqm-accent-text);
}
.queue-duration {
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  font-variant-numeric: tabular-nums;
}
</style>
