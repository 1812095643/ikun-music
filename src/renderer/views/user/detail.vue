<template>
  <div class="user-detail-page h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="w-full pb-32">
        <!-- Loading State -->
        <div v-if="loading">
          <!-- Hero Skeleton -->
          <div class="relative h-[300px] overflow-hidden rounded-tl-lg">
            <div class="absolute inset-0 skeleton-shimmer" />
            <div class="relative z-10 page-padding-x pt-8 pb-6">
              <div class="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-10">
                <div class="h-28 w-28 md:h-40 md:w-40 skeleton-shimmer rounded-lg flex-shrink-0" />
                <div class="flex-1 space-y-4 text-center md:text-left">
                  <div class="h-8 w-40 skeleton-shimmer rounded-lg" />
                  <div class="flex justify-center gap-6 md:justify-start">
                    <div class="h-12 w-16 skeleton-shimmer rounded-lg" />
                    <div class="h-12 w-16 skeleton-shimmer rounded-lg" />
                    <div class="h-12 w-16 skeleton-shimmer rounded-lg" />
                  </div>
                  <div class="h-4 w-2/3 skeleton-shimmer rounded-lg" />
                </div>
              </div>
            </div>
          </div>
          <!-- Content Skeleton -->
          <div class="mt-8 page-padding-x">
            <div class="h-10 w-48 mb-6 skeleton-shimmer rounded-lg" />
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              <div v-for="i in 10" :key="i" class="space-y-2">
                <div class="aspect-square w-full skeleton-shimmer rounded-lg" />
                <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
                <div class="h-3 w-1/2 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div v-else-if="userDetail">
          <!-- Hero Section -->
          <section class="hero-section relative overflow-hidden">
            <!-- Background Image with Blur -->
            <div class="absolute inset-0 -top-20">
              <div
                class="absolute inset-0 bg-cover bg-center opacity-[0.05] dark:opacity-[0.06]"
                :style="{
                  backgroundImage: `url(${getImgUrl(userDetail.profile.backgroundUrl)})`
                }"
              />
              <div class="absolute inset-0 user-detail-hero-mask" />
            </div>

            <!-- Hero Content -->
            <div class="relative z-10 page-padding-x pt-4 md:pt-8 pb-6">
              <div class="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end">
                <!-- User Avatar -->
                <div class="relative group">
                  <div
                    class="absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  />
                  <div
                    class="user-avatar-surface relative w-28 h-28 md:w-40 md:h-40 rounded-lg overflow-hidden"
                  >
                    <img
                      :src="getImgUrl(userDetail.profile.avatarUrl, '300y300')"
                      :alt="userDetail.profile.nickname"
                      class="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <!-- User Info -->
                <div class="flex-1 text-center md:text-left">
                  <!-- Badge -->
                  <div class="mb-2 md:mb-3" v-if="isArtist(userDetail.profile)">
                    <span
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary text-xs font-semibold uppercase tracking-wider"
                    >
                      <i class="ri-verified-badge-fill text-sm" />
                      {{ t('user.detail.artist') }}
                    </span>
                  </div>

                  <h1
                    class="text-2xl md:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight"
                  >
                    {{ userDetail.profile.nickname }}
                  </h1>

                  <!-- Stats -->
                  <div
                    class="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 mt-4 md:mt-5"
                  >
                    <div
                      class="flex flex-col items-center gap-0.5 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                      @click="showFollowerList"
                    >
                      <span class="text-lg font-bold text-neutral-900 dark:text-white">
                        {{ formatNumber(userDetail.profile.followeds) }}
                      </span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">
                        {{ t('user.profile.followers') }}
                      </span>
                    </div>
                    <div
                      class="flex flex-col items-center gap-0.5 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                      @click="showFollowList"
                    >
                      <span class="text-lg font-bold text-neutral-900 dark:text-white">
                        {{ formatNumber(userDetail.profile.follows) }}
                      </span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">
                        {{ t('user.profile.following') }}
                      </span>
                    </div>
                    <div class="flex flex-col items-center gap-0.5 px-3 py-1.5">
                      <span class="text-lg font-bold text-neutral-900 dark:text-white">
                        Lv.{{ userDetail.level }}
                      </span>
                      <span class="text-xs text-neutral-500 dark:text-neutral-400">
                        {{ t('user.profile.level') }}
                      </span>
                    </div>
                  </div>

                  <!-- Signature -->
                  <p
                    v-if="userDetail.profile.signature"
                    class="mt-3 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 max-w-lg"
                  >
                    {{ userDetail.profile.signature }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Tab Navigation -->
          <section class="page-padding-x pt-4 md:pt-6">
            <div class="user-tabs relative flex w-fit gap-1 rounded-lg p-1">
              <button
                v-for="tab in tabs"
                :key="tab.value"
                class="relative rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 md:px-6"
                :class="
                  activeTab === tab.value
                    ? 'text-neutral-900 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                "
                @click="activeTab = tab.value"
              >
                <span class="relative z-10">{{ tab.label }}</span>
                <Transition name="tab-indicator">
                  <div
                    v-if="activeTab === tab.value"
                    class="absolute inset-0 rounded-md border border-primary/10 bg-white dark:border-white/10 dark:bg-white/10"
                  />
                </Transition>
              </button>
            </div>
          </section>

          <!-- Tab Content -->
          <section class="page-padding-x py-6 md:py-8">
            <!-- Playlists Tab -->
            <div v-show="activeTab === 'playlists'">
              <div v-if="playList.length === 0" class="qqm-user-empty">
                <i class="ri-play-list-line text-5xl mb-4 opacity-50" />
                <p>{{ t('user.detail.noPlaylists') }}</p>
              </div>
              <div
                v-else
                class="user-playlist-grid grid grid-cols-2 gap-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                <div
                  v-for="item in playList"
                  :key="item.id"
                  class="user-playlist-card group cursor-pointer"
                  @click="openPlaylist(item)"
                >
                  <!-- Cover -->
                  <div
                    class="user-playlist-cover relative aspect-square overflow-hidden rounded-lg"
                  >
                    <n-image
                      :src="getImgUrl(item.coverImgUrl, '300y300')"
                      lazy
                      preview-disabled
                      class="w-full h-full object-cover"
                    />
                    <!-- Play Count Overlay -->
                    <div
                      class="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/45 px-2 py-0.5 text-xs text-white"
                    >
                      <i class="ri-play-fill" />
                      {{ formatNumber(item.playCount) }}
                    </div>
                    <!-- Play Overlay -->
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-200 group-hover:bg-black/12 group-hover:opacity-100"
                    >
                      <div
                        class="user-detail-play flex h-9 w-9 items-center justify-center rounded-lg transition-opacity duration-200"
                      >
                        <i class="ri-play-fill text-xl text-neutral-900 ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <!-- Info -->
                  <div class="mt-3">
                    <h3
                      class="line-clamp-2 text-sm font-medium text-neutral-800 transition-colors group-hover:text-primary dark:text-neutral-100 dark:group-hover:text-primary"
                    >
                      {{ item.name }}
                    </h3>
                    <p class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {{ t('user.playlist.trackCount', { count: item.trackCount }) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Records Tab -->
            <div v-show="activeTab === 'records'">
              <!-- No Permission -->
              <div v-if="!hasRecordPermission" class="qqm-user-empty">
                <i class="ri-lock-line text-5xl mb-4 opacity-50" />
                <p>
                  {{
                    t('user.detail.noRecordPermission', {
                      name: userDetail.profile.nickname
                    })
                  }}
                </p>
              </div>
              <!-- Empty -->
              <div v-else-if="!recordList || recordList.length === 0" class="qqm-user-empty">
                <i class="ri-music-2-line text-5xl mb-4 opacity-50" />
                <p>{{ t('user.detail.noRecords') }}</p>
              </div>
              <!-- Record List -->
              <div v-else class="w-full">
                <div v-for="(item, index) in recordList" :key="item.id" class="song-item-container">
                  <song-item :index="index" :item="item" compact @play="handlePlay" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="!loading"
          class="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 dark:text-neutral-500"
        >
          <i class="ri-user-line text-6xl mb-4 opacity-30" />
          <p>{{ t('user.message.loadFailed') }}</p>
        </div>
      </div>
    </n-scrollbar>

    <play-bottom />
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore } from '@/store/modules/player';
import type { IUserDetail } from '@/types/user';
import { formatNumber, getImgUrl } from '@/utils';

defineOptions({
  name: 'UserDetail'
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const message = useMessage();
const playerStore = usePlayerStore();

const userId = ref<number>(Number(route.params.uid));
const userDetail = ref<IUserDetail>();
const playList = ref<any[]>([]);
const recordList = ref<any[]>([]);
const loading = ref(true);
const hasRecordPermission = ref(true);
const activeTab = ref('playlists');

const tabs = computed(() => [
  { value: 'playlists', label: t('user.detail.playlists') },
  { value: 'records', label: t('user.detail.records') }
]);

// 加载用户数据
const loadUserData = async () => {
  if (!userId.value) {
    message.error(t('user.detail.invalidUserId'));
    router.back();
    return;
  }

  try {
    loading.value = true;
    recordList.value = [];
    hasRecordPermission.value = true;

    // 获取用户详情和歌单列表
    try {
      const [userDetailRes, playlistRes] = await Promise.all([
        getUserDetail(userId.value),
        getUserPlaylist(userId.value)
      ]);
      userDetail.value = userDetailRes.data;
      playList.value = playlistRes.data.playlist;
    } catch (error) {
      console.error('加载用户基本信息失败:', error);
      message.error(t('user.message.loadFailed'));
      return;
    }

    // 单独处理听歌记录请求
    try {
      const recordRes = await getUserRecord(userId.value);
      if (recordRes.data?.allData) {
        recordList.value = recordRes.data.allData.map((item: any) => ({
          ...item,
          ...item.song,
          picUrl: item.song.al.picUrl
        }));
      }
    } catch (error: any) {
      console.error('加载听歌记录失败:', error);
      if (error.response?.data?.code === -2 || error.data?.code === -2) {
        hasRecordPermission.value = false;
      }
    }
  } catch (error) {
    console.error('加载用户数据失败:', error);
    message.error(t('user.message.loadFailed'));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadUserData();
});

watch(
  () => route.params.uid,
  (newUid) => {
    if (newUid && Number(newUid) !== userId.value) {
      userId.value = Number(newUid);
      activeTab.value = 'playlists';
      loadUserData();
    }
  }
);

const openPlaylist = (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item,
    canRemove: false
  });
};

const handlePlay = () => {
  if (!recordList.value || recordList.value.length === 0) return;
  playerStore.setPlayList(recordList.value);
};

const showFollowList = () => {
  if (!userDetail.value) return;
  router.push({
    path: `/user/follows`,
    query: { uid: userId.value.toString(), name: userDetail.value.profile.nickname }
  });
};

const showFollowerList = () => {
  if (!userDetail.value) return;
  router.push({
    path: `/user/followers`,
    query: { uid: userId.value.toString(), name: userDetail.value.profile.nickname }
  });
};

const isArtist = (profile: any) => {
  return profile.userType === 4 || profile.userType === 2 || profile.accountType === 2;
};
</script>

<style lang="scss" scoped>
.hero-section {
  min-height: 200px;
  border-bottom: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--qqm-primary, #22c55e) 3%, var(--qqm-bg)),
    var(--qqm-bg)
  );
}

.user-avatar-surface {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
}

.user-tabs {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface, #ffffff);
}

.user-playlist-card {
  padding: 6px;
  border-radius: 10px;
  animation: fadeInSoft 0.22s ease-out backwards;
  transition: background-color 0.18s ease;
}

.user-playlist-card:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, var(--qqm-surface, #fff));
}

.user-playlist-cover {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.user-playlist-card:hover .user-playlist-cover {
  border-color: color-mix(in srgb, var(--qqm-primary) 22%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary-soft) 24%, var(--qqm-surface-2));
}

.qqm-user-empty {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--qqm-text-muted);
  font-size: 13px;
}

.qqm-user-empty i {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid var(--qqm-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--qqm-primary-soft) 34%, transparent);
  color: var(--qqm-primary);
  font-size: 23px;
  opacity: 1;
}

.tab-indicator-enter-active,
.tab-indicator-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.tab-indicator-enter-from,
.tab-indicator-leave-to {
  opacity: 0;
  transform: translateY(2px);
}

.song-item-container {
  content-visibility: auto;
  contain-intrinsic-size: 0 52px;
}

@keyframes fadeInSoft {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

button:focus-visible {
  outline: none;
  box-shadow: none;
  outline: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 32%, transparent);
  outline-offset: 2px;
}

.user-detail-page {
  background: var(--qqm-bg, #f7f8fa);
}

.user-detail-hero-mask {
  background: color-mix(in srgb, var(--qqm-bg, #f7f8fa) 98%, transparent);
}

.user-detail-play {
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 68%, #fff 32%);
  background: color-mix(in srgb, var(--qqm-surface, #fff) 90%, transparent);
  color: var(--qqm-text, #1f2329);
}

.user-detail-play:hover {
  color: var(--qqm-primary, #22c55e);
}
</style>
