<template>
  <div class="toplist-page h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="toplist-content w-full pb-32 pt-6 page-padding">
        <!-- Hero Section -->
        <div class="mb-10">
          <h1
            class="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-2"
          >
            {{ t('comp.toplist') }}
          </h1>
          <p class="text-neutral-500 dark:text-neutral-400">
            {{ t('comp.pages.toplist.desc') }}
          </p>
        </div>

        <!-- Toplist Grid -->
        <div class="toplist-grid-container">
          <!-- Loading State -->
          <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div v-for="i in 15" :key="i" class="space-y-3">
              <div class="aspect-square skeleton-shimmer rounded-lg" />
              <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
              <div class="h-3 w-1/2 skeleton-shimmer rounded-lg" />
            </div>
          </div>

          <!-- Content State -->
          <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div
              v-for="item in topList"
              :key="item.id"
              class="toplist-card group cursor-pointer"
              @click.stop="openToplist(item)"
            >
              <!-- Cover Image -->
              <div
                class="toplist-cover-surface relative aspect-square overflow-hidden rounded-lg transition-colors duration-200"
              >
                <img
                  :src="getImgUrl(item.coverImgUrl, '400y400')"
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

                <!-- Update Frequency Badge -->
                <div
                  class="qqm-cover-badge absolute bottom-3 left-3 px-2 py-1 rounded-md text-white text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  v-if="item.updateFrequency"
                >
                  {{ item.updateFrequency }}
                </div>

                <!-- Play Count Badge -->
                <div
                  class="qqm-cover-badge absolute top-3 right-3 px-2 py-1 rounded-md text-white text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <i class="ri-play-fill"></i>
                  {{ formatNumber(item.playCount) }}
                </div>
              </div>

              <!-- Info -->
              <div class="mt-3 space-y-1">
                <h3
                  class="text-sm md:text-base font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-primary transition-colors"
                >
                  {{ item.name }}
                </h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                  {{ item.updateFrequency }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getToplist } from '@/api/list';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { formatNumber, getImgUrl } from '@/utils';

defineOptions({
  name: 'Toplist'
});

const { t } = useI18n();
const router = useRouter();
const topList = ref<any[]>([]);
const loading = ref(false);

const openToplist = async (item: any) => {
  try {
    navigateToMusicList(router, {
      id: item.id,
      type: 'playlist',
      name: item.name,
      listInfo: item,
      canRemove: false
    });
  } catch (error) {
    console.error('获取榜单详情失败:', error);
  }
};

const loadToplist = async () => {
  loading.value = true;
  try {
    const { data } = await getToplist();
    topList.value = data.list || [];
  } catch (error) {
    console.error('加载排行榜列表失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadToplist();
});
</script>

<style lang="scss" scoped>
.toplist-page {
  position: relative;
  background: var(--qqm-bg, #f7f8fa);
}

.toplist-card {
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

    .play-icon {
      @apply opacity-100;
      transform: translateY(0);
    }
  }
}

.toplist-cover-surface {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.toplist-card:hover .toplist-cover-surface {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.qqm-cover-badge {
  border: 1px solid color-mix(in srgb, #ffffff 14%, transparent);
  background: color-mix(in srgb, #0f172a 42%, transparent);
  backdrop-filter: blur(8px) saturate(1.06);
}
</style>
