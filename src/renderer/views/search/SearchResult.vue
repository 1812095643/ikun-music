<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import MusicTrackList from '@/components/common/music-list/MusicTrackList.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SearchItem from '@/components/common/SearchItem.vue';
import { SEARCH_TYPE, SEARCH_TYPES } from '@/const/bar-const';
import { useScrollTitle } from '@/hooks/useScrollTitle';

import { useMusicSearch } from './useMusicSearch';

defineOptions({ name: 'SearchResult' });
const { t } = useI18n();
const {
  keyword,
  searchType,
  result,
  loading,
  loadingMore,
  hasMore,
  error,
  total,
  load,
  changeType
} = useMusicSearch();
const titleElRef = shallowRef<HTMLElement | null>(null);
const scrollbar = shallowRef<{ scrollTo: (options: { top: number }) => void }>();
const tabs = shallowRef<HTMLElement>();
const searchTypes = computed(() =>
  SEARCH_TYPES.map((type) => ({ key: type.key, label: t(type.label) }))
);
useScrollTitle(keyword, titleElRef);
watch([keyword, searchType], () => scrollbar.value?.scrollTo({ top: 0 }));

function handleScroll(event: Event) {
  if (searchType.value === SEARCH_TYPE.MUSIC || error.value) return;
  const target = event.target as HTMLElement;
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 220) void load(true);
}
function changeTab(event: KeyboardEvent, index: number) {
  const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!offset && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? searchTypes.value.length - 1
        : (index + offset + searchTypes.value.length) % searchTypes.value.length;
  changeType(searchTypes.value[target].key);
  tabs.value?.querySelectorAll<HTMLButtonElement>('button')[target]?.focus();
}
</script>

<template>
  <div class="search-result-page">
    <n-scrollbar ref="scrollbar" class="h-full" @scroll="handleScroll">
      <div class="search-result-content">
        <header class="search-heading">
          <p class="search-eyebrow">搜索音乐</p>
          <h1 ref="titleElRef">{{ keyword || '发现喜欢的音乐' }}</h1>
          <p class="search-caption">
            {{ keyword ? '好音乐，从这里开始。' : '输入歌曲、歌手或歌单名称。' }}
          </p>
        </header>
        <div ref="tabs" class="search-tabs" role="tablist" aria-label="搜索分类">
          <button
            v-for="(type, index) in searchTypes"
            :id="`search-tab-${type.key}`"
            :key="type.key"
            role="tab"
            :aria-selected="searchType === type.key"
            aria-controls="search-panel"
            :tabindex="searchType === type.key ? 0 : -1"
            :class="{ active: searchType === type.key }"
            @click="changeType(type.key)"
            @keydown="changeTab($event, index)"
          >
            {{ type.label
            }}<span v-if="searchType === type.key && total && !loading">{{
              total > 999 ? '999+' : total
            }}</span>
          </button>
        </div>
        <section id="search-panel" role="tabpanel" :aria-labelledby="`search-tab-${searchType}`">
          <music-track-list
            v-if="searchType === SEARCH_TYPE.MUSIC"
            :key="keyword"
            :songs="result.songs"
            kind="search"
            default-order="相关度"
            :loading="loading"
            :error="error"
            :total="total"
            :more="hasMore"
            :loading-more="loadingMore"
            @more="load(true)"
            @retry="load(result.songs.length > 0)"
          />
          <template v-else>
            <div
              v-if="loading"
              class="search-card-grid"
              aria-label="正在加载搜索结果"
              aria-busy="true"
            >
              <div v-for="index in 10" :key="index" class="search-card-skeleton" />
            </div>
            <div
              v-else-if="result.items.length"
              class="search-card-grid"
              :class="{ 'is-video': searchType === SEARCH_TYPE.MV }"
            >
              <search-item
                v-for="item in result.items"
                :key="`${item.source}:${item.id}`"
                :item="item"
              />
            </div>
            <div v-else class="search-empty">
              <i aria-hidden="true" :class="error ? 'ri-wifi-off-line' : 'ri-search-2-line'" />
              <h2>{{ error ? '搜索结果暂未加载' : '没有找到相关内容' }}</h2>
              <p>{{ error || '换一个关键词，或试试其他分类。' }}</p>
              <button v-if="error" class="music-list-button" @click="load()">重新加载</button>
            </div>
            <div v-if="result.items.length" class="search-footer" role="status">
              <p v-if="error">{{ error }}</p>
              <button
                v-if="hasMore || error"
                class="music-list-button"
                :disabled="loadingMore"
                @click="load(true)"
              >
                {{ loadingMore ? '正在加载…' : error ? '重新加载' : '加载更多' }}
              </button>
              <span v-else>已显示全部结果</span>
            </div>
          </template>
        </section>
      </div>
    </n-scrollbar>
    <play-bottom />
  </div>
</template>

<style scoped>
.search-result-page {
  height: 100%;
  width: 100%;
  color: var(--qqm-text);
}
.search-result-content {
  padding: 34px 4% 120px;
}
.search-heading {
  padding-bottom: 28px;
}
.search-eyebrow {
  font-size: 11px;
  color: var(--qqm-muted);
  margin: 0 0 7px;
}
.search-heading h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.7px;
  overflow-wrap: anywhere;
}
.search-caption {
  color: var(--qqm-muted);
  font-size: 12px;
  margin: 10px 0 0;
}
.search-tabs {
  display: flex;
  gap: 32px;
  border-bottom: 1px solid var(--qqm-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.search-tabs button {
  position: relative;
  flex-shrink: 0;
  padding: 0 0 17px;
  color: var(--qqm-muted);
  font-size: 16px;
}
.search-tabs button span {
  font-size: 10px;
  margin-left: 6px;
  font-weight: 400;
}
.search-tabs button.active {
  color: var(--qqm-primary-strong);
  font-weight: 600;
}
.search-tabs button.active::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 27px;
  height: 3px;
  background: var(--qqm-primary);
  border-radius: 2px;
}
.search-tabs button:hover {
  color: var(--qqm-primary-strong);
}
.search-tabs button:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: -2px;
  border-radius: 4px;
}
.search-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: 28px 24px;
  padding-top: 26px;
}
.search-card-grid.is-video {
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
}
.search-card-skeleton {
  aspect-ratio: 1;
  border-radius: 10px;
  background: var(--qqm-surface-muted);
}
.search-empty {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 30px;
}
.search-empty > i {
  font-size: 42px;
  color: var(--qqm-muted);
  opacity: 0.55;
}
.search-empty h2 {
  font-size: 17px;
  font-weight: 500;
}
.search-empty p,
.search-footer {
  color: var(--qqm-muted);
  font-size: 12px;
}
.search-footer {
  text-align: center;
  padding: 30px;
}
.search-footer p {
  margin-bottom: 12px;
}
@media (max-width: 720px) {
  .search-result-content {
    padding: 22px 18px 100px;
  }
  .search-heading h1 {
    font-size: 25px;
  }
  .search-tabs {
    gap: 25px;
  }
  .search-tabs button {
    font-size: 14px;
  }
  .search-card-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 22px 16px;
  }
}
</style>
