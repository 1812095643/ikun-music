<template>
  <div v-if="isComponent ? favoriteSongs.length : true" class="favorite-page h-full flex flex-col">
    <!-- Header Section -->
    <div class="favorite-header flex flex-shrink-0 items-center justify-between px-6 py-4">
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {{ t('favorite.title') }}
          </h2>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {{ t('favorite.count', { count: favoriteList.length }) }}
          </p>
        </div>
      </div>

      <div v-if="!isComponent && isElectron" class="flex items-center gap-3">
        <template v-if="!isSelecting">
          <!-- Sort Controls -->
          <div class="favorite-segment flex items-center rounded-lg p-1 h-9">
            <button
              v-for="isDesc in [true, false]"
              :key="String(isDesc)"
              class="px-3 h-full rounded-md text-xs font-medium transition-colors duration-200 flex items-center gap-1"
              :class="
                isDescending === isDesc
                  ? 'favorite-tab-active text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary'
              "
              @click="toggleSort(isDesc)"
            >
              <i class="text-sm" :class="isDesc ? 'ri-sort-desc' : 'ri-sort-asc'"></i>
              {{ isDesc ? t('favorite.descending') : t('favorite.ascending') }}
            </button>
          </div>

          <button
            class="favorite-select-button h-9 px-4 rounded-lg text-primary text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
            @click="startSelect"
          >
            <i class="ri-checkbox-multiple-line text-sm"></i>
            {{ t('favorite.batchDownload') }}
          </button>
        </template>

        <!-- Selection Controls -->
        <div v-else class="favorite-search flex items-center gap-3 rounded-lg px-4 py-1.5 h-9">
          <n-checkbox
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            size="small"
            @update:checked="handleSelectAll"
          >
            <span class="text-xs">{{ t('common.selectAll') }}</span>
          </n-checkbox>
          <div class="h-3 w-px bg-neutral-200 dark:bg-neutral-700 mx-1"></div>
          <div class="flex items-center gap-2">
            <button
              class="h-6 px-3 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              :disabled="selectedSongs.length === 0"
              @click="handleBatchDownload"
            >
              <i class="ri-download-line"></i>
              {{ t('favorite.download', { count: selectedSongs.length }) }}
            </button>
            <button
              class="favorite-tag h-6 px-3 rounded-md text-neutral-600 dark:text-neutral-300 text-xs font-medium hover:text-primary transition-colors"
              @click="cancelSelect"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="favorite-content min-h-0 flex-grow px-4">
      <n-scrollbar ref="scrollbarRef" class="h-full pr-4" @scroll="handleScroll">
        <div v-if="favoriteList.length === 0" class="favorite-empty-state">
          <div class="favorite-empty-icon">
            <i class="ri-heart-line"></i>
          </div>
          <p class="favorite-empty-title">{{ t('favorite.emptyTip') }}</p>
          <p class="favorite-empty-desc">喜欢的歌曲会在这里汇总，播放时点击爱心即可收藏。</p>
        </div>

        <div v-else class="space-y-1 pb-24" :class="{ 'max-w-[400px]': isComponent }">
          <song-item
            v-for="song in favoriteSongs"
            :key="song.id"
            :item="song"
            :favorite="false"
            class="favorite-song-row rounded-lg transition-colors"
            :class="{ 'favorite-song-selected': selectedSongs.includes(song.id as number) }"
            :selectable="isSelecting"
            :selected="selectedSongs.includes(song.id as number)"
            @play="handlePlay"
            @select="handleSelect"
          />

          <div v-if="isComponent" class="pt-4 text-center">
            <n-button text type="primary" @click="handleMore">
              {{ t('common.viewMore') }} <i class="ri-arrow-right-s-line ml-1"></i>
            </n-button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="loading" class="space-y-2 pt-2">
            <div v-for="i in 5" :key="i" class="flex items-center gap-4 rounded-lg p-2">
              <div class="h-12 w-12 rounded-lg skeleton-shimmer"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/3 rounded skeleton-shimmer"></div>
                <div class="h-3 w-1/4 rounded skeleton-shimmer"></div>
              </div>
            </div>
          </div>

          <div
            v-if="noMore"
            class="text-center py-8 text-sm text-neutral-400 dark:text-neutral-500"
          >
            {{ t('common.noMore') }}
          </div>
        </div>
      </n-scrollbar>
      <play-bottom />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getMusicDetail } from '@/api/music';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { useDownload } from '@/hooks/useDownload';
import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';

const { t } = useI18n();
const playerStore = usePlayerStore();
const favoriteList = computed(() => playerStore.favoriteList);
const favoriteSongs = ref<SongResult[]>([]);
const loading = ref(false);
const noMore = ref(false);

// 多选相关
const isSelecting = ref(false);
const selectedSongs = ref<number[]>([]);
const { batchDownloadMusic } = useDownload();

// 开始多选
const startSelect = () => {
  isSelecting.value = true;
  selectedSongs.value = [];
};

// 取消多选
const cancelSelect = () => {
  isSelecting.value = false;
  selectedSongs.value = [];
};

// 处理选择
const handleSelect = (songId: number, selected: boolean) => {
  if (selected) {
    selectedSongs.value.push(songId);
  } else {
    selectedSongs.value = selectedSongs.value.filter((id) => id !== songId);
  }
};

// 批量下载
const handleBatchDownload = async () => {
  // 获取选中歌曲的信息
  const selectedSongsList = selectedSongs.value
    .map((songId) => favoriteSongs.value.find((s) => s.id === songId))
    .filter((song) => song) as SongResult[];

  // 使用hook中的批量下载功能
  await batchDownloadMusic(selectedSongsList);

  // 下载完成后取消选择
  cancelSelect();
};

// 排序相关
const isDescending = ref(true); // 默认倒序显示

// 切换排序方式
const toggleSort = (descending: boolean) => {
  if (isDescending.value === descending) return;
  isDescending.value = descending;
  currentPage.value = 1;
  favoriteSongs.value = [];
  noMore.value = false;
  getFavoriteSongs();
};

// 无限滚动相关
const pageSize = 100;
const currentPage = ref(1);

const props = defineProps({
  isComponent: {
    type: Boolean,
    default: false
  }
});

// 获取当前页的收藏歌曲ID
const getCurrentPageIds = () => {
  let ids = [...favoriteList.value]; // 复制一份以免修改原数组

  // 根据排序方式调整顺序
  if (isDescending.value) {
    ids = ids.reverse(); // 倒序，最新收藏的在前面
  }

  const startIndex = (currentPage.value - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  // 返回原始ID，不进行类型转换
  return ids.slice(startIndex, endIndex);
};

// 获取收藏歌曲详情
const getFavoriteSongs = async () => {
  if (favoriteList.value.length === 0) {
    favoriteSongs.value = [];
    return;
  }

  if (props.isComponent && favoriteSongs.value.length >= 16) {
    return;
  }

  loading.value = true;
  try {
    const currentIds = getCurrentPageIds();

    const musicIds = currentIds.filter((id) => typeof id === 'number') as number[];

    // 处理音乐数据
    let neteaseSongs: SongResult[] = [];
    if (musicIds.length > 0) {
      const res = await getMusicDetail(musicIds);
      if (res.data.songs) {
        neteaseSongs = res.data.songs.map((song: SongResult) => ({
          ...song,
          picUrl: song.al?.picUrl || '',
          source: 'netease'
        }));
      }
    }

    console.log('获取数据统计:', {
      neteaseSongs: neteaseSongs.length
    });

    // 合并数据，保持原有顺序
    const newSongs = currentIds
      .map((id) => {
        const strId = String(id);

        // 查找音乐
        const found = neteaseSongs.find((song) => String(song.id) === strId);
        return found;
      })
      .filter((song): song is SongResult => !!song);

    console.log(`最终歌曲列表: ${newSongs.length}首`);

    // 追加新数据而不是替换
    if (currentPage.value === 1) {
      favoriteSongs.value = newSongs;
    } else {
      favoriteSongs.value = [...favoriteSongs.value, ...newSongs];
    }

    // 判断是否还有更多数据
    noMore.value = favoriteSongs.value.length >= favoriteList.value.length;
  } catch (error) {
    console.error('获取收藏歌曲失败:', error);
  } finally {
    loading.value = false;
  }
};

// 处理滚动事件
const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, offsetHeight } = e.target;
  const threshold = 100; // 距离底部多少像素时加载更多

  if (!loading.value && !noMore.value && scrollHeight - (scrollTop + offsetHeight) < threshold) {
    currentPage.value++;
    getFavoriteSongs();
  }
};

const hasLoaded = ref(false);

onMounted(async () => {
  if (!hasLoaded.value) {
    await playerStore.initializeFavoriteList();
    await getFavoriteSongs();
    hasLoaded.value = true;
  }
});

// 监听收藏列表变化，变化时重置并重新加载
watch(
  favoriteList,
  async () => {
    hasLoaded.value = false;
    currentPage.value = 1;
    noMore.value = false;
    await getFavoriteSongs();
    hasLoaded.value = true;
  },
  { deep: true }
);

const handlePlay = () => {
  playerStore.setPlayList(favoriteSongs.value);
};

const router = useRouter();
const handleMore = () => {
  router.push('/history');
};

// 全选相关
const isAllSelected = computed(() => {
  return (
    favoriteSongs.value.length > 0 && selectedSongs.value.length === favoriteSongs.value.length
  );
});

const isIndeterminate = computed(() => {
  return selectedSongs.value.length > 0 && selectedSongs.value.length < favoriteSongs.value.length;
});

// 处理全选/取消全选
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedSongs.value = favoriteSongs.value.map((song) => song.id as number);
  } else {
    selectedSongs.value = [];
  }
};
</script>

<style lang="scss" scoped>
.favorite-header {
  border-bottom: 1px solid color-mix(in srgb, var(--qqm-border) 65%, transparent);
  background: color-mix(in srgb, var(--qqm-surface) 92%, transparent);
}

.favorite-content :deep(.n-scrollbar-content) {
  min-height: 100%;
}

.favorite-empty-state {
  display: flex;
  min-height: 360px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #737373;
  text-align: center;
}

.favorite-empty-icon {
  display: flex;
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 12%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #ffffff 94%, var(--qqm-primary, #22c55e) 6%);
  color: var(--qqm-primary, #22c55e);
  font-size: 26px;
}

.favorite-empty-title {
  margin-top: 14px;
  color: #525252;
  font-size: 14px;
  font-weight: 700;
}

.favorite-empty-desc {
  margin-top: 6px;
  max-width: 260px;
  color: #8a8a8a;
  font-size: 12px;
  line-height: 1.7;
}

.dark .favorite-empty-icon {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, transparent);
  background: color-mix(in srgb, #050505 90%, var(--qqm-primary, #22c55e) 10%);
}

.dark .favorite-empty-title {
  color: #d4d4d4;
}

.dark .favorite-empty-desc {
  color: #8a8a8a;
}

.favorite-segment,
.favorite-search,
.favorite-tag {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.favorite-tag:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface));
}

.favorite-tab-active {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #fff));
}

.favorite-select-button {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.favorite-select-button:hover {
  color: #ffffff;
  background: var(--qqm-primary, #22c55e);
}

.favorite-song-row:hover,
.favorite-song-selected {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}
</style>
