<template>
  <div class="history-recommend-page">
    <!-- 头部标题和操作按钮 -->
    <div class="music-header h-12 flex items-center justify-between">
      <div class="music-heading min-w-0">
        <n-ellipsis :line-clamp="1" class="flex-shrink-0 mr-3">
          <div class="music-title">
            {{ t('comp.musicList.historyRecommend') }}
          </div>
        </n-ellipsis>
        <div class="music-subtitle">按日期回看每日推荐，保留熟悉的播放路径。</div>
      </div>

      <!-- 操作按钮组 -->
      <div class="flex-grow flex-1 flex items-center justify-end gap-2">
        <n-tooltip placement="bottom" trigger="hover">
          <template #trigger>
            <div class="action-button hover-green" @click="handlePlayAll">
              <i class="icon iconfont ri-play-fill"></i>
            </div>
          </template>
          {{ t('comp.musicList.playAll') }}
        </n-tooltip>

        <n-tooltip placement="bottom" trigger="hover">
          <template #trigger>
            <div class="action-button hover-green" @click="addToPlaylist">
              <i class="icon iconfont ri-add-line"></i>
            </div>
          </template>
          {{ t('comp.musicList.addToPlaylist') }}
        </n-tooltip>

        <!-- 布局切换按钮 -->
        <div class="layout-toggle" v-if="!isMobile">
          <n-tooltip placement="bottom" trigger="hover">
            <template #trigger>
              <div class="toggle-button hover-green" @click="toggleLayout">
                <i
                  class="icon iconfont"
                  :class="isCompactLayout ? 'ri-list-check-2' : 'ri-grid-line'"
                ></i>
              </div>
            </template>
            {{
              isCompactLayout
                ? t('comp.musicList.switchToNormal')
                : t('comp.musicList.switchToCompact')
            }}
          </n-tooltip>
        </div>
      </div>
    </div>

    <!-- 日期选择标签 -->
    <div v-if="availableDates.length > 0" class="date-tabs-wrapper">
      <n-tabs
        v-model:value="selectedDate"
        type="segment"
        animated
        size="large"
        @update:value="handleDateChange"
      >
        <n-tab
          v-for="date in displayedDates"
          :key="date"
          :name="date"
          :tab="formatDate(date)"
        ></n-tab>
      </n-tabs>
    </div>

    <!-- 歌曲列表内容 -->
    <div class="music-content">
      <n-spin :show="loadingDates || loadingSongs">
        <!-- 歌曲列表 -->
        <div v-if="songs.length > 0" class="music-list-container">
          <div class="music-list">
            <div class="music-list-content">
              <!-- 使用虚拟列表 -->
              <n-virtual-list
                class="song-virtual-list"
                style="max-height: calc(100vh - 200px)"
                :items="songs"
                :item-size="isCompactLayout ? 50 : 70"
                item-resizable
                key-field="id"
              >
                <template #default="{ item, index }">
                  <div>
                    <div class="double-item">
                      <song-item
                        :index="index"
                        :compact="isCompactLayout"
                        :item="formatSong(item)"
                        @play="handlePlay"
                      />
                    </div>
                    <div v-if="index === songs.length - 1" class="h-36"></div>
                  </div>
                </template>
              </n-virtual-list>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!loadingSongs" class="empty-state">
          <div class="empty-icon">
            <i class="icon iconfont ri-disc-line"></i>
          </div>
          <p class="empty-title">
            {{ selectedDate ? t('comp.musicList.noSongs') : '还没有历史日推' }}
          </p>
          <p class="empty-desc">听过每日推荐后，这里会按日期为你整理成清爽列表。</p>
        </div>
      </n-spin>
    </div>
    <play-bottom />
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getHistoryRecommendDates, getHistoryRecommendSongs } from '@/api/music';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { isMobile } from '@/utils';

const { t } = useI18n();
const message = useMessage();
const playerStore = usePlayerStore();

// 状态
const availableDates = ref<string[]>([]);
const selectedDate = ref<string>('');
const songs = ref<SongResult[]>([]);
const loadingDates = ref(false);
const loadingSongs = ref(false);
const isCompactLayout = ref(
  isMobile.value ? false : localStorage.getItem('musicListLayout') === 'compact'
);

// 只显示最近的10个日期
const displayedDates = computed(() => {
  return availableDates.value.slice(0, 10);
});

// 格式化日期显示
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 判断是否是今天或昨天
  if (date.toDateString() === today.toDateString()) {
    return t('common.today');
  } else if (date.toDateString() === yesterday.toDateString()) {
    return t('common.yesterday');
  }

  // 格式化为 MM月DD日
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
};

// 格式化歌曲数据
const formatSong = (item: any) => {
  if (!item) return null;
  return {
    ...item,
    picUrl: item.al?.picUrl || item.album?.picUrl || item.picUrl,
    song: {
      artists: item.ar || item.artists || [],
      name: item.al?.name || item.album?.name || item.name,
      id: item.al?.id || item.album?.id || item.id
    }
  };
};

// 获取可用日期列表
const fetchAvailableDates = async () => {
  try {
    loadingDates.value = true;
    const { data } = await getHistoryRecommendDates();
    if (data?.data?.dates) {
      availableDates.value = data.data.dates;
      // 默认选择第一个日期（最近的日期）
      if (availableDates.value.length > 0) {
        selectedDate.value = availableDates.value[0];
        await fetchSongsByDate(selectedDate.value);
      }
    }
  } catch (error) {
    console.error('获取历史日推日期列表失败:', error);
    message.error(t('comp.musicList.fetchDatesFailed'));
  } finally {
    loadingDates.value = false;
  }
};

// 根据日期获取歌曲列表
const fetchSongsByDate = async (date: string) => {
  try {
    loadingSongs.value = true;
    const { data } = await getHistoryRecommendSongs(date);
    if (data?.data?.songs) {
      songs.value = data.data.songs;
    } else {
      songs.value = [];
    }
  } catch (error) {
    console.error('获取历史日推歌曲失败:', error);
    message.error(t('comp.musicList.fetchSongsFailed'));
    songs.value = [];
  } finally {
    loadingSongs.value = false;
  }
};

// 处理日期变化
const handleDateChange = async (date: string) => {
  selectedDate.value = date;
  await fetchSongsByDate(date);
};

// 切换布局
const toggleLayout = () => {
  isCompactLayout.value = !isCompactLayout.value;
  localStorage.setItem('musicListLayout', isCompactLayout.value ? 'compact' : 'normal');
};

// 添加到播放列表末尾
const addToPlaylist = () => {
  if (songs.value.length === 0) return;

  // 获取当前播放列表
  const currentList = playerStore.playList;

  // 添加歌曲到播放列表(避免重复添加)
  const newSongs = songs.value.filter((song) => !currentList.some((item) => item.id === song.id));

  if (newSongs.length === 0) {
    message.info(t('comp.musicList.songsAlreadyInPlaylist'));
    return;
  }

  // 合并到当前播放列表末尾
  const newList = [...currentList, ...newSongs.map(formatSong)];
  playerStore.setPlayList(newList);

  message.success(t('comp.musicList.addToPlaylistSuccess', { count: newSongs.length }));
};

// 播放单首歌曲
const handlePlay = () => {
  if (songs.value.length === 0) return;
  playerStore.setPlayList(songs.value.map(formatSong));
};

// 播放全部
const handlePlayAll = () => {
  if (songs.value.length === 0) return;
  playerStore.setPlayList(songs.value.map(formatSong));
  playerStore.setPlay(formatSong(songs.value[0]));
};

// 组件挂载时获取数据
onMounted(() => {
  fetchAvailableDates();
});
</script>

<style scoped lang="scss">
.history-recommend-page {
  height: 100%;
  margin-right: 8px;
  padding: 0 18px;
  border-radius: 10px;
  background: var(--qqm-bg, #f7f8fa);
}

.music {
  &-header {
    min-height: 72px;
    border-bottom: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  }

  &-heading {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  &-title {
    color: var(--qqm-text, #1f2329);
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  &-subtitle {
    color: var(--qqm-muted, #7a828c);
    font-size: 13px;
    font-weight: 500;
  }

  &-content {
    height: calc(100% - 96px);
    padding-top: 14px;
  }

  &-list {
    flex-grow: 1;
    min-height: 0;

    &-container {
      position: relative;
      display: flex;
      width: 100%;
      min-height: 0;
      flex-direction: column;
      flex-grow: 1;
    }

    &-content {
      min-height: calc(80vh - 60px);
    }
  }
}

.date-tabs-wrapper {
  margin: 12px 0 4px;
}

.action-button,
.layout-toggle .toggle-button {
  display: flex;
  width: 34px;
  height: 34px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--qqm-surface, #ffffff);
  color: var(--qqm-muted, #7a828c);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);

  .icon {
    font-size: 18px;
  }

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 28%, var(--qqm-border));
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface));
    color: var(--qqm-primary, #22c55e);
    transform: translateY(-1px);
  }
}

.song-virtual-list {
  width: 100%;

  :deep(.n-virtual-list__scroll) {
    scrollbar-width: thin;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: color-mix(in srgb, var(--qqm-muted, #7a828c) 28%, transparent);
    }
  }
}

.double-item {
  width: 100%;
  margin-bottom: 2px;
  border-radius: 8px;
  transition: background-color 0.18s ease;

  &:hover {
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
  }
}

.empty-state {
  display: flex;
  min-height: 320px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  margin-top: 18px;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 12px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 3%, var(--qqm-surface, #ffffff));
  color: var(--qqm-muted, #7a828c);
}

.empty-icon {
  display: flex;
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--qqm-primary-soft, rgba(34, 197, 94, 0.12));
  color: var(--qqm-primary, #22c55e);

  .icon {
    font-size: 28px;
  }
}

.empty-title {
  margin-top: 14px;
  color: var(--qqm-text, #1f2329);
  font-size: 16px;
  font-weight: 650;
}

.empty-desc {
  margin-top: 6px;
  color: var(--qqm-muted, #7a828c);
  font-size: 13px;
  font-weight: 500;
}

:deep(.n-tabs-rail) {
  overflow: hidden !important;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px !important;
  background: var(--qqm-surface, #ffffff) !important;

  .n-tabs-capsule {
    border-radius: 8px !important;
    background-color: var(--qqm-primary, #22c55e) !important;
  }

  .n-tabs-tab {
    font-weight: 600;
  }

  .n-tabs-tab--active {
    color: #fff !important;
  }
}
</style>
