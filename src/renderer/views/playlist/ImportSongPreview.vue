<script setup lang="ts">
import { computed } from 'vue';

import type { SongResult } from '@/types/music';

import type { ImportMatch, PlaylistImportSong } from '../../../shared/playlistImport';

const props = defineProps<{
  songs: PlaylistImportSong[];
  matches: Array<ImportMatch<SongResult> | undefined>;
  selected: Set<number>;
  allSelected: boolean;
  reviewing: boolean;
  busy: boolean;
  matching: boolean;
}>();
defineEmits<{ toggle: [index: number]; all: [] }>();
const rows = computed(() =>
  props.songs.map((song, index) => ({ song, index, match: props.matches[index] }))
);
</script>
<template>
  <div class="import-preview-card">
    <div class="preview-toolbar">
      <label
        ><input
          type="checkbox"
          aria-label="全选歌曲"
          :checked="allSelected"
          :indeterminate="selected.size > 0 && !allSelected"
          :disabled="busy"
          @change="$emit('all')"
        />全选歌曲</label
      ><span aria-live="polite">已选 {{ selected.size }} / {{ songs.length }} 首</span>
    </div>
    <div class="preview-columns preview-head" aria-hidden="true">
      <span /><span>#</span><span>歌曲</span><span>歌手 / 专辑</span><span>状态</span>
    </div>
    <n-virtual-list class="import-preview-list" :items="rows" :item-size="54" key-field="index">
      <template #default="{ item }">
        <label
          class="import-preview-row preview-columns"
          :class="{ selected: selected.has(item.index) }"
        >
          <input
            type="checkbox"
            :checked="selected.has(item.index)"
            :aria-label="`选择 ${item.song.name}`"
            :disabled="busy || (reviewing && !item.match?.track)"
            @change="$emit('toggle', item.index)"
          />
          <span class="preview-index">{{ String(item.index + 1).padStart(2, '0') }}</span>
          <span class="preview-name" :title="item.song.name">{{
            item.match?.track?.name || item.song.name
          }}</span>
          <span class="preview-meta" :title="`${item.song.artist} · ${item.song.album}`"
            >{{ item.song.artist }}<small>{{ item.song.album }}</small></span
          >
          <span class="preview-status" :class="{ exact: item.match?.exact }">{{
            matching && !item.match
              ? '等待匹配'
              : item.match?.exact
                ? '已匹配'
                : item.match?.track
                  ? '请核对候选'
                  : reviewing
                    ? '暂未匹配'
                    : item.song.duration
                      ? `${Math.floor(item.song.duration / 60000)}:${String(Math.floor(item.song.duration / 1000) % 60).padStart(2, '0')}`
                      : '待选择'
          }}</span>
        </label>
      </template>
    </n-virtual-list>
  </div>
</template>
<style scoped>
.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px 0;
  color: var(--qqm-muted);
  font-size: 12px;
}
.preview-toolbar label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--qqm-text);
  cursor: pointer;
}
.preview-columns {
  display: grid;
  grid-template-columns: 18px 28px minmax(120px, 1.2fr) minmax(110px, 1fr) 78px;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
}
.preview-head {
  min-height: 34px;
  border-bottom: 1px solid var(--qqm-border);
  color: var(--qqm-muted);
  font-size: 11px;
}
.import-preview-list {
  height: 340px;
}
.import-preview-row {
  height: 54px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 7px;
}
.import-preview-row:hover {
  background: var(--qqm-surface-muted);
}
.import-preview-row.selected {
  background: color-mix(in srgb, var(--qqm-primary-soft) 40%, transparent);
}
.preview-index,
.preview-status,
.preview-meta {
  color: var(--qqm-muted);
  font-size: 11px;
}
.preview-name,
.preview-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-meta small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-status.exact {
  color: var(--qqm-primary-strong);
}
input {
  accent-color: var(--qqm-primary-strong);
  width: 15px;
  height: 15px;
}
input:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 3px;
}
@media (max-width: 650px) {
  .preview-columns {
    grid-template-columns: 18px 20px minmax(90px, 1fr) minmax(75px, 0.8fr) 64px;
    gap: 7px;
    padding: 0 5px;
  }
  .preview-status {
    font-size: 10px;
  }
}
</style>
