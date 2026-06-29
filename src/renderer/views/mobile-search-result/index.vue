<template>
  <div class="mobile-search-result">
    <!-- 搜索结果头部 -->
    <div class="result-header" :class="{ 'safe-area-top': hasSafeArea }">
      <div class="header-back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div class="header-keyword">{{ keyword }}</div>
      <div class="header-actions">
        <div class="action-btn" @click="openSearch">
          <i class="ri-search-line"></i>
        </div>
      </div>
    </div>

    <!-- 搜索类型标签 -->
    <div class="search-types">
      <div
        v-for="type in searchTypes"
        :key="type.key"
        class="type-tag"
        :class="{ active: searchType === type.key }"
        @click="selectType(type.key)"
      >
        {{ type.label }}
      </div>
    </div>

    <!-- 搜索结果列表 -->
    <div class="result-content" @scroll="handleScroll">
      <!-- 加载中 -->
      <div v-if="loading && !results.length" class="loading-state">
        <n-spin size="medium" />
        <span class="ml-2">{{ t('search.loading.searching') }}</span>
      </div>

      <!-- 搜索结果 -->
      <div v-else-if="results.length" class="result-list">
        <!-- 歌曲搜索 -->
        <template v-if="searchType === SEARCH_TYPE.MUSIC">
          <song-item
            v-for="item in results"
            :key="item.id"
            :item="item"
            :is-next="true"
            @play="handlePlay"
          />
        </template>

        <!-- 专辑/歌单/MV 搜索 -->
        <template v-else>
          <search-item v-for="item in results" :key="item.id" :item="item" class="mb-3" />
        </template>

        <!-- 加载更多 -->
        <div v-if="isLoadingMore" class="loading-more">
          <n-spin size="small" />
          <span class="ml-2">{{ t('search.loading.more') }}</span>
        </div>

        <!-- 没有更多 -->
        <div v-if="!hasMore && results.length" class="no-more">
          {{ t('search.noMore') }}
        </div>
      </div>

      <!-- 无结果 -->
      <div v-else-if="!loading" class="empty-state">
        <i class="ri-search-line"></i>
        <span>{{ t('comp.musicList.noSearchResults') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  inject,
  onMounted,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getSearch } from '@/api/search';
import SongItem from '@/components/common/SongItem.vue';
import { SEARCH_TYPE, SEARCH_TYPES } from '@/const/bar-const';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';
import type { SongResult } from '@/types/music';
import { isAndroidRuntime } from '@/utils';

const SearchItem = isAndroidRuntime
  ? defineComponent({ name: 'AndroidHiddenSearchItem', setup: () => () => null })
  : defineAsyncComponent(() => import('@/components/common/SearchItem.vue'));

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

// 注入是否有安全区域
const hasSafeArea = inject('hasSafeArea', false);

// 搜索关键词
const keyword = ref((route.query.keyword as string) || '');

// 搜索类型
const getAvailableSearchTypes = () =>
  isAndroidRuntime ? SEARCH_TYPES.filter((type) => type.key === SEARCH_TYPE.MUSIC) : SEARCH_TYPES;
const normalizeSearchType = (type?: number) =>
  isAndroidRuntime ? SEARCH_TYPE.MUSIC : type || searchStore.searchType || SEARCH_TYPE.MUSIC;
const searchType = ref(normalizeSearchType(Number(route.query.type)));
const searchTypes = computed(() => {
  locale.value;
  return getAvailableSearchTypes().map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

const formatArtist = (item: any) => ({
  ...item,
  id: Number(item.id || item.userId || 0),
  name: item.name || item.nickname || '未知歌手',
  picUrl: item.picUrl || item.cover || item.avatar || item.img1v1Url || '',
  desc:
    item.briefDesc ||
    [
      item.musicSize ? `${item.musicSize} 首单曲` : '',
      item.albumSize ? `${item.albumSize} 张专辑` : ''
    ]
      .filter(Boolean)
      .join(' · '),
  type: 'artist',
  source: item.source || 'netease'
});

// 搜索结果
const results = ref<any[]>([]);
const loading = ref(false);

// 分页
const ITEMS_PER_PAGE = 30;
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);

// 执行搜索
const performSearch = async (isLoadMore = false) => {
  if (!keyword.value) return;

  if (isLoadMore) {
    if (!hasMore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
  } else {
    loading.value = true;
    results.value = [];
    page.value = 1;
    hasMore.value = true;
  }

  try {
    // 歌曲搜索
    if (searchType.value === SEARCH_TYPE.MUSIC) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const songs = (data.result.songs || []).map((item: any) => {
        const artists = item.ar || item.artists || item.song?.artists || [];
        const album = item.al ||
          item.album || { id: 0, name: '酷我音乐', picUrl: item.picUrl || '' };
        return {
          ...item,
          ar: artists,
          artists,
          al: album,
          album,
          picUrl: album.picUrl || item.picUrl || '',
          song: {
            artists,
            name: item.name,
            id: item.id
          },
          source: item.source || 'netease'
        };
      });

      if (isLoadMore) {
        results.value = [...results.value, ...songs];
      } else {
        results.value = songs;
      }

      hasMore.value = songs.length === ITEMS_PER_PAGE;
    }
    // 专辑搜索
    else if (searchType.value === SEARCH_TYPE.ALBUM) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const albums = (data.result.albums || []).map((item: any) => ({
        ...item,
        desc: `${item.artist?.name || ''} ${item.company || ''}`,
        type: 'album'
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...albums];
      } else {
        results.value = albums;
      }

      hasMore.value = albums.length === ITEMS_PER_PAGE;
    }
    // 歌手搜索
    else if (searchType.value === SEARCH_TYPE.ARTIST) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const artists = (data.result.artists || []).map(formatArtist);

      if (isLoadMore) {
        results.value = [...results.value, ...artists];
      } else {
        results.value = artists;
      }

      hasMore.value = artists.length === ITEMS_PER_PAGE;
    }
    // 歌单搜索
    else if (searchType.value === SEARCH_TYPE.PLAYLIST) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const playlists = (data.result.playlists || []).map((item: any) => ({
        ...item,
        picUrl: item.coverImgUrl,
        playCount: item.playCount,
        desc: item.creator?.nickname || '',
        type: 'playlist'
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...playlists];
      } else {
        results.value = playlists;
      }

      hasMore.value = playlists.length === ITEMS_PER_PAGE;
    }
    // MV 搜索
    else if (searchType.value === SEARCH_TYPE.MV) {
      const { data } = await getSearch({
        keywords: keyword.value,
        type: searchType.value,
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const mvs = (data.result.mvs || []).map((item: any) => ({
        ...item,
        picUrl: item.cover,
        playCount: item.playCount,
        desc: item.artists?.map((artist: any) => artist.name).join('/') || '',
        type: 'mv'
      }));

      if (isLoadMore) {
        results.value = [...results.value, ...mvs];
      } else {
        results.value = mvs;
      }

      hasMore.value = mvs.length === ITEMS_PER_PAGE;
    }

    page.value++;
  } catch (error) {
    console.error('搜索失败:', error);
  } finally {
    loading.value = false;
    isLoadingMore.value = false;
  }
};

// 选择搜索类型
const selectType = (type: number) => {
  if (isAndroidRuntime && type !== SEARCH_TYPE.MUSIC) return;
  if (searchType.value === type) return;

  searchType.value = type;
  searchStore.searchType = type;

  // 更新路由查询参数
  router.replace({
    query: {
      ...route.query,
      type: type.toString()
    }
  });

  performSearch();
};

// 滚动加载更多
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = target;

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    performSearch(true);
  }
};

// 播放音乐
const handlePlay = (item: any) => {
  const songs = results.value.filter(Boolean) as SongResult[];
  if (songs.length > 0) {
    // 移动搜索页同桌面搜索页保持一致：单曲按钮就是立即播放，不是插入下一首。
    playerStore.setPlayList(songs);
  }
  playerStore.setPlay(item as SongResult);
};

// 返回
const goBack = () => {
  router.back();
};

// 打开搜索
const openSearch = () => {
  router.push('/mobile-search');
};

// 监听路由变化
watch(
  () => route.query,
  (query) => {
    if (route.path === '/mobile-search-result' && query.keyword) {
      keyword.value = query.keyword as string;
      searchType.value = normalizeSearchType(Number(query.type));
      performSearch();
    }
  }
);

onMounted(() => {
  if (keyword.value) {
    performSearch();
  }
});
</script>

<style lang="scss" scoped>
.mobile-search-result {
  @apply fixed inset-0;
  background: var(--qqm-bg, #f7f8fa);
  @apply flex flex-col;
}

.result-header {
  @apply flex items-center gap-2 px-3 py-2;
  border-bottom: 1px solid var(--qqm-border);

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 12px);
  }
}

.header-back {
  @apply flex items-center justify-center;
  @apply w-8 h-8 rounded-lg text-lg;
  @apply text-neutral-600 dark:text-neutral-300;
  &:active {
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface));
  }
}

.header-keyword {
  @apply flex-1 text-base font-medium;
  @apply text-neutral-900 dark:text-neutral-100;
  @apply truncate;
}

.header-actions {
  @apply flex items-center gap-2;
}

.action-btn {
  @apply flex items-center justify-center;
  @apply w-8 h-8 rounded-lg text-lg;
  @apply text-neutral-600 dark:text-neutral-300;
  &:active {
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface));
  }
}

.search-types {
  @apply flex gap-2 px-4 py-2.5 overflow-x-auto;
  border-bottom: 1px solid var(--qqm-border);

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-tag {
  @apply px-3.5 py-1.5 rounded-md text-sm whitespace-nowrap;
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
  @apply text-neutral-600 dark:text-neutral-300;
  @apply transition-colors duration-200;

  &.active {
    background-color: var(--qqm-primary, #22c55e);
    color: white;
  }
}

.result-content {
  @apply flex-1 overflow-y-auto;
}

.loading-state {
  @apply flex flex-col items-center justify-center py-20;
  @apply text-neutral-500 dark:text-neutral-400;
}

.result-list {
  @apply px-4 pb-24 pt-1;
}

.loading-more {
  @apply flex justify-center items-center py-4;
  @apply text-neutral-500 dark:text-neutral-400;
}

.no-more {
  @apply text-center py-5;
  @apply text-neutral-400 dark:text-neutral-500;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-20;
  @apply text-neutral-400 dark:text-neutral-500;

  i {
    @apply text-6xl mb-4;
  }
}

.result-content {
  background: transparent !important;
}

.result-list {
  border: 0 !important;
  border-top: 1px solid var(--qqm-border);
  border-radius: 0 !important;
  background: transparent !important;
}

.result-list :deep(.song-item) {
  border-bottom: 1px solid var(--qqm-border);
  border-radius: 0;
}

.result-list :deep(.song-item:hover) {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, var(--qqm-bg));
}
</style>
