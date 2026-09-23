<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { getAlbum, getListDetail } from '@/api/list';
import {
  getMusicDetail,
  subscribeAlbum,
  subscribePlaylist,
  updatePlaylistTracks
} from '@/api/music';
import MusicTrackList from '@/components/common/music-list/MusicTrackList.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import { useMusicStore, usePlayerStore, useRecommendStore, useUserStore } from '@/store';
import { useLocalPlaylistsStore } from '@/store/modules/localPlaylists';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { SongResult } from '@/types/music';
import { getImgUrl, isMobile } from '@/utils';
import { getLoginErrorMessage, hasPermission } from '@/utils/auth';

defineOptions({
  name: 'MusicList'
});

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const musicStore = useMusicStore();
const recommendStore = useRecommendStore();
const userStore = useUserStore();
const message = useMessage();
const playHistoryStore = usePlayHistoryStore();
const localPlaylists = useLocalPlaylistsStore();

const loading = ref(false);
const loadError = ref('');
const coverFailed = ref(false);
const trackList = ref<InstanceType<typeof MusicTrackList>>();
let loadVersion = 0;

const fetchData = async () => {
  const version = ++loadVersion;
  loadError.value = '';
  loading.value = false;
  loadingList.value = false;
  const id = route.params.id;
  const type = route.query.type;

  if (!id || type === 'dailyRecommend') return;
  if (type === 'local') {
    const playlist = localPlaylists.playlists.find((item) => item.id === String(id));
    if (playlist)
      musicStore.setCurrentMusicList(
        playlist.songs,
        playlist.name,
        { id, name: playlist.name, coverImgUrl: playlist.songs[0]?.picUrl },
        false
      );
    else {
      musicStore.clearCurrentMusicList();
      loadError.value = '没有找到这张本机歌单。';
    }
    return;
  }

  // 检查是否需要加载数据
  if (
    musicStore.currentListInfo?.id?.toString() === id.toString() &&
    musicStore.currentMusicList &&
    musicStore.currentMusicList.length > 0
  ) {
    return;
  }

  loading.value = true;
  try {
    let data: any;
    if (type === 'album') {
      const res = await getAlbum(Number(id));
      if (version !== loadVersion) return;
      data = res.data;
      if (data.code === 200) {
        musicStore.setCurrentMusicList(
          data.songs,
          data.album.name,
          { ...data.album, picUrl: data.album.picUrl },
          false
        );
      } else {
        loadError.value = '请检查网络连接，然后重新加载这个列表。';
      }
    } else if (type === 'playlist') {
      const res = await getListDetail(
        id.toString(),
        musicStore.currentListInfo?.source,
        musicStore.currentListInfo
      );
      if (version !== loadVersion) return;
      data = res.data;
      if (data.code === 200) {
        const playlist = data.playlist;
        musicStore.setCurrentMusicList(
          playlist.tracks || [],
          playlist.name,
          playlist,
          playlist.creator?.userId === userStore.user?.userId
        );
      } else {
        loadError.value = '请检查网络连接，然后重新加载这个列表。';
      }
    }
  } catch (error) {
    if (version !== loadVersion) return;
    console.error('加载列表数据失败:', error);
    loadError.value = '请检查网络连接，然后重新加载这个列表。';
  } finally {
    if (version === loadVersion) loading.value = false;
  }
};

const isDailyRecommend = computed(() => route.query.type === 'dailyRecommend');
const isAlbum = computed(() => route.query.type === 'album');

const name = computed(() => {
  if (isDailyRecommend.value) return t('comp.recommendSinger.songlist');
  return musicStore.currentMusicListName || '';
});

const titleElRef = ref<HTMLElement | null>(null);
useScrollTitle(name, titleElRef);

const songList = computed(() => {
  if (isDailyRecommend.value) return recommendStore.dailyRecommendSongs;
  return musicStore.currentMusicList || [];
});

const listInfo = computed(() => {
  if (isDailyRecommend.value) return null;
  return musicStore.currentListInfo || null;
});

const canRemove = computed(() => {
  if (isDailyRecommend.value) return false;
  return musicStore.canRemoveSong || false;
});

const canCollect = ref(false);
const isCollected = ref(false);
const pageSize = 80;
const displayedSongs = ref<SongResult[]>([]);
const loadingList = ref(false);
const hasMore = computed(() => missingIds.value.length > 0);
const missingIds = computed(() => {
  const loaded = new Set(displayedSongs.value.map((song) => String(song.id)));
  return (listInfo.value?.trackIds || [])
    .map((item: { id: number }) => item.id)
    .filter((id: number) => !loaded.has(String(id)));
});
const listSongs = computed(() =>
  displayedSongs.value.filter((song) => !playerStore.dislikeList.includes(song.id)).map(formatSong)
);
const total = computed(() => {
  if (listInfo.value?.trackIds) return listInfo.value.trackIds.length;
  return songList.value.length;
});

const getCoverImgUrl = computed(() => {
  const coverImgUrl = listInfo.value?.coverImgUrl || listInfo.value?.picUrl;
  if (coverImgUrl) return coverImgUrl;
  const song = songList.value[0];
  return song?.picUrl || song?.al?.picUrl || song?.album?.picUrl || '';
});

const formatSong = (item: any) => {
  // 专辑歌曲的 al.picUrl 可能为空，使用专辑封面兜底
  const picUrl = item.al?.picUrl || item.picUrl || (isAlbum.value ? getCoverImgUrl.value : '');
  return {
    ...item,
    picUrl,
    song: {
      artists: item.ar || item.artists,
      name: item.name,
      id: item.id
    }
  };
};

const loadMoreSongs = async () => {
  if (loading.value || loadingList.value || !hasMore.value) return;
  const version = loadVersion;
  loadingList.value = true;
  loadError.value = '';
  try {
    const { data } = await getMusicDetail(missingIds.value.slice(0, pageSize));
    if (version !== loadVersion) return;
    if (!data?.songs?.length) throw new Error('未返回歌曲详情');
    const existing = new Set(displayedSongs.value.map((song) => String(song.id)));
    displayedSongs.value = [
      ...displayedSongs.value,
      ...data.songs.filter((song: SongResult) => !existing.has(String(song.id)))
    ];
  } catch (error) {
    if (version !== loadVersion) return;
    console.warn('后续歌曲暂未加载：', error);
    loadError.value = '后续歌曲暂未加载，已有歌曲仍然可以播放。';
  } finally {
    if (version === loadVersion) loadingList.value = false;
  }
};
watch(getCoverImgUrl, () => {
  coverFailed.value = false;
});
const retryLoad = () => (displayedSongs.value.length ? loadMoreSongs() : fetchData());
const handlePlayAll = () => trackList.value?.playAll();

const handleRemoveSong = async (songId: string | number) => {
  if (!listInfo.value?.id || !canRemove.value) return;
  try {
    const res = await updatePlaylistTracks({
      op: 'del',
      pid: listInfo.value.id,
      tracks: songId.toString()
    });
    if (res.status === 200) {
      message.success(t('user.message.deleteSuccess'));
      displayedSongs.value = displayedSongs.value.filter((s) => s.id !== songId);
      musicStore.removeSongFromList(Number(songId));
    }
  } catch (error) {
    console.error('删除歌曲失败:', error);
    message.error(t('user.message.deleteFailed'));
  }
};

const saveHistory = () => {
  if (!listInfo.value?.id) return;
  if (isAlbum.value) {
    playHistoryStore.addAlbum({
      ...listInfo.value,
      id: listInfo.value.id,
      name: listInfo.value.name || '',
      picUrl: getCoverImgUrl.value,
      size: total.value,
      artist: listInfo.value.artist
    });
  } else if (route.query.type === 'playlist') {
    playHistoryStore.addPlaylist({
      ...listInfo.value,
      id: listInfo.value.id,
      name: listInfo.value.name || '',
      coverImgUrl: getCoverImgUrl.value,
      trackCount: total.value,
      playCount: listInfo.value.playCount,
      creator: listInfo.value.creator
    });
  }
};

const toggleCollect = async () => {
  if (!listInfo.value?.id || !hasPermission(true)) {
    if (!listInfo.value?.id) return;
    message.error(getLoginErrorMessage(true));
    return;
  }
  const type = route.query.type as string;
  try {
    const tVal = isCollected.value ? 2 : 1;
    const response =
      type === 'album'
        ? await subscribeAlbum({ t: tVal, id: listInfo.value.id })
        : await subscribePlaylist({ t: tVal, id: listInfo.value.id });
    if (response.data.code === 200) {
      isCollected.value = !isCollected.value;
      message.success(
        t(
          isCollected.value
            ? 'comp.musicList.collectSuccess'
            : 'comp.musicList.cancelCollectSuccess'
        )
      );
      if (type === 'album') {
        isCollected.value
          ? userStore.addCollectedAlbum(listInfo.value.id)
          : userStore.removeCollectedAlbum(listInfo.value.id);
      } else {
        listInfo.value.subscribed = isCollected.value;
      }
    }
  } catch (error) {
    console.error('操作收藏失败:', error);
    message.error(t('comp.musicList.operationFailed'));
  }
};

const checkCollectionStatus = () => {
  const type = route.query.type as string;
  if (type === 'playlist' && listInfo.value?.id) {
    canCollect.value = true;
    isCollected.value = listInfo.value.subscribed || false;
  } else if (type === 'album' && listInfo.value?.id) {
    canCollect.value = true;
    isCollected.value = userStore.isAlbumCollected(listInfo.value.id);
  } else {
    canCollect.value = false;
  }
};

watch(
  songList,
  (newSongs) => {
    displayedSongs.value = [...newSongs];
    loadingList.value = false;
    loadError.value = '';
    checkCollectionStatus();
  },
  { immediate: true }
);
watch(
  () => route.fullPath,
  () => {
    void fetchData();
  },
  { immediate: true }
);
onScopeDispose(() => {
  loadVersion++;
});
</script>

<template>
  <div class="music-list-page h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="music-list-content pb-32">
        <!-- Hero Section 和 Action Bar -->
        <n-spin :show="loading">
          <!-- Hero Section -->
          <section class="hero-section relative overflow-hidden rounded-tl-md">
            <!-- Background Image with Blur -->
            <div class="hero-bg absolute inset-0 -top-20 overflow-hidden">
              <div
                class="absolute inset-0 bg-cover bg-center scale-110 opacity-[0.1] dark:opacity-[0.12] blur-[64px] saturate-[140%]"
                :style="{
                  backgroundImage: `url(${getImgUrl(getCoverImgUrl, '800y800')})`
                }"
              ></div>
              <div class="absolute inset-0 music-hero-mask"></div>
            </div>

            <!-- Hero Content -->
            <div class="hero-content relative z-10 page-padding-x pt-4 md:pt-8 pb-7">
              <div class="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-center">
                <!-- Playlist Cover -->
                <div class="cover-wrapper relative group">
                  <div
                    class="cover-glow absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  ></div>
                  <div
                    class="music-list-cover relative w-36 h-36 md:w-40 md:h-40 rounded-lg overflow-hidden"
                  >
                    <n-image
                      v-if="getCoverImgUrl && !coverFailed"
                      @error="coverFailed = true"
                      :src="getImgUrl(getCoverImgUrl, '500y500')"
                      class="w-full h-full object-cover"
                      preview-disabled
                    />
                    <div v-else class="cover-empty-state">
                      <i aria-hidden="true" class="ri-music-2-line"></i>
                      <span>{{ isAlbum ? '专辑封面' : '歌单封面' }}</span>
                    </div>
                    <!-- Play overlay on cover -->
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-transparent group-hover:bg-black/18 transition-colors duration-200"
                      :class="isMobile ? 'pointer-events-none' : 'cursor-pointer'"
                      @click="!isMobile && handlePlayAll()"
                    >
                      <button
                        v-if="!isMobile"
                        :disabled="!listSongs.length"
                        aria-label="播放全部"
                        type="button"
                        class="play-icon w-11 h-11 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-auto"
                        @click.stop="handlePlayAll"
                      >
                        <i aria-hidden="true" class="ri-play-fill text-3xl text-neutral-900 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Playlist Info -->
                <div class="playlist-info flex-1 text-center md:text-left">
                  <div class="playlist-badge mb-3">
                    <span
                      class="music-list-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-primary text-xs font-semibold uppercase tracking-wider"
                    >
                      {{ isAlbum ? '专辑' : '歌单' }}
                    </span>
                  </div>
                  <h1
                    ref="titleElRef"
                    class="playlist-name text-2xl md:text-[30px] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight mb-3"
                  >
                    {{ name }}
                  </h1>

                  <!-- Meta Info -->
                  <div
                    class="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-5"
                  >
                    <div v-if="isAlbum && listInfo?.artist" class="flex items-center gap-2">
                      <n-avatar
                        :round="false"
                        :size="28"
                        :src="getImgUrl(listInfo.artist.picUrl, '50y50')"
                      />
                      <span
                        class="text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:text-primary cursor-pointer transition-colors"
                        >{{ listInfo.artist.name }}</span
                      >
                    </div>
                    <div v-else-if="!isAlbum && listInfo?.creator" class="flex items-center gap-2">
                      <n-avatar
                        :round="false"
                        :size="28"
                        :src="getImgUrl(listInfo.creator.avatarUrl, '50y50')"
                      />
                      <span class="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{{
                        listInfo.creator.nickname
                      }}</span>
                    </div>
                    <div class="h-3 w-px rounded-full bg-[var(--qqm-border)]"></div>
                    <span class="text-sm text-neutral-500 dark:text-neutral-400">
                      {{ t('player.songNum', { num: total }) }}
                    </span>
                  </div>

                  <p
                    v-if="listInfo?.description"
                    class="text-xs md:text-[13px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed max-w-3xl"
                  >
                    {{ listInfo.description }}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </n-spin>

        <section class="song-list-section page-padding-x">
          <music-track-list
            :key="route.fullPath"
            ref="trackList"
            :songs="listSongs"
            :loading="loading"
            :error="loadError"
            :total="total"
            :more="hasMore"
            :loading-more="loadingList"
            :can-remove="canRemove"
            @more="loadMoreSongs"
            @retry="retryLoad"
            @play="saveHistory"
            @remove="handleRemoveSong($event.id)"
          >
            <template #actions>
              <button
                v-if="canCollect"
                class="music-list-button"
                :class="{ 'is-active': isCollected }"
                :aria-pressed="isCollected"
                @click="toggleCollect"
              >
                <i aria-hidden="true" :class="isCollected ? 'ri-heart-fill' : 'ri-heart-line'" />
                {{ isCollected ? t('comp.musicList.cancelCollect') : t('comp.musicList.collect') }}
              </button>
            </template>
          </music-track-list>
        </section>
      </div>
    </n-scrollbar>
    <play-bottom />
  </div>
</template>

<style scoped>
.music-list-page {
  position: relative;
}
.hero-section {
  background: var(--qqm-bg);
}
.hero-content {
  padding-top: 32px;
  padding-bottom: 24px;
}
.music-list-cover {
  background: var(--qqm-surface-muted);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 8%);
}
.playlist-info {
  min-width: 0;
}
.playlist-name {
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.5px;
  overflow-wrap: anywhere;
}
.music-list-badge {
  color: var(--qqm-primary-strong);
  background: var(--qqm-primary-soft);
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 5px;
}
.music-hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent, var(--qqm-bg));
}
.cover-empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: var(--qqm-surface-muted);
  color: var(--qqm-muted);
}
.cover-empty-state > i {
  font-size: 38px;
}
.cover-empty-state > span {
  font-size: 12px;
}
.song-list-section {
  min-width: 0;
}
.play-icon {
  background: var(--qqm-primary);
}
@media (max-width: 720px) {
  .hero-content {
    padding-top: 20px;
    padding-bottom: 12px;
  }
}
</style>
