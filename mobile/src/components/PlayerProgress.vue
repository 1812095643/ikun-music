<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import { formatTime } from '@/stores/player';
const props = defineProps<{
  position: number;
  duration: number;
  canSeek: boolean;
  songId?: string;
}>();
const emit = defineEmits<{ seek: [time: number] }>();
const dragging = shallowRef(false);
const staged = shallowRef(0);
const displayed = computed(() => (dragging.value ? staged.value : props.position));
watch(
  () => props.songId,
  () => {
    dragging.value = false;
    staged.value = 0;
  }
);
function finish(event: { detail: { value: number } }) {
  dragging.value = false;
  emit('seek', Math.min(props.duration, Math.max(0, event.detail.value)));
}
</script>
<template>
  <view class="player-progress"
    ><slider
      :value="displayed"
      :max="Math.max(1, Math.ceil(duration))"
      :step="1"
      active-color="#eaf5ed"
      background-color="rgba(222,239,228,.18)"
      block-color="#f7fff8"
      :block-size="11"
      :disabled="!canSeek || duration <= 0"
      @changing="
        dragging = true;
        staged = $event.detail.value;
      "
      @change="finish"
    /><view class="player-time"
      ><text>{{ formatTime(displayed) }}</text
      ><text>{{ formatTime(duration) }}</text></view
    ></view
  >
</template>
<style scoped>
.player-progress {
  padding-top: 5px;
}
.player-progress slider {
  margin: 0 0 5px;
}
.player-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: calc(11px + var(--font-size-adjustment));
  color: #a7bcae;
  font-variant-numeric: tabular-nums;
}
</style>
