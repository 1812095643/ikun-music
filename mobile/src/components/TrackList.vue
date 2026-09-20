<script setup lang="ts">
import { computed } from 'vue';

import type { Track } from '@/services/musicApi';
import { current, playNext, playTracks } from '@/stores/player';

import CoverArt from './CoverArt.vue';
const props = withDefaults(
  defineProps<{
    tracks: Track[];
    numbered?: boolean;
    ranking?: boolean;
    compact?: boolean;
    limit?: number;
    positions?: Record<string, number>;
  }>(),
  { numbered: false, ranking: false, compact: false }
);
const emit = defineEmits<{ more: [track: Track] }>();
const visibleTracks = computed(() =>
  props.limit ? props.tracks.slice(0, props.limit) : props.tracks
);
</script>
<template>
  <view class="track-list" :class="{ compact }">
    <view
      v-for="(track, index) in visibleTracks"
      :key="track.id"
      class="track-row"
      :class="{ active: current?.id === track.id }"
    >
      <button
        role="button"
        class="track-main"
        :aria-label="`播放 ${track.title} ${track.artist}`"
        @click="playTracks(tracks, index)"
      >
        <text
          v-if="numbered"
          class="track-number"
          :class="{ podium: ranking && (positions?.[track.id] || index + 1) <= 3 }"
          >{{ positions?.[track.id] || index + 1 }}</text
        >
        <view
          v-if="!numbered || (ranking && (positions?.[track.id] || index + 1) <= 3)"
          class="track-cover"
          ><cover-art :src="track.cover" radius="9px"
        /></view>
        <view class="track-info"
          ><text class="track-name ellipsis">{{ track.title }}</text
          ><text class="track-subtitle ellipsis"
            >{{ track.artist
            }}<text v-if="track.album && !compact"> · {{ track.album }}</text></text
          ></view
        >
        <text v-if="current?.id === track.id" class="track-wave ri-equalizer-line" />
      </button>
      <button
        v-if="!compact && current?.id !== track.id"
        role="button"
        class="button-icon track-next"
        :aria-label="`下一首播放 ${track.title}`"
        @click="playNext(track)"
      >
        <text class="ri-play-list-add-line" />
      </button>
      <button
        role="button"
        class="button-icon track-more"
        :aria-label="`${track.title}的更多操作`"
        @click="emit('more', track)"
      >
        <text class="ri-more-2-fill" />
      </button>
    </view>
  </view>
</template>
<style scoped>
.track-row {
  display: flex;
  align-items: center;
  padding: 10px 9px 10px var(--page-gutter);
  min-height: 77px;
}
.track-main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  text-align: left;
  gap: 12px;
}
.track-cover {
  width: 49px;
  height: 49px;
  flex-shrink: 0;
}
.track-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.track-name {
  font-size: calc(16px + var(--font-size-adjustment));
  font-weight: 500;
  line-height: 1.35;
}
.track-subtitle {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  line-height: 1.35;
}
.track-more,
.track-next {
  width: 44px !important;
  font-size: 21px !important;
  color: var(--qqm-muted);
}
.track-more {
  font-size: 19px !important;
}
.track-number {
  font-size: calc(17px + var(--font-size-adjustment));
  font-variant-numeric: tabular-nums;
  color: var(--qqm-muted);
  width: 23px;
  flex-shrink: 0;
}
.track-number.podium {
  color: #f16d77;
  font-size: calc(25px + var(--font-size-adjustment));
  font-weight: 650;
}
.active .track-name {
  color: var(--qqm-accent-text);
}
.track-wave {
  font-size: 18px;
  color: var(--qqm-primary-strong);
  margin-right: 3px;
}
.track-row:active {
  background: var(--qqm-surface-muted);
}
.compact .track-row {
  min-height: 70px;
  padding-top: 9px;
  padding-bottom: 9px;
}
.compact .track-cover {
  width: 50px;
  height: 50px;
  border-radius: 9px;
  box-shadow: var(--cover-shadow);
}
.compact .track-more {
  width: 44px !important;
}
</style>
