<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import SheetFrame from '@/components/SheetFrame.vue';
import TrackList from '@/components/TrackList.vue';
import type { Track } from '@/services/musicApi';
import { nativeDevice } from '@/services/nativeDevice';
import {
  chooseLocalMusic,
  importLocalTracks,
  localBusy,
  localCandidates,
  localError,
  localSelectionOpen,
  localTracks,
  scanLocalMusic
} from '@/stores/localMusic';
import { playTracks } from '@/stores/player';
const emit = defineEmits<{ more: [track: Track] }>();
const keyword = shallowRef('');
const selected = shallowRef(new Set<string>());
const shown = shallowRef(60);
const canScan = Boolean(nativeDevice());
const visible = computed(() =>
  localTracks.value.filter((track) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(keyword.value.toLowerCase())
  )
);
const candidates = computed(() => localCandidates.value.slice(0, shown.value));
watch(localCandidates, () => {
  selected.value = new Set();
  shown.value = 60;
});
function toggle(id: string) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
}
function toggleAll() {
  selected.value =
    selected.value.size === localCandidates.value.length
      ? new Set()
      : new Set(localCandidates.value.map((track) => track.id));
}
</script>
<template>
  <view class="local-view"
    ><view class="local-intro"
      ><text class="local-title">把喜欢的音乐，留在身边</text
      ><text class="local-description">本机文件与互传收到的音乐，勾选后添加到这里。</text
      ><view class="local-actions"
        ><button
          v-if="canScan"
          role="button"
          class="primary-button"
          :disabled="localBusy"
          @click="scanLocalMusic"
        >
          <text class="ri-search-2-line" />扫描本机</button
        ><button role="button" class="choose-files" @click="chooseLocalMusic">
          <text class="ri-folder-music-line" />选择文件
        </button></view
      ></view
    >
    <view v-if="localTracks.length" class="local-toolbar"
      ><button role="button" class="local-play-all" @click="playTracks(visible)">
        <text class="ri-play-circle-fill" />播放全部
        <text class="muted">{{ visible.length }} 首</text></button
      ><input v-model="keyword" class="field-input" placeholder="查找本地歌曲"
    /></view>
    <scroll-view scroll-y class="local-scroll"
      ><track-list :tracks="visible" @more="emit('more', $event)" /><view
        v-if="!localTracks.length"
        class="local-empty"
        ><text class="ri-disc-line" /><text>还没有添加本地音乐</text
        ><text>扫描本机，或从系统文件选择器添加歌曲。</text></view
      ><view class="content-bottom"
    /></scroll-view>
  </view>
  <sheet-frame
    v-if="localSelectionOpen"
    title="选择要添加的音乐"
    @close="localSelectionOpen = false"
    ><view class="selection-tools"
      ><button role="button" class="text-button" @click="toggleAll">
        {{
          selected.size === localCandidates.length && localCandidates.length ? '取消全选' : '全选'
        }}</button
      ><text>已选 {{ selected.size }} / {{ localCandidates.length }}</text
      ><button
        role="button"
        class="primary-button"
        :disabled="!selected.size || localBusy"
        @click="importLocalTracks(localCandidates.filter((track) => selected.has(track.id)))"
      >
        添加所选
      </button></view
    >
    <view v-if="localBusy" class="state-box"
      ><text class="spinner" /><view>正在读取本地音乐</view></view
    ><view v-if="localError" class="state-box">{{ localError }}</view>
    <button
      v-for="track in candidates"
      :key="track.id"
      role="checkbox"
      :aria-checked="selected.has(track.id)"
      class="local-candidate"
      @click="toggle(track.id)"
    >
      <text
        :class="
          selected.has(track.id)
            ? 'ri-checkbox-circle-fill selected'
            : 'ri-checkbox-blank-circle-line'
        "
      /><view
        ><text class="ellipsis">{{ track.title }}</text
        ><text class="candidate-artist ellipsis">{{ track.artist }}</text></view
      >
    </button>
    <button
      role="button"
      v-if="shown < localCandidates.length"
      class="text-button"
      @click="shown += 60"
    >
      继续查看</button
    ><view v-if="!localBusy && !localError && !localCandidates.length" class="state-box"
      >尚未找到音频文件，可以换一个文件夹选择。</view
    >
  </sheet-frame>
</template>
<style scoped>
.local-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.local-intro {
  padding: 24px var(--page-gutter);
}
.local-title {
  display: block;
  font-size: calc(23px + var(--font-size-adjustment));
  font-weight: 600;
}
.local-description {
  display: block;
  color: var(--qqm-muted);
  font-size: 13px;
  line-height: 1.8;
  margin: 13px 0 20px;
}
.local-actions {
  display: flex;
  gap: 12px;
}
.choose-files {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--qqm-surface) !important;
  border-radius: 24px !important;
  padding: 12px 20px !important;
  font-size: 14px !important;
}
.local-toolbar {
  display: flex;
  align-items: center;
  padding: 12px var(--page-gutter);
  gap: 15px;
  flex-wrap: wrap;
}
.local-play-all {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px !important;
  min-height: 48px;
}
.local-play-all > text:first-child {
  font-size: 28px;
  color: var(--qqm-primary);
}
.local-toolbar .field-input {
  flex: 1;
  min-width: 160px;
  max-width: 420px;
}
.local-scroll {
  flex: 1;
  min-height: 0;
}
.local-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 55px 24px;
  color: var(--qqm-muted);
  text-align: center;
}
.local-empty > text:first-child {
  font-size: 46px;
  color: var(--qqm-accent-text);
}
.local-empty > text:last-child {
  font-size: 12px;
  line-height: 1.8;
}
.selection-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 22px 16px;
}
.selection-tools > text {
  font-size: 12px;
  color: var(--qqm-muted);
}
.selection-tools .primary-button {
  padding: 0 18px;
}
.local-candidate {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 14px 22px !important;
  gap: 14px;
}
.local-candidate > text:first-child {
  font-size: 23px;
  color: var(--qqm-muted);
}
.local-candidate > text.selected {
  color: var(--qqm-accent-text);
}
.local-candidate > view {
  min-width: 0;
  flex: 1;
}
.local-candidate > view > text {
  display: block;
  font-size: 14px;
}
.candidate-artist {
  font-size: 11px !important;
  color: var(--qqm-muted);
  margin-top: 6px;
}
</style>
