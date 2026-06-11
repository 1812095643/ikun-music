<template>
  <sticky-tab-page
    ref="pageRef"
    class="list-page"
    :title="listTitle"
    :description="t('comp.pages.list.desc')"
    :model-value="currentType"
    :categories="playlistCategory?.sub || []"
    label-key="name"
    value-key="name"
    @change="handleTypeChange"
    @scroll="handleScroll"
  >
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      <!-- Loading State -->
      <template v-if="loading && page === 0">
        <div v-for="i in 15" :key="`loading-${i}`" class="space-y-3">
          <div class="aspect-square skeleton-shimmer rounded-lg" />
          <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
        </div>
      </template>

      <!-- Content State -->
      <template v-else>
        <div
          v-for="item in recommendList"
          :key="item.id"
          class="list-card group cursor-pointer"
          @click.stop="openPlaylist(item)"
        >
          <!-- Cover Image -->
          <div
            class="list-cover-surface relative aspect-square overflow-hidden rounded-lg transition-colors duration-200"
          >
            <img
              :src="getImgUrl(item.picUrl || item.coverImgUrl, '400y400')"
              :alt="item.name"
              class="w-full h-full object-cover"
              loading="lazy"
            />

            <!-- Play Overlay -->
            <div
              class="absolute inset-0 bg-transparent group-hover:bg-black/15 transition-colors duration-200 flex items-center justify-center"
            >
              <div
                class="play-icon w-10 h-10 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <i class="ri-play-fill text-2xl text-neutral-900 ml-1"></i>
              </div>
            </div>

            <!-- Play Count Badge -->
            <div
              class="playlist-count-badge absolute top-3 right-3 px-2 py-1 rounded-md text-white text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <i class="ri-play-fill"></i>
              {{ formatNumber(item.playCount) }}
            </div>
          </div>

          <!-- Info -->
          <div class="mt-3 space-y-1">
            <h3
              class="text-sm md:text-base font-bold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
            >
              {{ item.name }}
            </h3>
          </div>
        </div>
      </template>
    </div>

    <!-- 加载更多 -->
    <div v-if="isLoadingMore" class="flex justify-center items-center py-8">
      <n-spin size="small" />
      <span class="ml-2 text-neutral-500">{{ t('common.loading') }}</span>
    </div>
    <div v-if="!hasMore && recommendList.length > 0" class="text-center py-8 text-neutral-500">
      {{ t('common.noMore') }}
    </div>
  </sticky-tab-page>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getPlaylistCategory } from '@/api/home';
import { getListByCat } from '@/api/list';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import StickyTabPage from '@/components/common/StickyTabPage.vue';
import type { IPlayListSort } from '@/types/playlist';
import { formatNumber, getImgUrl } from '@/utils';

defineOptions({
  name: 'List'
});

const { t } = useI18n();
const TOTAL_ITEMS = 42;
const recommendList = ref<any[]>([]);
const page = ref(0);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const pageRef = ref();

const router = useRouter();

const openPlaylist = (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item,
    canRemove: false
  });
};

const route = useRoute();
const DEFAULT_CAT = '每日推荐';
const listTitle = ref((route.query.type as string) || t('comp.pages.list.dailyRecommend'));

const loading = ref(false);
const loadList = async (type: string, isLoadMore = false) => {
  if (!hasMore.value && isLoadMore) return;
  if (isLoadMore) {
    isLoadingMore.value = true;
  } else {
    loading.value = true;
    page.value = 0;
    recommendList.value = [];
    await nextTick();
    pageRef.value?.scrollTo({ top: 0 });
  }

  try {
    const params = {
      cat: type === DEFAULT_CAT ? '' : type,
      limit: TOTAL_ITEMS,
      offset: page.value * TOTAL_ITEMS
    };
    const { data } = await getListByCat(params);
    if (isLoadMore) {
      recommendList.value.push(...data.playlists);
    } else {
      recommendList.value = data.playlists;
    }
    hasMore.value = data.more;
    page.value++;
  } catch (error) {
    console.error('加载歌单列表失败:', error);
  } finally {
    loading.value = false;
    isLoadingMore.value = false;
  }
};

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore.value && hasMore.value) {
    loadList(currentType.value, true);
  }
};

const playlistCategory = ref<IPlayListSort>();
const currentType = ref((route.query.type as string) || DEFAULT_CAT);

const loadPlaylistCategory = async () => {
  const { data } = await getPlaylistCategory();
  playlistCategory.value = {
    ...data,
    sub: [
      {
        name: DEFAULT_CAT,
        category: 0
      },
      ...data.sub
    ]
  };
};

const handleTypeChange = (type: string) => {
  router.replace({ query: { ...route.query, type } });
};

onMounted(() => {
  loadPlaylistCategory();
  currentType.value = (route.query.type as string) || currentType.value;
  loadList(currentType.value);
});

watch(
  () => route.query,
  async (newParams) => {
    if (route.path !== '/list') return;
    const newType = (newParams.type as string) || DEFAULT_CAT;
    if (newType !== currentType.value) {
      listTitle.value = newType === DEFAULT_CAT ? t('comp.pages.list.dailyRecommend') : newType;
      currentType.value = newType;
      loading.value = true;
      loadList(newType);
    }
  }
);
</script>

<style lang="scss" scoped>
.list-card {
  border-radius: 10px;
  padding: 6px;
  transition:
    background-color 160ms var(--qqm-ease),
    color 160ms var(--qqm-ease);

  > div:first-child {
    border: 1px solid var(--qqm-border);
    box-shadow: none;
  }

  &:hover {
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, var(--qqm-surface, #fff));

    > div:first-child {
      border-color: rgba(30, 207, 115, 0.18);
      background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, transparent);
    }

    h3 {
      color: var(--qqm-primary-strong) !important;
    }
  }
}

.list-cover-surface {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
}

.play-icon {
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 82%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #fff) 90%, transparent);
  color: var(--qqm-text, #1f2329);
}

.play-icon:hover {
  color: var(--qqm-primary, #22c55e);
}

.list-card:hover .list-cover-surface {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.playlist-count-badge {
  border: 1px solid color-mix(in srgb, #ffffff 14%, transparent);
  background: color-mix(in srgb, #0f172a 44%, transparent);
  backdrop-filter: blur(8px) saturate(1.06);
}
</style>
