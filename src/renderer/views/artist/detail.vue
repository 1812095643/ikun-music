<template>
  <div class="artist-detail-page h-full w-full transition-colors duration-200">
    <n-scrollbar ref="scrollbarRef" class="h-full">
      <div class="artist-detail-content w-full pb-32">
        <!-- Loading State -->
        <div v-if="loading" class="artist-content">
          <!-- Hero Skeleton -->
          <div class="hero-section relative h-[400px] overflow-hidden rounded-tl-md">
            <div class="hero-bg absolute inset-0 -top-20">
              <div class="absolute inset-0 skeleton-shimmer" />
            </div>
            <div class="hero-content relative z-10 px-4 pb-6 pt-4 md:px-8 md:pt-8">
              <div class="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-10">
                <div class="h-36 w-36 md:h-48 md:w-48 skeleton-shimmer rounded-lg flex-shrink-0" />
                <div class="flex-1 space-y-4 text-center md:text-left">
                  <div class="h-6 w-20 skeleton-shimmer rounded-md" />
                  <div class="h-10 w-1/2 md:h-12 skeleton-shimmer rounded-lg" />
                  <div class="flex justify-center gap-4 md:justify-start">
                    <div class="h-6 w-24 skeleton-shimmer rounded-lg" />
                    <div class="h-6 w-24 skeleton-shimmer rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Content Skeleton -->
          <div class="mt-8 page-padding-x">
            <div class="space-y-4">
              <div v-for="i in 8" :key="i" class="flex items-center gap-4">
                <div class="h-12 w-12 skeleton-shimmer rounded-lg flex-shrink-0" />
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-1/3 skeleton-shimmer rounded-lg" />
                  <div class="h-3 w-1/4 skeleton-shimmer rounded-lg" />
                </div>
                <div class="h-8 w-8 skeleton-shimmer rounded-lg flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div v-else-if="artistInfo" class="artist-content">
          <!-- Hero Section -->
          <section class="hero-section relative overflow-hidden rounded-tl-md">
            <!-- Background Image with Blur -->
            <div class="hero-bg absolute inset-0 -top-20">
              <div
                class="absolute inset-0 bg-cover bg-center opacity-[0.025] dark:opacity-[0.035]"
                :style="{
                  backgroundImage: `url(${getImgUrl(artistInfo.cover || artistInfo.picUrl, '800y800')})`
                }"
              />
              <div class="artist-hero-wash absolute inset-0" />
            </div>

            <!-- Hero Content -->
            <div class="hero-content relative z-10 page-padding-x pt-4 md:pt-8 pb-6">
              <div class="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-end">
                <!-- Artist Avatar -->
                <div class="artist-avatar-wrapper relative group">
                  <div
                    class="avatar-glow absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 ring-1 ring-primary/20"
                  />
                  <div
                    class="avatar-container artist-cover-surface relative w-36 h-36 md:w-48 md:h-48 rounded-lg overflow-hidden"
                  >
                    <img
                      :src="getImgUrl(artistInfo.cover || artistInfo.picUrl, '500y500')"
                      :alt="artistInfo.name"
                      class="w-full h-full object-cover"
                    />
                    <!-- Play overlay on avatar -->
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/18 transition-colors duration-200"
                    >
                      <div
                        class="play-icon w-10 h-10 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                        @click="handlePlayAll"
                      >
                        <i class="iconfont icon-playfill text-2xl text-neutral-900 ml-1" />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Artist Info -->
                <div class="artist-info flex-1 text-center md:text-left">
                  <div class="artist-badge mb-2 md:mb-3">
                    <span
                      class="artist-type-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-primary text-xs font-semibold uppercase tracking-wider"
                    >
                      <i class="iconfont icon-verified text-sm" />
                      Artist
                    </span>
                  </div>
                  <h1
                    ref="titleElRef"
                    class="artist-name text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight"
                  >
                    {{ artistInfo.name }}
                  </h1>

                  <!-- Stats -->
                  <div
                    class="artist-stats flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 mt-4 md:mt-5"
                  >
                    <div v-if="artistInfo.musicSize" class="stat-item flex items-center gap-2">
                      <i class="iconfont icon-music text-primary text-lg" />
                      <span class="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        <span class="font-bold text-neutral-900 dark:text-neutral-100">{{
                          artistInfo.musicSize
                        }}</span>
                        {{ t('artist.hotSongs') }}
                      </span>
                    </div>
                    <div v-if="artistInfo.albumSize" class="stat-item flex items-center gap-2">
                      <i class="iconfont icon-album text-primary text-lg" />
                      <span class="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        <span class="font-bold text-neutral-900 dark:text-neutral-100">{{
                          artistInfo.albumSize
                        }}</span>
                        {{ t('artist.albums') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Action Bar -->
          <section class="action-bar sticky top-0 z-20 page-padding-x py-3 md:py-3.5">
            <div class="artist-action-row flex items-center justify-between gap-3">
              <!-- Left Actions -->
              <div class="artist-primary-actions flex items-center gap-2 md:gap-3">
                <!-- Play All Button -->
                <button
                  class="play-all-btn flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-colors duration-200"
                  @click="handlePlayAll"
                >
                  <i class="iconfont icon-playfill text-lg" />
                  <span class="hidden sm:inline">{{ t('comp.musicList.playAll') }}</span>
                </button>

                <!-- Add to Playlist Button -->
                <button
                  class="add-btn artist-secondary-button flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-md font-medium text-sm transition-colors duration-200"
                  @click="addToPlaylist"
                >
                  <i class="iconfont icon-add text-lg" />
                  <span class="hidden md:inline ml-2">{{ t('comp.musicList.addToPlaylist') }}</span>
                </button>
              </div>

              <!-- Right Actions -->
              <div class="artist-tool-group flex items-center gap-1">
                <!-- Search Toggle -->
                <button
                  v-if="activeTab === 'songs'"
                  class="action-btn artist-tool-button w-10 h-10 rounded-md flex items-center justify-center transition-colors duration-200"
                  :class="isSearchVisible ? 'artist-tool-button-active' : ''"
                  @click="isSearchVisible ? closeSearch() : showSearch()"
                >
                  <i class="iconfont" :class="isSearchVisible ? 'icon-close' : 'icon-search'" />
                </button>

                <!-- Layout Toggle (Desktop only) -->
                <button
                  v-if="activeTab === 'songs' && !isMobile"
                  class="action-btn artist-tool-button w-10 h-10 rounded-md flex items-center justify-center transition-colors duration-200"
                  :title="
                    isCompactLayout
                      ? t('comp.musicList.switchToNormal')
                      : t('comp.musicList.switchToCompact')
                  "
                  @click="toggleLayout"
                >
                  <i class="iconfont" :class="isCompactLayout ? 'icon-list' : 'icon-menu'" />
                </button>
              </div>
            </div>

            <!-- Search Input (Expandable) -->
            <Transition name="search-slide">
              <div v-if="isSearchVisible && activeTab === 'songs'" class="search-container mt-3">
                <div
                  class="artist-search-box relative flex items-center overflow-hidden rounded-md"
                >
                  <i class="iconfont icon-search text-neutral-400 dark:text-neutral-500 ml-4" />
                  <input
                    v-model="searchKeyword"
                    type="text"
                    :placeholder="t('comp.musicList.searchSongs')"
                    class="flex-1 px-3 py-2.5 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none"
                    @blur="handleSearchBlur"
                  />
                  <button
                    v-if="searchKeyword"
                    class="px-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    @click="searchKeyword = ''"
                  >
                    <i class="iconfont icon-close text-sm" />
                  </button>
                </div>
              </div>
            </Transition>
          </section>

          <!-- Tab Navigation -->
          <section class="tab-nav page-padding-x pt-4 md:pt-6">
            <div class="tab-list artist-tab-list relative flex w-fit gap-1 rounded-md p-1">
              <button
                v-for="tab in tabs"
                :key="tab.value"
                class="tab-item relative px-4 md:px-6 py-2 md:py-2.5 rounded-md text-sm font-medium transition-colors duration-200"
                :class="
                  activeTab === tab.value
                    ? 'text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary'
                "
                @click="activeTab = tab.value"
              >
                <span class="relative z-10">{{ tab.label }}</span>
                <!-- Active indicator -->
                <Transition name="tab-indicator">
                  <div
                    v-if="activeTab === tab.value"
                    class="artist-tab-indicator absolute inset-0 rounded-md"
                  />
                </Transition>
              </button>
            </div>
          </section>

          <!-- Tab Content -->
          <section class="tab-content page-padding-x py-6 md:py-8">
            <!-- Songs Tab -->
            <div v-show="activeTab === 'songs'" class="songs-tab">
              <!-- No Results -->
              <div
                v-if="filteredSongs.length === 0 && searchKeyword"
                class="empty-state flex flex-col items-center justify-center py-16"
              >
                <i
                  class="iconfont icon-search text-5xl text-neutral-300 dark:text-neutral-600 mb-4"
                />
                <p class="text-neutral-500 dark:text-neutral-400">
                  {{ t('comp.musicList.noSearchResults') }}
                </p>
              </div>

              <!-- Song List with CSS optimization -->
              <div v-else class="song-list" :class="{ 'compact-mode': isCompactLayout }">
                <div
                  v-for="(song, index) in filteredSongs"
                  :key="song.id"
                  class="song-item-container"
                >
                  <song-item
                    :item="formatSong(song)"
                    :compact="isCompactLayout"
                    :index="index"
                    @play="handlePlay(song)"
                  />
                </div>
              </div>

              <!-- Load More Trigger -->
              <div ref="songsLoadMoreRef" class="load-more-trigger py-8">
                <div v-if="songLoading" class="flex items-center justify-center gap-2">
                  <div
                    class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
                  />
                  <span class="text-sm text-neutral-400 dark:text-neutral-500">{{
                    t('common.loading') || '加载中'
                  }}</span>
                </div>
                <div
                  v-else-if="!songPage.hasMore && songs.length > 0"
                  class="text-center text-sm text-neutral-400 dark:text-neutral-500"
                >
                  — {{ t('common.noMore') || '没有更多了' }} —
                </div>
              </div>
            </div>

            <!-- Albums Tab -->
            <div v-show="activeTab === 'albums'" class="albums-tab">
              <!-- Album Grid -->
              <div
                v-if="albums.length > 0"
                class="album-grid grid grid-cols-2 gap-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                <div
                  v-for="album in albums"
                  :key="album.id"
                  class="album-card group cursor-pointer"
                  @click="handleAlbumClick(album)"
                >
                  <!-- Cover -->
                  <div class="album-cover relative aspect-square overflow-hidden rounded-lg">
                    <img
                      :src="getImgUrl(album.picUrl, '500y500')"
                      :alt="album.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <!-- Play Overlay -->
                    <div
                      class="play-overlay absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover:bg-black/15 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <div
                        class="play-icon w-10 h-10 rounded-lg flex items-center justify-center transition-opacity duration-200"
                      >
                        <i class="iconfont icon-playfill text-xl text-neutral-900 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <!-- Info -->
                  <div class="album-info mt-3">
                    <h3
                      class="album-name line-clamp-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100 group-hover:text-primary dark:group-hover:text-primary transition-colors"
                    >
                      {{ album.name }}
                    </h3>
                    <p class="album-date mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {{ formatPublishTime(album.publishTime) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Load More Trigger -->
              <div ref="albumsLoadMoreRef" class="load-more-trigger py-8">
                <div v-if="albumLoading" class="flex items-center justify-center gap-2">
                  <div
                    class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
                  />
                  <span class="text-sm text-neutral-400 dark:text-neutral-500">{{
                    t('common.loading') || '加载中'
                  }}</span>
                </div>
                <div
                  v-else-if="!albumPage.hasMore && albums.length > 0"
                  class="text-center text-sm text-neutral-400 dark:text-neutral-500"
                >
                  — {{ t('common.noMore') || '没有更多了' }} —
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-show="activeTab === 'about'" class="about-tab">
              <div class="about-content">
                <h2
                  class="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4 md:mb-6"
                >
                  {{ t('artist.description') }}
                </h2>
                <div
                  v-if="artistInfo.briefDesc"
                  class="prose prose-neutral dark:prose-invert max-w-none"
                >
                  <p
                    class="text-sm md:text-base leading-relaxed text-neutral-600 dark:text-neutral-300 whitespace-pre-line"
                  >
                    {{ artistInfo.briefDesc }}
                  </p>
                </div>
                <div
                  v-else
                  class="empty-state flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500"
                >
                  <i class="iconfont icon-info text-5xl mb-4 opacity-50" />
                  <p>{{ t('common.noData') || 'No description available' }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Empty State (No Artist) -->
        <div
          v-else
          class="empty-state flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 dark:text-neutral-500"
        >
          <i class="iconfont icon-user text-6xl mb-4 opacity-30" />
          <p>{{ t('common.noData') || 'Artist not found' }}</p>
        </div>
      </div>
    </n-scrollbar>

    <!-- Bottom Player Spacer -->
    <play-bottom />
  </div>
</template>

<script setup lang="ts">
import { useDateFormat } from '@vueuse/core';
import { NScrollbar, useMessage } from 'naive-ui';
import PinyinMatch from 'pinyin-match';
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { getArtistAlbums, getArtistDetail, getArtistTopSongs } from '@/api/artist';
import { getMusicDetail } from '@/api/music';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import router from '@/router';
import { usePlayerStore } from '@/store';
import { IArtist } from '@/types/artist';
import { getImgUrl, isMobile } from '@/utils';

defineOptions({
  name: 'ArtistDetail'
});

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const message = useMessage();

const artistId = computed(() => Number(route.params.id));
const activeTab = ref('songs');

const scrollbarRef = ref<any>(null);

// Tab configuration
const tabs = computed(() => [
  { value: 'songs', label: t('artist.hotSongs') },
  { value: 'albums', label: t('artist.albums') },
  { value: 'about', label: t('artist.description') }
]);

// 歌手信息
const artistInfo = ref<IArtist>();
const songs = ref<any[]>([]);
const albums = ref<any[]>([]);

const titleElRef = ref<HTMLElement | null>(null);
const artistTitle = computed(() => artistInfo.value?.name ?? '');
useScrollTitle(artistTitle, titleElRef);

// 加载状态
const loading = ref(false);
const songLoading = ref(false);
const albumLoading = ref(false);

// 分页参数
const songPage = ref({
  page: 1,
  pageSize: 30,
  hasMore: true
});

const albumPage = ref({
  page: 1,
  pageSize: 30,
  hasMore: true
});

// 无限滚动引用
const songsLoadMoreRef = ref<HTMLElement | null>(null);
const albumsLoadMoreRef = ref<HTMLElement | null>(null);
let songsObserver: IntersectionObserver | null = null;
let albumsObserver: IntersectionObserver | null = null;

// 添加上一个ID的引用，用于比较
const previousId = ref<string | null>(null);

// 简化缓存机制
const artistDataCache = new Map();

// 单个缓存键函数
const getCacheKey = (id: string | number) => `artist_${id}`;

// 搜索和布局相关
const searchKeyword = ref('');
const isSearchVisible = ref(false);
const isCompactLayout = ref(
  isMobile.value ? false : localStorage.getItem('musicListLayout') === 'compact'
);

// 导航到专辑详情
const handleAlbumClick = async (album: any) => {
  try {
    navigateToMusicList(router, {
      id: album.id,
      type: 'album',
      name: album.name,
      listInfo: {
        ...album,
        coverImgUrl: album.picUrl
      },
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to navigate to album:', error);
    message.error(t('common.loadFailed'));
  }
};

// 加载歌手信息
const loadArtistInfo = async () => {
  if (!artistId.value) return;

  // 滚动到顶部
  nextTick(() => {
    scrollbarRef.value?.scrollTo(0, 0);
  });

  // 简化缓存检查
  const cacheKey = getCacheKey(artistId.value);
  if (artistDataCache.has(cacheKey)) {
    console.log('使用缓存数据');
    const cachedData = artistDataCache.get(cacheKey);
    artistInfo.value = cachedData.artistInfo;
    songs.value = cachedData.songs;
    albums.value = cachedData.albums;
    songPage.value = cachedData.songPage;
    albumPage.value = cachedData.albumPage;
    return;
  }

  // 加载新数据
  loading.value = true;
  try {
    const info = await getArtistDetail(artistId.value);
    if (info.data?.data?.artist) {
      artistInfo.value = info.data.data.artist;
    }
    // 重置分页并加载初始数据
    resetPagination();
    await Promise.all([loadSongs(), loadAlbums()]);

    // 保存到缓存
    artistDataCache.set(cacheKey, {
      artistInfo: artistInfo.value,
      songs: [...songs.value],
      albums: [...albums.value],
      songPage: { ...songPage.value },
      albumPage: { ...albumPage.value }
    });
  } catch (error) {
    console.error('加载歌手信息失败:', error);
  } finally {
    loading.value = false;
  }
};

// 重置分页
const resetPagination = () => {
  songPage.value = {
    page: 1,
    pageSize: 50,
    hasMore: true
  };
  albumPage.value = {
    page: 1,
    pageSize: 50,
    hasMore: true
  };
  songs.value = [];
  albums.value = [];
};

// 加载歌曲
const loadSongs = async () => {
  if (!artistId.value || !songPage.value.hasMore || songLoading.value) return;

  try {
    songLoading.value = true;
    const { page, pageSize } = songPage.value;
    const res = await getArtistTopSongs({
      id: artistId.value,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    const ids = res.data.songs.map((item) => item.id);
    const songsDetail = await getMusicDetail(ids);

    if (songsDetail.data?.songs) {
      const newSongs = songsDetail.data.songs.map((item) => {
        return {
          ...item,
          picUrl: item.al?.picUrl || item.picUrl || '',
          song: {
            artists: item.ar,
            name: item.name,
            id: item.id
          }
        };
      });
      songs.value = page === 1 ? newSongs : [...songs.value, ...newSongs];
      songPage.value.hasMore = newSongs.length === pageSize;
      songPage.value.page++;
    } else {
      songPage.value.hasMore = false;
    }
  } catch (error) {
    console.error('加载歌曲失败:', error);
  } finally {
    songLoading.value = false;
  }
};

// 加载专辑
const loadAlbums = async () => {
  if (!artistId.value || !albumPage.value.hasMore || albumLoading.value) return;

  try {
    albumLoading.value = true;
    const { page, pageSize } = albumPage.value;
    const res = await getArtistAlbums({
      id: artistId.value,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    if (res.data?.hotAlbums) {
      const newAlbums = res.data.hotAlbums;
      albums.value = page === 1 ? newAlbums : [...albums.value, ...newAlbums];
      albumPage.value.hasMore = newAlbums.length === pageSize;
      albumPage.value.page++;
    } else {
      albumPage.value.hasMore = false;
    }
  } catch (error) {
    console.error('加载专辑失败:', error);
  } finally {
    albumLoading.value = false;
  }
};

// 格式化发布时间
const formatPublishTime = (time: number) => {
  return useDateFormat(time, 'YYYY-MM-DD').value;
};

// 搜索相关方法
const showSearch = () => {
  isSearchVisible.value = true;
  // 添加一个小延迟后聚焦搜索框
  nextTick(() => {
    const inputEl = document.querySelector('.search-container input');
    if (inputEl) {
      (inputEl as HTMLInputElement).focus();
    }
  });
};

const closeSearch = () => {
  isSearchVisible.value = false;
  searchKeyword.value = '';
};

const handleSearchBlur = () => {
  // 如果搜索框为空，则在失焦时关闭搜索框
  if (!searchKeyword.value) {
    setTimeout(() => {
      isSearchVisible.value = false;
    }, 200);
  }
};

// 过滤歌曲列表
const filteredSongs = computed(() => {
  if (!searchKeyword.value) {
    return songs.value;
  }

  const keyword = searchKeyword.value.toLowerCase().trim();
  return songs.value.filter((song) => {
    const songName = song.name?.toLowerCase() || '';
    const albumName = song.al?.name?.toLowerCase() || '';
    const artists = song.ar || song.artists || [];

    // 原始文本匹配
    const nameMatch = songName.includes(keyword);
    const albumMatch = albumName.includes(keyword);
    const artistsMatch = artists.some((artist: any) => {
      return artist.name?.toLowerCase().includes(keyword);
    });

    // 拼音匹配
    const namePinyinMatch = song.name && PinyinMatch.match(song.name, keyword);
    const albumPinyinMatch = song.al?.name && PinyinMatch.match(song.al.name, keyword);
    const artistsPinyinMatch = artists.some((artist: any) => {
      return artist.name && PinyinMatch.match(artist.name, keyword);
    });

    return (
      nameMatch ||
      albumMatch ||
      artistsMatch ||
      namePinyinMatch ||
      albumPinyinMatch ||
      artistsPinyinMatch
    );
  });
});

// 布局切换
const toggleLayout = () => {
  isCompactLayout.value = !isCompactLayout.value;
  localStorage.setItem('musicListLayout', isCompactLayout.value ? 'compact' : 'normal');
};

// 播放全部
const handlePlayAll = () => {
  if (filteredSongs.value.length === 0) return;

  playerStore.setPlayList(
    filteredSongs.value.map((song) => ({
      ...song,
      picUrl: song.al?.picUrl || song.picUrl || ''
    }))
  );

  // 开始播放第一首
  playerStore.setPlay(filteredSongs.value[0]);

  message.success(t('comp.musicList.playAll'));
};

// 添加到播放列表
const addToPlaylist = () => {
  if (filteredSongs.value.length === 0) return;

  // 获取当前播放列表
  const currentList = playerStore.playList;

  // 添加歌曲到播放列表(避免重复添加)
  const newSongs = filteredSongs.value.filter(
    (song) => !currentList.some((item) => item.id === song.id)
  );

  if (newSongs.length === 0) {
    message.info(t('comp.musicList.songsAlreadyInPlaylist'));
    return;
  }

  // 合并到当前播放列表末尾
  const newList = [
    ...currentList,
    ...newSongs.map((song) => ({
      ...song,
      picUrl: song.al?.picUrl || song.picUrl || ''
    }))
  ];

  playerStore.setPlayList(newList);

  message.success(t('comp.musicList.addToPlaylistSuccess', { count: newSongs.length }));
};

const handlePlay = (song?: any) => {
  // 如果传入了特定歌曲（点击单曲播放），则将其作为播放列表的第一首
  if (song) {
    const songList = [...filteredSongs.value];
    const index = songList.findIndex((item) => item.id === song.id);

    if (index !== -1) {
      // 将点击的歌曲移到第一位
      const clickedSong = songList.splice(index, 1)[0];
      songList.unshift(clickedSong);
    }

    playerStore.setPlayList(
      songList.map((item) => ({
        ...item,
        picUrl: item.al?.picUrl || item.picUrl
      }))
    );

    // 设置当前播放歌曲
    playerStore.setPlay(song);
  } else {
    // 默认行为：播放整个过滤后的列表
    playerStore.setPlayList(
      filteredSongs.value.map((item) => ({
        ...item,
        picUrl: item.al?.picUrl || item.picUrl
      }))
    );
  }
};

// 简化观察器设置
const setupObservers = () => {
  // 清理之前的观察器
  if (songsObserver) songsObserver.disconnect();
  if (albumsObserver) albumsObserver.disconnect();

  // 创建观察器(如果不存在)
  if (!songsObserver) {
    songsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && songPage.value.hasMore) {
          loadSongs();
        }
      },
      { threshold: 0.1 }
    );
  }

  if (!albumsObserver) {
    albumsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && albumPage.value.hasMore) {
          loadAlbums();
        }
      },
      { threshold: 0.1 }
    );
  }

  // 观察当前标签页的元素
  nextTick(() => {
    if (activeTab.value === 'songs' && songsLoadMoreRef.value) {
      songsObserver?.observe(songsLoadMoreRef.value);
    } else if (activeTab.value === 'albums' && albumsLoadMoreRef.value) {
      albumsObserver?.observe(albumsLoadMoreRef.value);
    }
  });
};

// 监听标签切换
watch(activeTab, () => {
  setupObservers();
});

// 监听引用元素的变化
watch([songsLoadMoreRef, albumsLoadMoreRef], () => {
  setupObservers();
});

// 搜索词变化时重新设置观察器
watch(searchKeyword, () => {
  nextTick(() => {
    setupObservers();
  });
});

onActivated(() => {
  // 确保当前路由是艺术家详情页
  if (route.name === 'artistDetail') {
    const currentId = route.params.id as string;

    // 滚动到顶部
    nextTick(() => {
      scrollbarRef.value?.scrollTo(0, 0);
    });

    // 首次加载或ID变化时加载数据
    if (!previousId.value || previousId.value !== currentId) {
      console.log('ID已变化，加载新数据');
      previousId.value = currentId;
      activeTab.value = 'songs';
      loadArtistInfo();
    }

    // 重新设置观察器
    setupObservers();
  }
});

onMounted(() => {
  // 首次挂载时加载数据
  if (route.params.id) {
    previousId.value = route.params.id as string;
    loadArtistInfo();
    setupObservers();
  }
});

onDeactivated(() => {
  // 断开观察器但不清除引用
  if (songsObserver) songsObserver.disconnect();
  if (albumsObserver) albumsObserver.disconnect();
});

onUnmounted(() => {
  // 完全清理观察器
  if (songsObserver) {
    songsObserver.disconnect();
    songsObserver = null;
  }
  if (albumsObserver) {
    albumsObserver.disconnect();
    albumsObserver = null;
  }
});

// 格式化歌曲（使用在列表中）
const formatSong = (item: any) => {
  if (!item) {
    return null;
  }
  return {
    ...item,
    picUrl: item.al?.picUrl || item.picUrl
  };
};
</script>

<style lang="scss" scoped>
/* Artist Detail Page Styles */
.artist-detail-page {
  position: relative;
  background: var(--qqm-bg, #f7f8fa);
}

/* Hero Section */
.hero-section {
  min-height: 200px;
  border-bottom: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  background: var(--qqm-bg);
}

/* Action Bar Sticky Behavior */
.action-bar {
  border-bottom: 1px solid color-mix(in srgb, var(--qqm-border) 70%, transparent);
  background: color-mix(in srgb, #ffffff 98%, var(--qqm-primary, #22c55e) 2%);
  transition:
    background-color 180ms var(--qqm-ease, ease),
    border-color 180ms var(--qqm-ease, ease);
}

.artist-action-row {
  min-height: 44px;
}

.artist-hero-wash {
  background: color-mix(in srgb, var(--qqm-bg, #f7f8fa) 94%, transparent);
  backdrop-filter: blur(14px) saturate(1.04);
}

.artist-secondary-button,
.artist-tool-button {
  border: 1px solid color-mix(in srgb, var(--qqm-border) 72%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 90%, transparent);
  color: color-mix(in srgb, var(--qqm-text, #111827) 76%, var(--qqm-muted, #737373));
  backdrop-filter: blur(12px) saturate(1.05);
}

.artist-secondary-button:hover,
.artist-tool-button:hover,
.artist-tool-button-active {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, transparent);
  background: color-mix(in srgb, #ffffff 90%, var(--qqm-primary, #22c55e) 10%);
  color: var(--qqm-primary, #22c55e);
}

.artist-tool-group {
  border: 1px solid color-mix(in srgb, var(--qqm-border) 70%, transparent);
  border-radius: 10px;
  background: var(--qqm-surface, #ffffff);
  padding: 3px;
}

.artist-tool-group .artist-tool-button {
  border-color: transparent;
  background: transparent;
}

.artist-search-box {
  border: 1px solid color-mix(in srgb, var(--qqm-border) 72%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 92%, transparent);
  backdrop-filter: blur(12px) saturate(1.05);
}

.artist-tab-list {
  border: 1px solid color-mix(in srgb, var(--qqm-border) 72%, transparent);
  background: var(--qqm-surface, #ffffff);
}

.dark .action-bar {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 14%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #050505) 96%, var(--qqm-primary, #22c55e) 4%);
}

.dark .artist-secondary-button,
.dark .artist-tool-button {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 14%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #101112) 90%, transparent);
  color: var(--qqm-text, #d4d4d4);
}

.dark .artist-secondary-button:hover,
.dark .artist-tool-button:hover,
.dark .artist-tool-button-active {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #050505) 86%, var(--qqm-primary, #22c55e) 14%);
  color: var(--qqm-primary, #22c55e);
}

.dark .artist-tool-group,
.dark .artist-search-box,
.dark .artist-tab-list {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 14%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #101112) 88%, var(--qqm-primary, #22c55e) 6%);
}

.dark .artist-hero-wash {
  background: color-mix(in srgb, var(--qqm-bg, #050505) 92%, transparent);
}

.artist-tab-indicator {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #fff));
}

/* Tab Indicator Animation */
.tab-item {
  z-index: 1;
}

.tab-item > div {
  z-index: -1;
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
  transform: translateY(0);
}

/* Search Slide Animation */
.search-slide-enter-active,
.search-slide-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(0);
  max-height: 0;
  margin-top: 0;
}

.search-slide-enter-to,
.search-slide-leave-from {
  max-height: 60px;
}

/* Virtual Song List */
.virtual-song-list {
  @apply w-full;
}

.song-list {
  @apply w-full;
}

/* CSS-based virtualization for performance */
.song-item-container {
  content-visibility: auto;
  contain-intrinsic-size: 0 72px; /* 预估高度，防止布局抖动 */
}

/* Compact layout - smaller item height */
.song-list.compact-mode .song-item-container {
  contain-intrinsic-size: 0 52px;
}

/* Loading Spinner */
.loading-spinner {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(0);
  }
}

.artist-cover-surface {
  border: 1px solid color-mix(in srgb, var(--qqm-border) 84%, transparent);
  background: var(--qqm-surface-2, var(--qqm-surface));
}

.song-list {
  overflow: hidden;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--qqm-surface, #ffffff);
}

.song-item-container + .song-item-container {
  border-top: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
}

/* Hover Effects */
.album-cover {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
  transition:
    border-color 0.2s var(--qqm-ease, ease),
    background-color 0.2s var(--qqm-ease, ease);
}

.album-card:hover .album-cover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  .hero-section {
    min-height: auto;
  }

  .action-bar {
    @apply py-2;
  }

  .tab-list {
    @apply w-full;
  }

  .tab-item {
    @apply flex-1 text-center;
  }
}

/* Focus states for accessibility */
button:focus-visible {
  @apply outline-none ring-1 ring-primary/70 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900;
}

input:focus-visible {
  @apply outline-none ring-1 ring-primary/50;
}

.play-icon {
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 82%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #fff) 90%, transparent);
  color: var(--qqm-text, #1f2329);
}

.play-icon:hover {
  color: var(--qqm-primary, #22c55e);
}

.artist-type-badge {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}
</style>
