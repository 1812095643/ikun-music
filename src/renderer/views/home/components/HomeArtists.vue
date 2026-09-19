<template>
  <section class="artists-section">
    <!-- Loading Skeleton -->
    <div v-if="loading" class="artists-scroll flex gap-6 md:gap-8 overflow-x-hidden pb-4">
      <div v-for="i in 8" :key="i" class="flex flex-col items-center gap-3">
        <div class="h-20 w-20 md:h-24 md:w-24 lg:h-28 lg:w-28 skeleton-shimmer rounded-lg" />
        <div class="h-3 w-16 skeleton-shimmer rounded-lg" />
      </div>
    </div>

    <!-- Artists Horizontal Scroll (Optimized with snap points) -->
    <div
      v-else
      ref="scrollContainer"
      class="artists-scroll relative overflow-x-auto overflow-y-hidden pt-2"
      style="
        margin-left: calc(var(--page-pl) * -1);
        margin-right: calc(var(--page-pr) * -1);
        padding-left: var(--page-pl);
        padding-right: var(--page-pr);
      "
      @wheel="handleWheel"
    >
      <div class="artists-track flex gap-6 md:gap-8 lg:gap-10">
        <div
          v-for="item in artists"
          :key="item.id"
          class="artist-item group flex flex-shrink-0 snap-start flex-col items-center gap-3 md:gap-4 cursor-pointer"
          @click="searchArtist(item)"
        >
          <!-- Artist Avatar -->
          <div
            class="artist-avatar qqm-artist-avatar relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 overflow-hidden rounded-lg transition-colors duration-200"
          >
            <img
              :src="getImgUrl(item.picUrl, '300y300')"
              class="h-full w-full object-cover transition-colors duration-200"
              loading="lazy"
              :alt="item.name"
            />
            <!-- Gradient Overlay on Hover -->
            <div
              class="absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            />
          </div>

          <!-- Artist Name -->
          <span
            class="artist-name text-xs sm:text-sm md:text-base font-semibold text-neutral-700 dark:text-neutral-300 transition-colors duration-200 group-hover:text-primary dark:group-hover:text-white"
          >
            {{ item.name }}
          </span>
        </div>
      </div>

      <!-- Scroll Indicators (Optional visual feedback) -->
      <div
        class="scroll-fade-left pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-[linear-gradient(to_right,var(--artist-fade-bg),transparent)] opacity-0 transition-opacity"
        :class="{ 'opacity-100': showLeftFade }"
      />
      <div
        class="scroll-fade-right pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-[linear-gradient(to_left,var(--artist-fade-bg),transparent)] opacity-0 transition-opacity"
        :class="{ 'opacity-100': showRightFade }"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getHotSinger } from '@/api/home';
import { getSearch } from '@/api/search';
import { SEARCH_TYPE } from '@/const/bar-const';
import { markHomeReady } from '@/services/startupReadiness';
import { useSearchStore } from '@/store/modules/search';
import { getImgUrl, isMobile } from '@/utils';

type ArtistItem = {
  id: number | string;
  name: string;
  picUrl?: string;
};

type SearchHistoryItem = {
  keyword: string;
  type: number;
};

const props = defineProps<{
  title: string;
  limit?: number;
}>();

const router = useRouter();
const searchStore = useSearchStore();
const artists = ref<ArtistItem[]>([]);
const loading = ref(true);
const scrollContainer = ref<HTMLElement | null>(null);
const showLeftFade = ref(false);
const showRightFade = ref(false);
const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_SEARCH_HISTORY = 20;

const parseSearchHistory = (rawHistory: string | null): SearchHistoryItem[] => {
  if (!rawHistory) return [];

  try {
    const history = JSON.parse(rawHistory);
    if (!Array.isArray(history)) return [];

    return history
      .map((item): SearchHistoryItem | null => {
        if (typeof item === 'string') {
          return { keyword: item, type: SEARCH_TYPE.MUSIC };
        }
        if (!item || typeof item !== 'object') return null;

        const record = item as Record<string, unknown>;
        if (typeof record.keyword !== 'string') return null;

        return {
          keyword: record.keyword,
          type: typeof record.type === 'number' ? record.type : SEARCH_TYPE.MUSIC
        };
      })
      .filter((item): item is SearchHistoryItem => Boolean(item?.keyword.trim()));
  } catch (error) {
    console.error('解析搜索历史失败:', error);
    return [];
  }
};

const saveSearchHistory = (keyword: string, type: number) => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return;

  const history = parseSearchHistory(localStorage.getItem(SEARCH_HISTORY_KEY)).filter(
    (item) => item.keyword !== normalizedKeyword
  );
  history.unshift({ keyword: normalizedKeyword, type });

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
};

const getNormalizedText = (value: string) => value.trim().toLowerCase();

const findMatchedArtistId = async (keyword: string, fallbackId: number | string) => {
  try {
    const { data } = await getSearch({
      keywords: keyword,
      type: SEARCH_TYPE.ARTIST,
      limit: 10,
      offset: 0
    });
    const artists = data?.result?.artists || [];
    if (!Array.isArray(artists) || artists.length === 0) return fallbackId;

    const normalizedKeyword = getNormalizedText(keyword);
    const exactArtist =
      artists.find((artist: any) => getNormalizedText(artist?.name || '') === normalizedKeyword) ||
      artists[0];

    return exactArtist?.id || fallbackId;
  } catch (error) {
    console.warn('歌手搜索定位失败，已使用首页原始歌手 ID 进入详情页。', error);
    return fallbackId;
  }
};

const searchArtist = async (item: ArtistItem) => {
  const keyword = item.name?.trim();
  if (!keyword) return;

  // 根因：首页歌手点击必须进入歌手详情页，但直接使用热门歌手接口给的 ID 时，
  // 详情页歌曲列表可能仍走原始歌手歌曲接口，播放时不一定优先命中已经加固过的酷我链路；
  // 上一版误跳到单曲搜索页，虽然能走酷我优先播放链路，却破坏了“进入对应歌手详情”的用户路径。
  // 解决思路：点击时先复用现有搜索功能按歌手名做一次“歌手分类搜索”，用搜索返回的
  // 最匹配歌手 ID 进入详情页；若搜索接口不可用，则回退首页原始 ID，保证用户点击不断路。
  // 搜索框状态和历史仍保持“单曲搜索”，让用户后续继续搜索/播放时默认走酷我优先策略。
  const searchType = SEARCH_TYPE.MUSIC;
  saveSearchHistory(keyword, searchType);
  searchStore.searchValue = keyword;
  searchStore.searchType = searchType;
  const targetArtistId = await findMatchedArtistId(keyword, item.id);

  router.push({
    name: 'artistDetail',
    params: {
      id: targetArtistId
    },
    query: {
      keyword,
      source: 'home-artist-search'
    }
  });
};

const fetchArtists = async () => {
  try {
    const { data } = await getHotSinger({ offset: 0, limit: props.limit || 10 });
    if (data.code === 200) {
      // 强制限制数量，确保不超过 limit
      artists.value = data.artists.slice(0, props.limit || 10);
    }
  } catch (error) {
    console.error('Failed to fetch hot artists:', error);
  } finally {
    loading.value = false;
    // Update scroll indicators after content loads
    setTimeout(updateScrollIndicators, 100);
  }
};

// Enhanced horizontal scroll with wheel support
const handleWheel = (e: WheelEvent) => {
  if (isMobile.value) return;
  if (!scrollContainer.value) return;

  // Prevent default vertical scroll
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();

    // Convert vertical scroll to horizontal
    scrollContainer.value.scrollBy({
      left: e.deltaY,
      behavior: 'auto' // Instant for smooth tracking
    });
  }

  updateScrollIndicators();
};

// Update scroll fade indicators
const updateScrollIndicators = () => {
  if (!scrollContainer.value) return;

  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
  showLeftFade.value = scrollLeft > 20;
  showRightFade.value = scrollLeft < scrollWidth - clientWidth - 20;
};

onMounted(() => {
  void fetchArtists().finally(() => markHomeReady('artists'));

  // Add scroll listener for fade indicators
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', updateScrollIndicators);
  }
});
</script>

<style scoped>
.home-artists {
  --artist-fade-bg: rgb(255 255 255);
}

:global(.dark) .home-artists {
  --artist-fade-bg: rgb(0 0 0);
}

/* 优化水平滚动 */
.artists-scroll {
  /* Hide scrollbar while maintaining functionality */
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /* Smooth scroll behavior */
  scroll-behavior: smooth;

  /* Enable snap scrolling for better UX */
  scroll-snap-type: x proximity;

  /* Enable momentum scrolling on iOS */
  -webkit-overflow-scrolling: touch;

  /* Optimize for touch */
  touch-action: pan-x pan-y;
}

.artists-track {
  /* Ensure proper width for scrolling */
  min-width: min-content;
}

.artist-item {
  /* Snap alignment */
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}

/* Scroll fade indicators */
.scroll-fade-left,
.scroll-fade-right {
  transition: opacity 0.18s ease;
}

.qqm-artist-avatar {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.group:hover .qqm-artist-avatar {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}
</style>
