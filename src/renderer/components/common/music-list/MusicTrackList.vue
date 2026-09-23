<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core';
import { NVirtualList } from 'naive-ui';
import { computed, nextTick, shallowRef, watch } from 'vue';

import type { SongResult } from '@/types/music';
import { isDesktopRuntime } from '@/utils';

import MusicListToolbar from './MusicListToolbar.vue';
import MusicTrackRow from './MusicTrackRow.vue';
import { getTrackKey, useMusicList } from './useMusicList';

const props = withDefaults(
  defineProps<{
    songs: SongResult[];
    kind?: 'favorites' | 'history' | 'podcasts' | 'search' | 'playlist' | 'local';
    loading?: boolean;
    error?: string;
    total?: number;
    more?: boolean;
    loadingMore?: boolean;
    scrollable?: boolean;
    canRemove?: boolean;
    defaultOrder?: string;
  }>(),
  { kind: 'playlist', defaultOrder: '默认排序' }
);
const emit = defineEmits<{
  retry: [];
  more: [];
  remove: [song: SongResult];
  play: [song: SongResult];
}>();
const {
  query,
  sort,
  density,
  selecting,
  selected,
  downloading,
  shown,
  filtered,
  visible,
  chosen,
  allSelected,
  currentIndex,
  select,
  selectAll,
  play,
  addToQueue,
  downloadSelected
} = useMusicList(() => props.songs);
const root = shallowRef<HTMLElement>();
const moreButton = shallowRef<HTMLElement>();
const virtualList = shallowRef<InstanceType<typeof NVirtualList>>();
const virtualRows = computed(() =>
  filtered.value.map((song, index) => ({ song, index, key: getTrackKey(song) }))
);
const isHistory = computed(() => props.kind === 'history' || props.kind === 'podcasts');
const hasMoreRows = computed(() => shown.value < filtered.value.length);
const canDownload = computed(() => isDesktopRuntime && props.kind !== 'local');
const emptyTitle = computed(() =>
  query.value
    ? '没有找到这首歌'
    : props.error
      ? '音乐暂未加载'
      : props.kind === 'favorites'
        ? '把喜欢的旋律收藏在这里'
        : isHistory.value
          ? '下一次重逢，从这里开始'
          : props.kind === 'local'
            ? '把本地音乐带到这里'
            : '这里暂时没有歌曲'
);

function showMore() {
  if (hasMoreRows.value) shown.value += 60;
  else if (props.more && !props.loadingMore && !props.error) emit('more');
}
// 只逐步增加可见行，滚动和批量选择始终基于完整数据，不用空白占位撑高页面。
useIntersectionObserver(
  moreButton,
  ([entry]) => {
    if (entry.isIntersecting && !props.loading && !props.loadingMore) showMore();
  },
  { rootMargin: '200px' }
);

async function requestPlay(song = filtered.value[0], restart = false) {
  if (!song) return;
  emit('play', song);
  await play(song, restart);
}
async function locateCurrent() {
  if (currentIndex.value < 0) return;
  if (props.scrollable) {
    virtualList.value?.scrollTo({ index: currentIndex.value, position: 'top' });
    return;
  }
  shown.value = Math.max(shown.value, currentIndex.value + 1);
  await nextTick();
  const rows = root.value?.querySelectorAll<HTMLElement>('[data-track-key]');
  rows?.[currentIndex.value]?.scrollIntoView({
    block: 'center',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  });
}
watch(
  () => props.kind,
  () => {
    query.value = '';
    sort.value = 'original';
    selecting.value = false;
  }
);
defineExpose({
  playAll: () => requestPlay(undefined, true),
  addAllToQueue: () => addToQueue(filtered.value)
});
</script>

<template>
  <section
    ref="root"
    class="music-track-list"
    :class="{ 'is-scrollable': scrollable }"
    aria-label="歌曲列表"
    :aria-busy="loading"
  >
    <div class="music-track-list-heading">
      <music-list-toolbar
        v-model:query="query"
        v-model:sort="sort"
        v-model:selecting="selecting"
        v-model:density="density"
        :count="filtered.length"
        :total="total"
        :loading="loading"
        :current-visible="currentIndex >= 0"
        :default-order="defaultOrder"
        :history="isHistory"
        :favorites="kind === 'favorites'"
        @play="requestPlay(undefined, true)"
        @locate="locateCurrent"
      >
        <template #actions><slot name="actions" /></template>
      </music-list-toolbar>
      <div v-if="selecting" class="music-list-selection" role="group" aria-label="批量操作">
        <label
          ><input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="chosen.length > 0 && !allSelected"
            @change="selectAll"
          />全选{{ more ? '已加载结果' : '结果' }}</label
        >
        <span aria-live="polite">已选 {{ chosen.length }} 首</span>
        <button class="music-list-button" :disabled="!chosen.length" @click="addToQueue()">
          <i aria-hidden="true" class="ri-play-list-add-line" />加入播放队列
        </button>
        <button
          v-if="canDownload"
          class="music-list-button"
          :disabled="!chosen.length || downloading"
          @click="downloadSelected"
        >
          <i aria-hidden="true" class="ri-download-2-line" />{{
            downloading ? '正在加入下载' : '下载所选'
          }}
        </button>
        <button class="selection-cancel" @click="selecting = false">取消</button>
      </div>
      <slot name="notice" />
      <div class="music-track-head music-track-columns" aria-hidden="true">
        <span>#</span><span>歌曲</span><span class="music-track-artist">歌手</span
        ><span class="music-track-album">专辑</span><span>时长</span><span />
      </div>
    </div>
    <n-virtual-list
      v-if="scrollable && filtered.length"
      ref="virtualList"
      class="music-track-virtual"
      :items="virtualRows"
      :item-size="density === 'compact' ? 50 : 64"
      key-field="key"
    >
      <template #default="{ item }">
        <music-track-row
          :song="item.song"
          :index="item.index"
          :selecting="selecting"
          :selected="selected.has(item.key)"
          :compact="density === 'compact'"
          :history="isHistory"
          :can-remove="canRemove"
          :local="kind === 'local'"
          @play="requestPlay"
          @select="select"
          @remove="emit('remove', $event)"
        />
      </template>
    </n-virtual-list>
    <div v-else class="music-track-scroll">
      <div
        v-if="loading && !songs.length"
        class="music-list-skeleton"
        role="status"
        aria-label="正在加载歌曲"
      >
        <div v-for="row in 8" :key="row" class="music-track-columns">
          <span />
          <div class="skeleton-title"><span class="skeleton-cover" /><span /></div>
          <span class="music-track-artist" /><span class="music-track-album" /><span /><span />
        </div>
      </div>
      <template v-else>
        <music-track-row
          v-for="(song, index) in visible"
          :key="getTrackKey(song)"
          :song="song"
          :index="index"
          :selecting="selecting"
          :selected="selected.has(getTrackKey(song))"
          :compact="density === 'compact'"
          :history="isHistory"
          :can-remove="canRemove"
          :local="kind === 'local'"
          @play="requestPlay"
          @select="select"
          @remove="emit('remove', $event)"
        />
        <div v-if="!filtered.length" class="music-list-empty">
          <i
            :class="
              query
                ? 'ri-search-2-line'
                : error
                  ? 'ri-wifi-off-line'
                  : kind === 'favorites'
                    ? 'ri-heart-line'
                    : isHistory
                      ? 'ri-history-line'
                      : 'ri-music-2-line'
            "
            aria-hidden="true"
          />
          <h2>{{ emptyTitle }}</h2>
          <p>
            {{
              query ? '试试歌名、歌手、专辑或拼音。' : error || '找到喜欢的音乐，随时回来继续听。'
            }}
          </p>
          <button v-if="query" class="music-list-button" @click="query = ''">清空搜索</button>
          <button v-else-if="error" class="music-list-button" @click="emit('retry')">
            重新加载
          </button>
          <slot v-else name="empty-action" />
        </div>
        <div v-if="error && songs.length" class="music-list-notice" role="status">
          {{ error }}<button @click="emit('retry')">重新加载</button>
        </div>
        <button
          v-if="hasMoreRows || more"
          ref="moreButton"
          class="music-list-more"
          :disabled="loadingMore"
          @click="showMore"
        >
          <i aria-hidden="true" v-if="loadingMore" class="ri-loader-4-line" />{{
            loadingMore
              ? '正在加载更多歌曲…'
              : hasMoreRows
                ? `继续查看 · 还有 ${filtered.length - shown} 首`
                : '加载更多歌曲'
          }}
        </button>
      </template>
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.music-track-list {
  container: music-tracks / inline-size;
  min-width: 0;
  color: var(--qqm-text);
}
.music-track-list.is-scrollable {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.music-track-list-heading {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--qqm-bg);
}
.music-track-head {
  min-height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid var(--qqm-border);
  margin-bottom: 5px;
  color: var(--qqm-muted);
  font-size: 11px;
}
.music-track-head > span:first-child {
  text-align: center;
}
.is-scrollable .music-track-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--qqm-border) transparent;
  scrollbar-gutter: stable;
}
.music-track-scroll {
  padding-bottom: 18px;
}
.music-track-virtual {
  flex: 1;
  min-height: 0;
  padding-bottom: 18px;
  scrollbar-width: thin;
}
.music-list-selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 0 0 16px;
  color: var(--qqm-muted);
  font-size: 12px;
}
.music-list-selection label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.music-list-selection input {
  accent-color: var(--qqm-primary-strong);
  width: 16px;
  height: 16px;
}
.music-list-selection .music-list-button {
  height: 30px;
  font-size: 12px;
  padding: 0 12px;
}
.selection-cancel {
  margin-left: auto;
}
.music-list-empty {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px 20px;
  text-align: center;
}
.music-list-empty > i {
  font-size: 45px;
  color: color-mix(in srgb, var(--qqm-primary-strong) 48%, var(--qqm-border));
  margin-bottom: 8px;
}
.music-list-empty h2 {
  font-size: 17px;
  font-weight: 500;
  margin: 0;
}
.music-list-empty p {
  font-size: 12px;
  color: var(--qqm-muted);
  margin: 0 0 8px;
}
.music-list-more {
  display: block;
  margin: 16px auto 0;
  padding: 14px 20px;
  font-size: 12px;
  color: var(--qqm-muted);
}
.music-list-more:hover,
.selection-cancel:hover {
  color: var(--qqm-primary-strong);
}
.music-list-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  font-size: 12px;
  color: var(--qqm-muted);
}
.music-list-notice button {
  color: var(--qqm-primary-strong);
}
.music-list-skeleton > div {
  min-height: 64px;
  padding: 9px 12px;
}
.music-list-skeleton span {
  display: block;
  height: 10px;
  width: 65%;
  border-radius: 4px;
  background: var(--qqm-surface-muted);
}
.skeleton-title {
  display: flex;
  align-items: center;
  gap: 13px;
}
.skeleton-title .skeleton-cover {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 6px;
}
</style>
