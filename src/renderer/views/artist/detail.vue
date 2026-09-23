<script setup lang="ts">
import { useDateFormat } from '@vueuse/core';
import { NScrollbar, useMessage } from 'naive-ui';
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
import { getSearch } from '@/api/search';
import { getYoutubeMusicArtistDetail } from '@/api/youtubeMusic';
import MusicTrackList from '@/components/common/music-list/MusicTrackList.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { SEARCH_TYPE } from '@/const/bar-const';
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
const routeArtistKeyword = computed(() => {
  const keyword = route.query.keyword;
  return typeof keyword === 'string' ? keyword.trim() : '';
});
const routeYoutubeBrowseId = computed(() => {
  const browseId = route.query.browseId;
  return typeof browseId === 'string' ? browseId.trim() : '';
});
const isSearchPoweredArtistEntry = computed(() => {
  const source = String(route.query.source || '');
  return (
    ['home-artist-search', 'kuwo-artist-search', 'ytmusic-artist-search', 'artist-search'].includes(
      source
    ) && Boolean(routeArtistKeyword.value)
  );
});
const isYoutubeArtistEntry = computed(
  () =>
    String(route.query.source || '') === 'ytmusic-artist-search' &&
    Boolean(routeYoutubeBrowseId.value)
);
const artistSongSearchKeyword = computed(() =>
  isSearchPoweredArtistEntry.value ? routeArtistKeyword.value : ''
);
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
const albumsLoadMoreRef = ref<HTMLElement | null>(null);
let albumsObserver: IntersectionObserver | null = null;

// 添加上一个路由签名的引用，用于比较歌手 ID 和首页搜索入口关键词是否变化
const previousId = ref<string | null>(null);

// 简化缓存机制：首页搜索入口和普通入口的歌曲来源不同，缓存键必须隔离
const artistDataCache = new Map();

// 单个缓存键函数
const getCacheKey = (id: string | number) =>
  `artist_${id}_${artistSongSearchKeyword.value || 'native'}`;

const getCurrentArtistRouteKey = () =>
  `${route.params.id || ''}_${artistSongSearchKeyword.value || 'native'}`;

const normalizeArtistSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[《》<>「」『』"'“”‘’()[\]（）【】\-_.·]/g, '');

const getSongArtists = (song: any) => song.ar || song.artists || song.song?.artists || [];

const formatSearchSong = (item: any) => {
  const artists = getSongArtists(item);
  const album = item.al || item.album || { id: 0, name: '酷我音乐', picUrl: item.picUrl || '' };

  return {
    ...item,
    ar: artists,
    artists,
    al: album,
    album,
    picUrl: album.picUrl || item.picUrl || '',
    song: {
      ...(item.song || {}),
      artists,
      name: item.name,
      id: item.id
    },
    source: item.source || 'netease'
  };
};

const filterSongsByArtistKeyword = (songList: any[], keyword: string) => {
  const normalizedKeyword = normalizeArtistSearchText(keyword);
  if (!normalizedKeyword) return songList;

  const matchedSongs = songList.filter((song) => {
    const artists = getSongArtists(song);
    return artists.some((artist: any) => {
      const artistName = normalizeArtistSearchText(artist?.name || '');
      return artistName.includes(normalizedKeyword) || normalizedKeyword.includes(artistName);
    });
  });

  return matchedSongs.length > 0 ? matchedSongs : songList;
};

const buildSearchPoweredArtistInfo = async (): Promise<IArtist | undefined> => {
  if (!artistSongSearchKeyword.value) return undefined;

  if (isYoutubeArtistEntry.value) {
    try {
      const { artist } = await getYoutubeMusicArtistDetail(routeYoutubeBrowseId.value);
      return artist as IArtist;
    } catch (error) {
      // 根因：YouTube Music 艺人详情是公开外部接口，地区、Key 或接口结构波动时可能失败。
      // 歌手详情页本身不能因此空白，先返回基础歌手信息，再让歌曲列表走歌手名搜索兜底。
      console.warn('YouTube Music 艺人信息读取失败，已使用歌手名基础信息兜底。', error);
      return {
        id: artistId.value,
        name: artistSongSearchKeyword.value,
        cover: '',
        avatar: '',
        picUrl: '',
        briefDesc: '',
        albumSize: 0,
        musicSize: 0,
        mvSize: 0,
        transNames: [],
        alias: [],
        identities: [],
        identifyTag: [],
        rank: { rank: 0, type: 0 }
      } as IArtist;
    }
  }

  const { data } = await getSearch({
    keywords: artistSongSearchKeyword.value,
    type: SEARCH_TYPE.ARTIST,
    limit: 10,
    offset: 0
  });
  const artists = data?.result?.artists || [];
  if (!Array.isArray(artists) || artists.length === 0) return undefined;

  const normalizedKeyword = normalizeArtistSearchText(artistSongSearchKeyword.value);
  const currentId = artistId.value;
  const matchedArtist =
    artists.find((artist: any) => Number(artist?.id) === currentId) ||
    artists.find(
      (artist: any) => normalizeArtistSearchText(artist?.name || '') === normalizedKeyword
    ) ||
    artists[0];

  const picUrl =
    matchedArtist.picUrl ||
    matchedArtist.cover ||
    matchedArtist.avatar ||
    matchedArtist.img1v1Url ||
    '';

  return {
    id: Number(matchedArtist.id || currentId),
    name: matchedArtist.name || artistSongSearchKeyword.value,
    cover: picUrl,
    avatar: picUrl,
    picUrl,
    briefDesc: matchedArtist.briefDesc || '',
    albumSize: Number(matchedArtist.albumSize || 0),
    musicSize: Number(matchedArtist.musicSize || 0),
    mvSize: Number(matchedArtist.mvSize || 0),
    transNames: matchedArtist.transNames || [],
    alias: matchedArtist.alias || [],
    identities: [],
    identifyTag: [],
    rank: {
      rank: 0,
      type: 0
    }
  } as IArtist;
};

const trackList = ref<InstanceType<typeof MusicTrackList>>();
const listSongs = computed(() => songs.value.map(formatSong));

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
    if (isSearchPoweredArtistEntry.value) {
      // 根因：酷我歌手搜索返回的是酷我 ARTISTID，不能当作网易云 artist/detail 的 ID 使用；
      // YouTube Music 歌手搜索返回的是 browseId，同样不能当网易云 ID 使用。搜索驱动入口
      // 只把歌手详情当承载页：先拿对应渠道的头像/歌曲数，再用渠道详情或歌手名搜索歌曲，
      // 保持酷我优先播放链路，同时让 YouTube Music 艺人主页接口真正有用户入口。
      artistInfo.value =
        (await buildSearchPoweredArtistInfo()) ||
        ({
          id: artistId.value,
          name: artistSongSearchKeyword.value,
          cover: '',
          avatar: '',
          picUrl: '',
          briefDesc: '',
          albumSize: 0,
          musicSize: 0,
          mvSize: 0,
          transNames: [],
          alias: [],
          identities: [],
          identifyTag: [],
          rank: { rank: 0, type: 0 }
        } as IArtist);
    } else {
      const info = await getArtistDetail(artistId.value);
      if (info.data?.data?.artist) {
        artistInfo.value = info.data.data.artist;
      }
    }
    // 重置分页并加载初始数据
    resetPagination();
    if (isSearchPoweredArtistEntry.value) {
      albumPage.value.hasMore = false;
      await loadSongs();
    } else {
      await Promise.all([loadSongs(), loadAlbums()]);
    }

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

    if (artistSongSearchKeyword.value) {
      if (isYoutubeArtistEntry.value) {
        try {
          const { songs: youtubeSongs } = await getYoutubeMusicArtistDetail(
            routeYoutubeBrowseId.value
          );
          if (youtubeSongs.length > 0) {
            songs.value = page === 1 ? youtubeSongs : [...songs.value, ...youtubeSongs];
            songPage.value.hasMore = false;
            songPage.value.page++;
            return;
          }
        } catch (error) {
          // 根因：YouTube Music 艺人主页属于外部公开能力，可能受地区、Key 或接口结构影响。
          // 失败时不让详情页空白，继续用歌手名走 getSearch(type=单曲)，该链路仍优先酷我。
          console.warn('YouTube Music 艺人主页歌曲读取失败，已切换到歌手名搜索兜底。', error);
        }
      }

      const { data } = await getSearch({
        keywords: artistSongSearchKeyword.value,
        type: SEARCH_TYPE.MUSIC,
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      const searchSongs = (data?.result?.songs || []).map(formatSearchSong);
      const matchedSongs = filterSongsByArtistKeyword(searchSongs, artistSongSearchKeyword.value);

      // 根因：首页歌手点击进入详情页后，页面仍直接调用歌手热门歌曲接口，
      // 这会绕过“酷我优先搜索三次重试”的稳定链路，用户在歌手详情里点播放仍可能无声。
      // 解决思路：只对首页歌手搜索入口启用这条路径，先用歌手名执行单曲搜索，
      // getSearch(type=单曲) 会优先走酷我并在三次失败后回退本地后端；然后把结果仍展示在歌手详情页。
      songs.value = page === 1 ? matchedSongs : [...songs.value, ...matchedSongs];
      songPage.value.hasMore = searchSongs.length === pageSize;
      songPage.value.page++;
      return;
    }

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
const handlePlayAll = () => trackList.value?.playAll();

// 简化观察器设置
const setupObservers = () => {
  // 清理之前的观察器
  if (albumsObserver) albumsObserver.disconnect();

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
    if (activeTab.value === 'albums' && albumsLoadMoreRef.value) {
      albumsObserver?.observe(albumsLoadMoreRef.value);
    }
  });
};

// 监听标签切换
watch(activeTab, () => {
  setupObservers();
});

// 监听引用元素的变化
watch(albumsLoadMoreRef, () => {
  setupObservers();
});

watch(
  () => getCurrentArtistRouteKey(),
  (currentRouteKey) => {
    if (route.name !== 'artistDetail' || !currentRouteKey || previousId.value === currentRouteKey) {
      return;
    }

    previousId.value = currentRouteKey;
    activeTab.value = 'songs';
    loadArtistInfo();
    setupObservers();
  }
);

onActivated(() => {
  // 确保当前路由是艺术家详情页
  if (route.name === 'artistDetail') {
    const currentRouteKey = getCurrentArtistRouteKey();

    // 滚动到顶部
    nextTick(() => {
      scrollbarRef.value?.scrollTo(0, 0);
    });

    // 首次加载、ID 变化或首页搜索入口关键词变化时加载数据
    if (!previousId.value || previousId.value !== currentRouteKey) {
      console.log('歌手路由签名已变化，加载新数据');
      previousId.value = currentRouteKey;
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
    previousId.value = getCurrentArtistRouteKey();
    loadArtistInfo();
    setupObservers();
  }
});

onDeactivated(() => {
  // 断开观察器但不清除引用
  if (albumsObserver) albumsObserver.disconnect();
});

onUnmounted(() => {
  // 完全清理观察器
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
                <div class="h-36 w-36 md:h-40 md:w-40 skeleton-shimmer rounded-lg flex-shrink-0" />
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
                    class="avatar-container artist-cover-surface relative w-36 h-36 md:w-40 md:h-40 rounded-lg overflow-hidden"
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
                    class="artist-name text-2xl md:text-[30px] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight"
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
          <section class="tab-content page-padding-x pb-8">
            <!-- Songs Tab -->
            <div v-show="activeTab === 'songs'" class="songs-tab">
              <music-track-list
                :key="getCurrentArtistRouteKey()"
                ref="trackList"
                :songs="listSongs"
                default-order="热门歌曲"
                :more="songPage.hasMore"
                :loading-more="songLoading"
                :loading="songLoading && !songs.length"
                @more="loadSongs"
              >
                <template #actions
                  ><button
                    class="music-list-button"
                    :disabled="!songs.length"
                    @click="trackList?.addAllToQueue()"
                  >
                    <i class="ri-play-list-add-line" />{{ t('comp.musicList.addToPlaylist') }}
                  </button></template
                >
              </music-track-list>
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

.artist-hero-wash {
  background: color-mix(in srgb, var(--qqm-bg) 94%, transparent);
}
.artist-name {
  line-height: 1.3;
  font-weight: 650;
}
.artist-tab-indicator {
  border: 0;
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

.artist-cover-surface {
  border: 1px solid color-mix(in srgb, var(--qqm-border) 84%, transparent);
  background: var(--qqm-surface-2, var(--qqm-surface));
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
.artist-tab-list {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--qqm-border);
  border-radius: 0;
  padding: 0;
  width: 100%;
  gap: 30px;
}
.artist-tab-list .tab-item {
  padding: 0 0 16px;
  border-radius: 0;
  font-size: 16px;
}
.artist-tab-list .tab-item:has(.artist-tab-indicator) {
  color: var(--qqm-primary-strong);
  font-weight: 600;
}
.artist-tab-list .artist-tab-indicator {
  top: auto;
  bottom: 0;
  width: 27px;
  height: 3px;
  border-radius: 2px;
  background: var(--qqm-primary);
  box-shadow: none;
}
</style>
