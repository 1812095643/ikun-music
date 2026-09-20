<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import CoverArt from '@/components/CoverArt.vue';
import { pauseDownload, retryDownload } from '@/services/downloads';
import { qualities, type Track } from '@/services/musicApi';
import { enterSearch } from '@/stores/browse';
import { type DownloadRecord, downloadRecords, toast } from '@/stores/library';
import { changeQuality, playTracks } from '@/stores/player';
const emit = defineEmits<{ more: [track: Track] }>();
const tab = shallowRef<'completed' | 'transfers'>('completed');
const completed = computed(() =>
  downloadRecords.value.filter((item) => item.state === 'completed')
);
const transfers = computed(() =>
  downloadRecords.value.filter((item) => item.state !== 'completed')
);
const records = computed(() => (tab.value === 'completed' ? completed.value : transfers.value));
const active = computed(() =>
  transfers.value.some((item) => ['queued', 'downloading'].includes(item.state))
);
const labels = {
  queued: '等待下载',
  downloading: '正在下载',
  completed: '已下载',
  paused: '已暂停',
  error: '下载中断'
};
function play(record: DownloadRecord) {
  if (record.state !== 'completed') return;
  changeQuality(record.quality);
  playTracks([record.track]);
}
function control(record: DownloadRecord) {
  if (['downloading', 'queued'].includes(record.state)) pauseDownload(record.id);
  else retryDownload(record);
}
function all() {
  if (active.value)
    transfers.value
      .filter((item) => ['downloading', 'queued'].includes(item.state))
      .forEach((item) => pauseDownload(item.id));
  else transfers.value.forEach(retryDownload);
}
</script>
<template>
  <view class="downloads-view"
    ><view class="download-tabs"
      ><button
        v-for="item in [
          { key: 'completed', label: '已下载', count: completed.length },
          { key: 'transfers', label: '下载中', count: transfers.length }
        ]"
        :key="item.key"
        role="button"
        :class="{ selected: tab === item.key }"
        @click="tab = item.key as typeof tab"
      >
        {{ item.label }}<text>{{ item.count }}</text>
      </button></view
    ><scroll-view scroll-y class="downloads-scroll"
      ><view class="download-description"
        ><text>{{
          tab === 'completed' ? '保存到这台设备，随时聆听' : '下载完成后，即可在本机播放'
        }}</text
        ><button
          v-if="tab === 'transfers' && transfers.length"
          role="button"
          class="text-button"
          @click="all"
        >
          {{ active ? '全部暂停' : '全部开始' }}
        </button></view
      ><view v-if="!records.length" class="download-empty"
        ><view class="download-empty-icon"><text class="ri-download-cloud-2-line" /></view
        ><text class="download-empty-title">{{
          tab === 'completed' ? '把喜欢的音乐带在身边' : '暂时没有下载任务'
        }}</text
        ><text class="download-empty-copy">{{
          tab === 'completed'
            ? '在歌曲菜单中选择音质下载，没网络时也能继续听。'
            : '找到喜欢的歌，就把它收藏到本机。'
        }}</text
        ><button role="button" class="primary-button" @click="enterSearch">去找音乐</button></view
      ><view v-for="record in records" :key="record.id" class="download-row"
        ><view class="download-cover"><cover-art :src="record.track.cover" radius="10px" /></view
        ><button
          role="button"
          class="download-info"
          :aria-label="
            record.state === 'completed' ? `播放 ${record.track.title}` : record.track.title
          "
          @click="play(record)"
        >
          <text class="download-name ellipsis">{{ record.track.title }}</text
          ><text class="download-artist ellipsis">{{ record.track.artist }}</text
          ><view class="download-metadata"
            ><text class="download-quality">{{
              qualities.find((item) => item.key === record.quality)?.label
            }}</text
            ><text>{{ record.format?.toUpperCase() || labels[record.state] }}</text
            ><text v-if="record.state === 'downloading'">{{ record.progress }}%</text
            ><text v-if="record.state === 'paused' || record.state === 'error'">{{
              labels[record.state]
            }}</text></view
          ><view v-if="record.state === 'downloading'" class="download-progress"
            ><view :style="{ transform: `scaleX(${record.progress / 100})` }"
          /></view></button
        ><button
          role="button"
          class="button-icon download-control"
          :aria-label="
            record.state === 'completed'
              ? '歌曲操作'
              : ['downloading', 'queued'].includes(record.state)
                ? '暂停下载'
                : '重新下载'
          "
          @click="record.state === 'completed' ? emit('more', record.track) : control(record)"
        >
          <text
            :class="
              record.state === 'completed'
                ? 'ri-more-2-fill'
                : ['downloading', 'queued'].includes(record.state)
                  ? 'ri-pause-circle-line'
                  : 'ri-play-circle-line'
            "
          /></button></view
      ><view class="content-bottom" /></scroll-view
  ></view>
</template>
<style scoped>
.downloads-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.download-tabs {
  display: flex;
  gap: 29px;
  padding: 7px 23px 0;
  height: 48px;
  border-bottom: 1px solid var(--qqm-border);
  flex-shrink: 0;
}
.download-tabs button {
  position: relative;
  height: 40px;
  font-size: calc(17px + var(--font-size-adjustment)) !important;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.download-tabs button > text {
  font-size: calc(13px + var(--font-size-adjustment));
  padding-top: 3px;
}
.download-tabs button.selected {
  color: var(--qqm-accent-text) !important;
  font-weight: 600 !important;
}
.download-tabs button.selected::before {
  content: '';
  position: absolute;
  bottom: 5px;
  left: 18px;
  width: 23px;
  height: 3px;
  border-radius: 3px;
  background: var(--qqm-primary);
}
.downloads-scroll {
  flex: 1;
  min-height: 0;
}
.download-description {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 57px;
  padding: 12px 22px;
  color: var(--qqm-muted);
  font-size: calc(12px + var(--font-size-adjustment));
}
.download-description .text-button {
  font-size: calc(12px + var(--font-size-adjustment)) !important;
  padding: 7px 0 !important;
}
.download-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 54px 28px 32px;
  text-align: center;
  gap: 14px;
}
.download-empty-icon {
  height: 80px;
  width: 80px;
  background: var(--qqm-primary-soft);
  color: var(--qqm-accent-text);
  border-radius: 23px;
  font-size: 39px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.download-empty-title {
  font-size: calc(18px + var(--font-size-adjustment));
  font-weight: 550;
}
.download-empty-copy {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  line-height: 1.9;
  white-space: pre-line;
}
.download-empty .primary-button {
  margin-top: 11px !important;
  font-size: calc(14px + var(--font-size-adjustment)) !important;
  min-height: 43px;
}
.download-row {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 12px 13px 12px 20px;
}
.download-cover {
  height: 57px;
  width: 57px;
  flex-shrink: 0;
}
.download-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 6px;
}
.download-name {
  font-size: calc(16px + var(--font-size-adjustment));
  width: 100%;
}
.download-artist {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  width: 100%;
}
.download-metadata {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--qqm-muted);
}
.download-quality {
  color: var(--qqm-accent-text);
}
.download-progress {
  height: 2px;
  width: 100%;
  background: var(--qqm-border);
  overflow: hidden;
  margin-top: 3px;
}
.download-progress view {
  height: 100%;
  background: var(--qqm-primary);
  transform-origin: left;
  transition: transform 0.2s linear;
}
.download-control {
  font-size: 23px !important;
  color: var(--qqm-muted);
}
</style>
