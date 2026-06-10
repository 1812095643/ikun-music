<template>
  <n-drawer
    v-model:show="modelValue"
    :width="800"
    placement="right"
    :mask-closable="true"
    :z-index="9997"
  >
    <div v-loading="loading" class="artist-drawer">
      <div class="close-btn">
        <i class="ri-close-line" @click="modelValue = false"></i>
      </div>

      <!-- 歌手信息头部 -->
      <div class="artist-header">
        <div class="artist-cover">
          <n-image
            :src="getImgUrl(artistInfo?.avatar, '300y300')"
            class="w-48 h-48 rounded-lg object-cover"
            preview-disabled
          />
        </div>
        <div class="artist-info">
          <h1 class="artist-name">{{ artistInfo?.name }}</h1>
          <div v-if="artistInfo?.alias?.length" class="artist-alias">
            {{ artistInfo.alias.join(' / ') }}
          </div>
          <div v-if="artistInfo?.briefDesc" class="artist-desc">
            {{ artistInfo.briefDesc }}
          </div>
        </div>
      </div>

      <!-- 标签页切换 -->
      <n-tabs v-model:value="activeTab" class="flex-1" type="line" animated>
        <n-tab-pane name="songs" :tab="t('artist.hotSongs')">
          <div ref="songListRef" class="songs-list">
            <n-scrollbar style="max-height: 61vh" :size="5" @scroll="handleSongScroll">
              <div class="song-list-content">
                <song-item
                  v-for="song in songs"
                  :key="song.id"
                  :item="song"
                  :list="true"
                  @play="handlePlay"
                />
                <div v-if="songLoading" class="loading-more">{{ t('common.loading') }}</div>
              </div>
              <play-bottom />
            </n-scrollbar>
          </div>
        </n-tab-pane>

        <n-tab-pane name="albums" :tab="t('artist.albums')">
          <div ref="albumListRef" class="albums-list">
            <n-scrollbar style="max-height: 61vh" :size="5" @scroll="handleAlbumScroll">
              <div class="albums-grid">
                <search-item
                  v-for="album in albums"
                  :key="album.id"
                  shape="square"
                  :z-index="9998"
                  :item="{
                    id: album.id,
                    picUrl: album.picUrl,
                    name: album.name,
                    desc: formatPublishTime(album.publishTime),
                    size: album.size,
                    type: '专辑'
                  }"
                />
                <div v-if="albumLoading" class="loading-more">{{ t('common.loading') }}</div>
              </div>
              <play-bottom />
            </n-scrollbar>
          </div>
        </n-tab-pane>

        <n-tab-pane name="about" :tab="t('artist.description')">
          <div class="artist-description">
            <n-scrollbar style="max-height: 60vh">
              <div class="description-content" v-html="artistInfo?.briefDesc"></div>
            </n-scrollbar>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </n-drawer>
</template>

<script setup lang="ts">
import { useDateFormat } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getArtistAlbums, getArtistDetail, getArtistTopSongs } from '@/api/artist';
import { getMusicDetail } from '@/api/music';
import SearchItem from '@/components/common/SearchItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore, useSettingsStore } from '@/store';
import { IArtist } from '@/types/artist';
import { getImgUrl } from '@/utils';

import PlayBottom from './PlayBottom.vue';

const { t } = useI18n();

const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();

const currentArtistId = computed({
  get: () => settingsStore.currentArtistId,
  set: (val) => settingsStore.setCurrentArtistId(val as number)
});

const modelValue = defineModel<boolean>('show', { required: true });

const activeTab = ref('songs');

// 歌手信息
const artistInfo = ref<IArtist>();
const songs = ref<any[]>([]);
const albums = ref<any[]>([]);

// 加载状态
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

watch(modelValue, (newVal) => {
  settingsStore.setShowArtistDrawer(newVal);
});
const loading = ref(false);
// 加载歌手信息

const previousArtistId = ref<number>();
const loadArtistInfo = async (id: number) => {
  // if (currentArtistId.value === id) return;
  if (previousArtistId.value === id) return;
  activeTab.value = 'songs';
  loading.value = true;
  previousArtistId.value = id;
  try {
    const info = await getArtistDetail(id);
    if (info.data?.data?.artist) {
      artistInfo.value = info.data.data.artist;
    }
    // 重置分页并加载初始数据
    resetPagination();
    await Promise.all([loadSongs(), loadAlbums()]);
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
    pageSize: 30,
    hasMore: true
  };
  albumPage.value = {
    page: 1,
    pageSize: 30,
    hasMore: true
  };
  songs.value = [];
  albums.value = [];
};

// 加载歌曲
const loadSongs = async () => {
  if (!currentArtistId.value || !songPage.value.hasMore || songLoading.value) return;

  try {
    songLoading.value = true;
    const { page, pageSize } = songPage.value;
    const res = await getArtistTopSongs({
      id: currentArtistId.value,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    const ids = res.data.songs.map((item) => item.id);
    const songsDetail = await getMusicDetail(ids);

    if (songsDetail.data?.songs) {
      const newSongs = songsDetail.data.songs.map((item) => {
        return {
          ...item,
          picUrl: item.al.picUrl,
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
    }
  } catch (error) {
    console.error('加载歌曲失败:', error);
  } finally {
    songLoading.value = false;
  }
};

// 加载专辑
const loadAlbums = async () => {
  if (!currentArtistId.value || !albumPage.value.hasMore || albumLoading.value) return;

  try {
    albumLoading.value = true;
    const { page, pageSize } = albumPage.value;
    const res = await getArtistAlbums({
      id: currentArtistId.value,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    if (res.data?.hotAlbums) {
      const newAlbums = res.data.hotAlbums;
      albums.value = page === 1 ? newAlbums : [...albums.value, ...newAlbums];
      albumPage.value.hasMore = newAlbums.length === pageSize;
      albumPage.value.page++;
    }
  } catch (error) {
    console.error('加载专辑失败:', error);
  } finally {
    albumLoading.value = false;
  }
};

// 处理滚动加载
const handleSongScroll = (e: { target: any }) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollHeight - scrollTop - clientHeight < 50) {
    loadSongs();
  }
};

const handleAlbumScroll = (e: { target: any }) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollHeight - scrollTop - clientHeight < 50) {
    loadAlbums();
  }
};

// 格式化发布时间
const formatPublishTime = (time: number) => {
  return useDateFormat(time, 'YYYY-MM-DD').value;
};

const handlePlay = () => {
  playerStore.setPlayList(
    songs.value.map((item) => ({
      ...item,
      picUrl: item.al.picUrl
    }))
  );
};

// 暴露方法给父组件
defineExpose({
  loadArtistInfo
});
</script>

<style lang="scss" scoped>
.artist-drawer {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  padding: 0 24px;
  border-left: 1px solid var(--qqm-border, rgba(20, 24, 31, 0.08));
  background: color-mix(in srgb, var(--qqm-surface, #fff) 92%, transparent);

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    width: 34px;
    height: 34px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--qqm-muted, #7a828c);
    font-size: 22px;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, var(--qqm-border));
      background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
      color: var(--qqm-primary, #22c55e);
    }
  }

  .artist-header {
    display: flex;
    gap: 22px;
    padding: 24px 42px 22px 0;
    border-bottom: 1px solid var(--qqm-border, rgba(20, 24, 31, 0.08));

    .artist-info {
      min-width: 0;
      flex: 1;

      .artist-name {
        margin-bottom: 8px;
        color: var(--qqm-text, #1f2329);
        font-size: 30px;
        font-weight: 650;
        letter-spacing: -0.03em;
      }

      .artist-alias {
        margin-bottom: 8px;
        color: var(--qqm-muted, #7a828c);
        font-size: 13px;
        font-weight: 500;
      }

      .artist-desc {
        display: -webkit-box;
        overflow: hidden;
        color: color-mix(in srgb, var(--qqm-text, #1f2329) 70%, transparent);
        font-size: 13px;
        line-height: 1.7;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }
    }
  }

  .albums-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .loading-more {
    padding: 16px 0;
    text-align: center;
    color: var(--qqm-muted, #7a828c);
    font-size: 13px;
  }

  .artist-description {
    .description-content {
      color: color-mix(in srgb, var(--qqm-text, #1f2329) 76%, transparent);
      font-size: 13px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
  }
}
</style>
