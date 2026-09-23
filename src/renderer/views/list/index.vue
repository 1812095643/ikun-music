<script lang="ts" setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getPlaylistCategory } from '@/api/home';
import { getListByCat } from '@/api/list';
import SearchItem from '@/components/common/SearchItem.vue';
import StickyTabPage from '@/components/common/StickyTabPage.vue';
import type { IPlayListSort } from '@/types/playlist';

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

const route = useRoute();
const DEFAULT_CAT = '每日推荐';
const listTitle = ref((route.query.type as string) || t('comp.pages.list.dailyRecommend'));

const loading = ref(false);
const loadError = ref('');
let listVersion = 0;
const loadList = async (type: string, isLoadMore = false) => {
  if (isLoadMore && (loading.value || isLoadingMore.value || !hasMore.value)) return;
  if (!isLoadMore) {
    listVersion++;
    isLoadingMore.value = false;
    hasMore.value = true;
  }
  const version = listVersion;
  loadError.value = '';
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
    if (version !== listVersion) return;
    if (!Array.isArray(data.playlists)) throw new Error('未收到歌单列表');
    if (isLoadMore) {
      const existing = new Set(recommendList.value.map((item) => item.id));
      recommendList.value.push(...data.playlists.filter((item: any) => !existing.has(item.id)));
    } else {
      recommendList.value = data.playlists;
    }
    hasMore.value = data.more;
    page.value++;
  } catch (error) {
    if (version !== listVersion) return;
    console.warn('歌单暂未加载：', error);
    loadError.value = '请检查网络连接后重新加载歌单。';
  } finally {
    if (version === listVersion) {
      loading.value = false;
      isLoadingMore.value = false;
    }
  }
};

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (
    !loadError.value &&
    scrollTop + clientHeight >= scrollHeight - 100 &&
    !isLoadingMore.value &&
    hasMore.value
  ) {
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
  void loadPlaylistCategory().catch((error) => console.warn('歌单分类暂未加载：', error));
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
    <div class="playlist-grid">
      <!-- Loading State -->
      <template v-if="loading && page === 0">
        <div v-for="i in 15" :key="`loading-${i}`" class="space-y-3">
          <div class="aspect-square skeleton-shimmer rounded-lg" />
          <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
        </div>
      </template>

      <template v-else>
        <search-item
          v-for="item in recommendList"
          :key="`${item.source}:${item.id}`"
          :item="{
            ...item,
            type: 'playlist',
            picUrl: item.picUrl || item.coverImgUrl,
            desc: [item.trackCount ? `${item.trackCount} 首` : '', item.creator?.nickname]
              .filter(Boolean)
              .join(' · ')
          }"
        />
      </template>
    </div>
    <div v-if="loadError" class="playlist-notice" role="status">
      <span>{{ loadError }}</span
      ><button class="music-list-button" @click="loadList(currentType, recommendList.length > 0)">
        重新加载
      </button>
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

<style scoped>
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: 28px 24px;
  padding-top: 10px;
}
.playlist-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 28px;
  font-size: 12px;
  color: var(--qqm-muted);
}
@media (max-width: 720px) {
  .playlist-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 22px 16px;
  }
}
</style>
