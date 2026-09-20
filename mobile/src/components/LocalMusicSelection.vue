<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import SheetFrame from '@/components/SheetFrame.vue';
import { filterLocalMusic, type LocalMusicFilter } from '@/services/localMusicFilter';
import type { Track } from '@/services/musicApi';
import { readStorage, writeStorage } from '@/stores/library';
import { formatTime } from '@/stores/player';

const props = defineProps<{ tracks: Track[]; busy: boolean; error: string }>();
const emit = defineEmits<{ close: []; import: [tracks: Track[]] }>();
const saved = readStorage<LocalMusicFilter>('localMusicFilter', {
  minimumDuration: 0,
  minimumSize: 0
});
const durations = [0, 30, 60, 120];
const sizes = [0, 100 * 1024, 1024 * 1024];
const minimumDuration = shallowRef(
  durations.includes(saved.minimumDuration) ? saved.minimumDuration : 0
);
const minimumSize = shallowRef(sizes.includes(saved.minimumSize) ? saved.minimumSize : 0);
const keyword = shallowRef('');
const selected = shallowRef(new Set<string>());
const shown = shallowRef(60);
const filtered = computed(() =>
  filterLocalMusic(
    props.tracks,
    {
      minimumDuration: minimumDuration.value,
      minimumSize: minimumSize.value
    },
    keyword.value
  )
);
const visible = computed(() => filtered.value.slice(0, shown.value));
const selectedTracks = computed(() =>
  filtered.value.filter((track) => selected.value.has(track.id))
);
const allSelected = computed(
  () => filtered.value.length > 0 && selectedTracks.value.length === filtered.value.length
);
watch([minimumDuration, minimumSize], () =>
  writeStorage('localMusicFilter', {
    minimumDuration: minimumDuration.value,
    minimumSize: minimumSize.value
  })
);
watch(filtered, (tracks) => {
  const ids = new Set(tracks.map((track) => track.id));
  selected.value = new Set([...selected.value].filter((id) => ids.has(id)));
  shown.value = 60;
});
function toggle(id: string) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
}
function fileSize(value?: number) {
  if (!value || value < 0) return '大小未知';
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(value / 1024)} KB`;
}
</script>

<template>
  <sheet-frame title="选择要添加的音乐" @close="emit('close')">
    <view class="scan-filters">
      <input
        v-model="keyword"
        class="field-input"
        placeholder="搜索歌曲、歌手或专辑"
        aria-label="筛选本机音乐"
      />
      <view class="filter-line">
        <text class="filter-label">时长</text>
        <view class="filter-options">
          <button
            v-for="value in durations"
            :key="value"
            role="button"
            :aria-pressed="minimumDuration === value"
            :class="['filter-chip', { active: minimumDuration === value }]"
            @click="minimumDuration = value"
          >
            {{ value === 0 ? '不限' : `至少 ${value < 60 ? value + ' 秒' : value / 60 + ' 分钟'}` }}
          </button>
        </view>
      </view>
      <view class="filter-line">
        <text class="filter-label">大小</text>
        <view class="filter-options">
          <button
            v-for="value in sizes"
            :key="value"
            role="button"
            :aria-pressed="minimumSize === value"
            :class="['filter-chip', { active: minimumSize === value }]"
            @click="minimumSize = value"
          >
            {{ value === 0 ? '不限' : `至少 ${fileSize(value)}` }}
          </button>
        </view>
      </view>
      <text class="filter-summary"
        >共 {{ tracks.length }} 首 · 符合 {{ filtered.length }} 首<template
          v-if="minimumDuration || minimumSize"
        >
          · 未知时长或大小按对应条件过滤</template
        ></text
      >
    </view>
    <view class="selection-tools">
      <button
        role="button"
        class="text-button"
        :disabled="busy || !filtered.length"
        @click="selected = allSelected ? new Set() : new Set(filtered.map((track) => track.id))"
      >
        {{ allSelected ? '取消全选' : '全选结果' }}
      </button>
      <text>已选 {{ selectedTracks.length }} 首</text>
      <button
        role="button"
        class="primary-button"
        :disabled="!selectedTracks.length || busy"
        @click="emit('import', selectedTracks)"
      >
        添加所选
      </button>
    </view>
    <view v-if="busy" class="state-box"><text class="spinner" /><view>正在读取本地音乐</view></view>
    <view v-else-if="error" class="state-box">{{ error }}</view>
    <template v-else>
      <button
        v-for="track in visible"
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
        />
        <view class="candidate-info"
          ><text class="ellipsis">{{ track.title }}</text>
          <text class="candidate-detail ellipsis"
            >{{ track.artist }} · {{ fileSize(track.fileSize) }}</text
          ></view
        >
        <text class="candidate-duration">{{
          track.duration > 0 ? formatTime(track.duration) : '时长未知'
        }}</text>
      </button>
      <button
        v-if="shown < filtered.length"
        role="button"
        class="text-button load-more"
        @click="shown += 60"
      >
        继续查看
      </button>
      <view v-if="!filtered.length" class="state-box">{{
        tracks.length
          ? '没有符合条件的音乐，试试放宽时长或大小限制。'
          : '尚未找到音频文件，可以换一个文件夹选择。'
      }}</view>
    </template>
  </sheet-frame>
</template>

<style scoped>
.scan-filters {
  padding: 0 22px 16px;
}
.scan-filters .field-input {
  width: 100%;
  margin-bottom: 16px;
}
.filter-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
.filter-label {
  font-size: 12px;
  color: var(--qqm-muted);
  flex-shrink: 0;
}
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filter-chip {
  padding: 8px 11px !important;
  border-radius: 9px !important;
  font-size: 12px !important;
  background: var(--qqm-surface-muted) !important;
}
.filter-chip.active {
  background: var(--qqm-primary-soft) !important;
  color: var(--qqm-accent-text) !important;
}
.filter-summary {
  display: block;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.8;
  margin-top: 12px;
}
.selection-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  border-top: 1px solid var(--qqm-border);
}
.selection-tools > text {
  flex: 1;
  color: var(--qqm-muted);
  font-size: 12px;
}
.selection-tools .primary-button {
  padding: 0 16px;
}
.local-candidate {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 13px 22px !important;
  gap: 12px;
}
.local-candidate > text:first-child {
  font-size: 22px;
  color: var(--qqm-muted);
}
.local-candidate > text.selected {
  color: var(--qqm-accent-text);
}
.candidate-info {
  flex: 1;
  min-width: 0;
}
.candidate-info > text {
  display: block;
  font-size: 14px;
}
.candidate-detail {
  color: var(--qqm-muted);
  font-size: 11px !important;
  margin-top: 5px;
}
.candidate-duration {
  color: var(--qqm-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.load-more {
  margin: 12px 22px !important;
}
</style>
