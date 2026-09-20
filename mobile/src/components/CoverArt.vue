<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
const props = withDefaults(defineProps<{ src?: string; radius?: string; large?: boolean }>(), {
  src: '',
  radius: '12px',
  large: false
});
const failed = shallowRef(false);
const highResolutionFailed = shallowRef(false);
const source = computed(() =>
  props.large &&
  !highResolutionFailed.value &&
  /kwcdn\.kuwo\.cn\/star\/albumcover\/120\//.test(props.src)
    ? props.src.replace('/albumcover/120/', '/albumcover/500/')
    : props.src
);
watch(
  () => props.src,
  () => {
    failed.value = false;
    highResolutionFailed.value = false;
  }
);
function imageError() {
  if (source.value !== props.src) highResolutionFailed.value = true;
  else failed.value = true;
}
</script>
<template>
  <view class="cover-art" :style="{ borderRadius: radius }"
    ><view class="cover-record"
      ><view class="cover-record-label"><text class="ri-music-2-fill" /></view></view
    ><image
      v-if="src && !failed"
      class="cover-image"
      :src="source"
      mode="aspectFill"
      lazy-load
      @error="imageError"
  /></view>
</template>
<style scoped>
.cover-art {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e4ebe7;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-record {
  height: 66%;
  aspect-ratio: 1;
  border: 1px solid #bccdc2;
  border-radius: 50%;
  padding: 16%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: repeating-radial-gradient(
    circle,
    transparent 0,
    transparent 6px,
    rgba(151, 177, 161, 0.15) 7px,
    transparent 8px
  );
}
.theme-dark .cover-art {
  background: #263830;
}
.player-sheet .cover-art {
  background: #243b2e;
}
.player-sheet .cover-record {
  border-color: #4b6454;
}
.theme-dark .cover-record {
  border-color: #496354;
}
.cover-record-label {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #809e8c;
}
.cover-record-label text {
  font-size: 23px;
}
.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
