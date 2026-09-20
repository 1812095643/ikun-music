<script setup lang="ts">
import { startDownload } from '@/services/downloads';
import { qualities, type Track } from '@/services/musicApi';
import { toast } from '@/stores/library';
import { changeQuality, quality } from '@/stores/player';

import SheetFrame from './SheetFrame.vue';
const props = defineProps<{ downloadTrack?: Track }>();
const emit = defineEmits<{ close: [] }>();
function choose(value: typeof quality.value) {
  if (props.downloadTrack) startDownload(props.downloadTrack, value);
  else {
    changeQuality(value);
    toast('播放音质已保存，下次播放生效');
  }
  emit('close');
}
</script>
<template>
  <sheet-frame :title="downloadTrack ? '选择下载音质' : '播放音质'" @close="emit('close')"
    ><view v-if="downloadTrack" class="quality-song ellipsis"
      >{{ downloadTrack.title }} · {{ downloadTrack.artist }}</view
    ><button
      v-for="item in qualities"
      :key="item.key"
      role="button"
      class="sheet-row quality-row"
      @click="choose(item.key)"
    >
      <view class="quality-mark" :class="item.key">{{
        item.key === 'lossless' ? 'SQ' : item.key === 'high' ? 'HQ' : 'SD'
      }}</view
      ><view class="quality-copy"
        ><text>{{ item.label }}</text
        ><text class="sheet-row-description">{{ item.description }}</text></view
      ><text v-if="downloadTrack" class="sheet-row-end ri-download-line" /><text
        v-else-if="quality === item.key"
        class="quality-selected ri-checkbox-circle-fill"
      /><view v-else class="quality-unselected" /></button
    ><view class="quality-note">{{
      downloadTrack
        ? '下载保存音源返回的实际格式，可在「本地下载」中查看。'
        : '优先使用所选音质，实际格式以音源为准。'
    }}</view></sheet-frame
  >
</template>
<style scoped>
.quality-song {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  padding: 0 22px 17px;
}
.quality-row {
  min-height: 78px;
}
.quality-mark {
  font-size: calc(11px + var(--font-size-adjustment));
  font-weight: 650;
  letter-spacing: 0.4px;
  color: #647980;
  border: 1px solid #aabac1;
  border-radius: 5px;
  padding: 3px 5px;
  line-height: 1;
}
.quality-mark.high {
  color: #338367;
  border-color: #80bba2;
}
.quality-mark.lossless {
  color: #b3873c;
  border-color: #d3b274;
}
.quality-copy {
  flex: 1;
}
.quality-selected {
  font-size: 23px;
  color: var(--qqm-primary-strong);
}
.quality-unselected {
  height: 19px;
  width: 19px;
  border: 1px solid var(--qqm-border);
  border-radius: 50%;
}
.quality-note {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  line-height: 1.7;
  padding: 20px 22px 9px;
}
</style>
