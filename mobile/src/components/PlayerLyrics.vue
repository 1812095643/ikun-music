<script setup lang="ts">
import { onUnmounted, shallowRef, watch } from 'vue';

import type { LyricLine } from '@/services/musicApi';
const props = defineProps<{
  lines: LyricLine[];
  activeIndex: number;
  loading: boolean;
  fontSize: number;
  songId?: string;
}>();
const emit = defineEmits<{ seek: [time: number] }>();
const manual = shallowRef(false);
const target = shallowRef('lyric-0');
let followTimer: ReturnType<typeof setTimeout>;
function follow() {
  clearTimeout(followTimer);
  manual.value = false;
  target.value = `lyric-${Math.max(0, props.activeIndex - 2)}`;
}
function browse() {
  clearTimeout(followTimer);
  manual.value = true;
}
function endBrowse() {
  clearTimeout(followTimer);
  followTimer = setTimeout(follow, 3500);
}
function seekLine(time: number) {
  emit('seek', time);
  follow();
}
watch(
  () => props.activeIndex,
  () => {
    if (!manual.value) follow();
  }
);
watch(
  () => props.songId,
  () => {
    target.value = 'lyric-0';
    manual.value = false;
    clearTimeout(followTimer);
  }
);
onUnmounted(() => clearTimeout(followTimer));
</script>
<template>
  <view class="lyric-stage"
    ><scroll-view
      scroll-y
      class="lyrics-scroll"
      :scroll-into-view="target"
      scroll-with-animation
      @touchstart="browse"
      @touchend="endBrowse"
      @touchcancel="endBrowse"
      @wheel="
        browse();
        endBrowse();
      "
      ><view class="lyric-leading" /><view v-if="!lines.length" class="lyrics-empty"
        ><view class="lyric-empty-record"><text class="ri-music-2-line" /></view
        ><text>{{ loading ? '正在寻找歌词' : '这首歌暂时没有歌词' }}</text
        ><text class="lyric-empty-caption">{{
          loading ? '音乐已经开始，歌词随后就来' : '让旋律继续陪着你'
        }}</text></view
      ><button
        v-for="(line, index) in lines"
        :id="`lyric-${index}`"
        :key="`${line.time}-${index}`"
        role="button"
        class="lyric-line"
        :class="{ active: index === activeIndex, past: index < activeIndex }"
        :style="{ fontSize: `calc(${fontSize}px + var(--font-size-adjustment))` }"
        :aria-label="`从这句开始播放 ${line.text}`"
        @click="seekLine(line.time)"
      >
        {{ line.text }}</button
      ><view class="lyric-trailing" /></scroll-view
    ><button v-if="manual && lines.length" role="button" class="follow-lyrics" @click="follow">
      <text class="ri-focus-3-line" />回到当前歌词
    </button></view
  >
</template>
<style scoped>
.lyric-stage {
  height: 100%;
  position: relative;
}
.lyrics-scroll {
  height: 100%;
  mask-image: linear-gradient(transparent, black 13%, black 83%, transparent);
}
.lyric-leading {
  height: 66px;
}
.lyric-trailing {
  height: 190px;
}
.lyric-line {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 31px !important;
  font-weight: 500 !important;
  line-height: 1.65 !important;
  color: #a9b8ae !important;
  white-space: normal;
  word-break: break-word;
  transition: color 0.24s ease;
}
.lyric-line.active {
  color: #f5fff7 !important;
  font-weight: 650 !important;
}
.lyric-line.past {
  color: #8d9f93 !important;
}
.lyrics-empty {
  height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  color: #d3e0d8;
  font-size: calc(17px + var(--font-size-adjustment));
}
.lyric-empty-record {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  border: 1px solid #4a6453;
  border-radius: 50%;
  margin-bottom: 5px;
}
.lyric-empty-caption {
  font-size: calc(12px + var(--font-size-adjustment));
  color: #93a99b;
}
.follow-lyrics {
  position: absolute;
  bottom: 9px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 15px !important;
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 20px !important;
  white-space: nowrap;
  color: #dbefe1 !important;
  background: #263f2f !important;
  font-size: calc(12px + var(--font-size-adjustment)) !important;
}
</style>
