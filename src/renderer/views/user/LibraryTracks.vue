<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isDesktopRuntime } from '@/utils';

import LibrarySongRow from './LibrarySongRow.vue';

const props = defineProps<{
  songs: SongResult[];
  kind: 'favorites' | 'history' | 'podcasts';
  loading?: boolean;
  missingCount?: number;
}>();
const emit = defineEmits<{ retry: []; remove: [song: SongResult] }>();
const router = useRouter();
const player = usePlayerStore();
const query = shallowRef('');
const sort = shallowRef('recent');
const selected = shallowRef(new Set<string | number>());
const selecting = shallowRef(false);
const downloading = shallowRef(false);
const shown = shallowRef(80);
const filtered = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  let list = props.songs.filter(
    (song) =>
      !keyword ||
      [song.name, (song.ar || song.artists || []).map((a) => a.name).join(' '), song.al?.name]
        .join(' ')
        .toLocaleLowerCase()
        .includes(keyword)
  );
  if (sort.value === 'oldest') list = [...list].reverse();
  if (sort.value === 'count') list = [...list].sort((a, b) => (b.count || 0) - (a.count || 0));
  return list;
});
const visible = computed(() => filtered.value.slice(0, shown.value));
const chosen = computed(() => filtered.value.filter((song) => selected.value.has(song.id)));
const allSelected = computed(
  () => filtered.value.length > 0 && chosen.value.length === filtered.value.length
);
watch([query, sort, () => props.kind], () => {
  shown.value = 80;
});
watch(
  () => props.kind,
  () => {
    query.value = '';
    sort.value = 'recent';
    selected.value = new Set();
    selecting.value = false;
  }
);
function select(id: string | number) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
}
async function play(song?: SongResult) {
  if (!song) song = filtered.value[0];
  if (!song) return;
  // 所有播放入口共用当前筛选后的列表，先设置队列，再发起一次播放请求。
  player.setPlayList([...filtered.value]);
  await player.setPlay(song);
}
async function downloadSelected() {
  if (downloading.value || !chosen.value.length) return;
  downloading.value = true;
  try {
    const { useDownload } = await import('@/hooks/useDownload');
    await useDownload().batchDownloadMusic(chosen.value);
    selecting.value = false;
    selected.value = new Set();
  } finally {
    downloading.value = false;
  }
}
function onScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 250) shown.value += 60;
}
</script>

<template>
  <section class="library-tracks">
    <div class="library-toolbar">
      <button class="library-play" :disabled="!filtered.length" @click="play()">
        <i class="ri-play-fill" />播放全部
      </button>
      <button v-if="isDesktopRuntime" class="library-secondary" @click="selecting = !selecting">
        <i class="ri-download-2-line" />{{ selecting ? '完成选择' : '批量下载' }}
      </button>
      <span class="library-result-count">{{
        query ? `找到 ${filtered.length} 首` : `${songs.length} 首歌曲`
      }}</span>
      <div class="library-tools">
        <select v-model="sort" aria-label="歌曲排序">
          <option value="recent">{{ kind === 'favorites' ? '最近收藏' : '最近播放' }}</option>
          <option v-if="kind === 'favorites'" value="oldest">最早收藏</option>
          <option v-else value="count">播放次数</option>
        </select>
        <label class="library-search"
          ><i class="ri-search-line" aria-hidden="true" /><input
            v-model="query"
            placeholder="搜索此列表"
            aria-label="搜索此列表" /><button
            v-if="query"
            aria-label="清空列表搜索"
            @click="query = ''"
          >
            <i class="ri-close-line" /></button
        ></label>
      </div>
    </div>
    <div v-if="selecting" class="library-selection">
      <label
        ><input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="chosen.length > 0 && !allSelected"
          @change="selected = allSelected ? new Set() : new Set(filtered.map((song) => song.id))"
        />全选结果</label
      ><span>已选 {{ chosen.length }} 首</span
      ><button :disabled="!chosen.length || downloading" @click="downloadSelected">
        {{ downloading ? '正在加入下载' : '下载所选' }}
      </button>
    </div>
    <div v-if="missingCount" class="library-notice" role="status">
      {{
        loading
          ? '正在补齐收藏歌曲信息…'
          : `${missingCount} 首收藏暂未加载，已有歌曲可以正常播放。`
      }}<button v-if="!loading" @click="emit('retry')">重新加载</button>
    </div>
    <div class="library-table-head library-columns" aria-hidden="true">
      <span>#</span><span>歌曲</span><span class="artist-heading">歌手</span
      ><span class="album-heading">专辑</span><span>时长</span><span />
    </div>
    <div class="library-song-scroll" @scroll.passive="onScroll">
      <library-song-row
        v-for="(song, index) in visible"
        :key="song.id"
        :song="song"
        :index="index"
        :history="kind !== 'favorites'"
        :selecting="selecting"
        :selected="selected.has(song.id)"
        @play="play"
        @select="select"
        @remove="emit('remove', $event)"
      />
      <div v-if="loading && !songs.length" class="library-empty" role="status">
        <i class="ri-loader-4-line library-spinner" />
        <h2>正在整理你的音乐</h2>
        <p>收藏仍在这里，稍等片刻。</p>
      </div>
      <div v-else-if="!filtered.length" class="library-empty">
        <i
          :class="
            query ? 'ri-search-2-line' : kind === 'favorites' ? 'ri-heart-line' : 'ri-history-line'
          "
          aria-hidden="true"
        />
        <h2>
          {{
            query
              ? '没有找到这首歌'
              : missingCount
                ? '收藏信息暂未加载'
                : kind === 'favorites'
                  ? '把喜欢的旋律收藏在这里'
                  : '下一次重逢，从这里开始'
          }}
        </h2>
        <p>
          {{
            query
              ? '试试歌名、歌手或专辑中的其他关键词。'
              : missingCount
                ? '收藏记录仍然保留，连接网络后可以重新加载。'
                : kind === 'favorites'
                  ? '听到喜欢的歌，点一下爱心，下次就能轻松找到。'
                  : '播放过的歌曲会自动留下，随时回来继续听。'
          }}
        </p>
        <button
          class="library-secondary"
          @click="query ? (query = '') : missingCount ? emit('retry') : router.push('/')"
        >
          {{ query ? '清空搜索' : missingCount ? '重新加载' : '去发现音乐'
          }}<i class="ri-arrow-right-line" />
        </button>
      </div>
      <button v-if="shown < filtered.length" class="library-load-more" @click="shown += 80">
        继续查看 · 还有 {{ filtered.length - shown }} 首
      </button>
    </div>
  </section>
</template>

<style scoped>
.library-tracks {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.library-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 22px 0 20px;
  flex-wrap: wrap;
}
.library-play,
.library-secondary {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 0 18px;
  border-radius: 22px;
  font-size: 13px;
  white-space: nowrap;
}
.library-play {
  background: var(--qqm-primary);
  color: #093c25;
  font-weight: 600;
}
.library-play i {
  font-size: 20px;
}
.library-play:hover {
  background: var(--qqm-primary-strong);
  color: white;
}
.library-secondary {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}
.library-secondary:hover {
  border-color: var(--qqm-primary);
  color: var(--qqm-primary-strong);
}
.library-result-count {
  color: var(--qqm-muted);
  font-size: 12px;
  margin-left: 4px;
}
.library-tools {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}
.library-tools select {
  border: 0;
  background: var(--qqm-bg);
  color: var(--qqm-muted);
  font: inherit;
  font-size: 12px;
  max-width: 110px;
  cursor: pointer;
}
.library-search {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  width: 196px;
  background: var(--qqm-surface-muted);
  border-radius: 20px;
  color: var(--qqm-muted);
}
.library-search input {
  min-width: 0;
  width: 100%;
  background: transparent;
  font-size: 12px;
  border: 0;
  outline: none;
  color: var(--qqm-text);
}
.library-search:focus-within {
  box-shadow: 0 0 0 1px var(--qqm-primary);
}
.library-song-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--qqm-border) transparent;
  padding-bottom: 18px;
}
.library-table-head {
  color: var(--qqm-muted);
  font-size: 11px;
  min-height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid var(--qqm-border);
  margin-bottom: 5px;
}
.library-table-head > span:first-child {
  text-align: center;
}
.library-selection,
.library-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  color: var(--qqm-muted);
  font-size: 12px;
  padding: 12px 0;
}
.library-selection label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.library-selection input {
  accent-color: var(--qqm-primary-strong);
}
.library-selection button,
.library-notice button {
  color: var(--qqm-primary-strong);
}
.library-empty {
  min-height: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 32px 20px;
}
.library-empty > i {
  font-size: 45px;
  font-weight: 300;
  color: color-mix(in srgb, var(--qqm-primary-strong) 48%, var(--qqm-border));
  margin-bottom: 8px;
}
.library-empty h2 {
  font-size: 17px;
  font-weight: 500;
  margin: 0;
}
.library-empty p {
  color: var(--qqm-muted);
  font-size: 12px;
  margin: 0 0 8px;
}
.library-load-more {
  display: block;
  padding: 14px;
  margin: 12px auto;
  color: var(--qqm-muted);
  font-size: 12px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.library-spinner {
  animation: library-spin 1s linear infinite;
}
@keyframes library-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 1000px) {
  .album-heading {
    display: none;
  }
}
@media (max-width: 720px) {
  .artist-heading {
    display: none;
  }
  .library-tools {
    flex: 1 0 100%;
  }
  .library-search {
    margin-left: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .library-spinner {
    animation: none;
  }
}
</style>
