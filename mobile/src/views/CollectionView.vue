<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import CoverArt from '@/components/CoverArt.vue';
import SheetFrame from '@/components/SheetFrame.vue';
import TrackList from '@/components/TrackList.vue';
import type { Track } from '@/services/musicApi';
import {
  collectionError,
  collectionLoading,
  collectionSongs,
  openCollection,
  selectedCollection
} from '@/stores/browse';
import { favorites, history, playlists } from '@/stores/library';
import { playTracks } from '@/stores/player';
const emit = defineEmits<{ more: [track: Track] }>();
const filterOpen = shallowRef(false);
const filter = shallowRef('');
const sortOpen = shallowRef(false);
const sort = shallowRef<'default' | 'title' | 'artist'>('default');
const baseTracks = computed(() =>
  selectedCollection.value?.kind === 'favorites'
    ? favorites.value
    : selectedCollection.value?.kind === 'history'
      ? history.value
      : selectedCollection.value?.kind === 'local'
        ? playlists.value.find((list) => list.id === selectedCollection.value?.id)?.tracks || []
        : collectionSongs.value
);
const tracks = computed(() => {
  const key = filter.value.trim().toLowerCase();
  const list = baseTracks.value.filter(
    (song) => !key || `${song.title} ${song.artist}`.toLowerCase().includes(key)
  );
  return sort.value === 'default'
    ? list
    : [...list].sort((a, b) =>
        a[sort.value as 'title' | 'artist'].localeCompare(
          b[sort.value as 'title' | 'artist'],
          'zh-CN'
        )
      );
});
const rankPositions = computed(() =>
  selectedCollection.value?.kind === 'rank'
    ? Object.fromEntries(baseTracks.value.map((song, index) => [song.id, index + 1]))
    : undefined
);
const isPersonal = computed(() =>
  ['favorites', 'history'].includes(selectedCollection.value?.kind || '')
);
const isRank = computed(() => selectedCollection.value?.kind === 'rank');
watch(
  () => selectedCollection.value?.id,
  () => {
    filter.value = '';
    filterOpen.value = false;
    sort.value = 'default';
  }
);
</script>
<template>
  <view class="collection-view"
    ><scroll-view scroll-y class="content-scroll"
      ><view v-if="!isPersonal" class="collection-hero" :class="{ ranked: isRank }"
        ><view class="hero-copy"
          ><text class="collection-category">{{
            isRank ? '音乐排行榜' : selectedCollection?.kind === 'local' ? '我的歌单' : '精选歌单'
          }}</text
          ><text class="collection-title line-clamp">{{ selectedCollection?.title }}</text
          ><text class="collection-subtitle">{{
            isRank
              ? selectedCollection?.updateFrequency
              : baseTracks.length
                ? `${baseTracks.length} 首歌曲`
                : '收藏喜欢的每一首'
          }}</text></view
        ><view class="collection-art"
          ><view class="vinyl-disc" /><view class="collection-cover"
            ><cover-art :src="selectedCollection?.cover" radius="13px" large /></view></view></view
      ><view v-if="isPersonal" class="personal-summary"
        ><text
          class="personal-symbol"
          :class="selectedCollection?.kind === 'favorites' ? 'ri-heart-3-fill' : 'ri-history-line'"
        /><view
          ><text class="personal-title">{{ selectedCollection?.title }}</text
          ><text class="personal-description"
            >{{ baseTracks.length }} 首歌曲 ·
            {{ selectedCollection?.kind === 'favorites' ? '每一首都喜欢' : '最近听过的音乐' }}</text
          ></view
        ></view
      ><view
        v-if="selectedCollection?.description && !isRank"
        class="collection-description line-clamp"
        >{{ selectedCollection.description }}</view
      ><view class="collection-tools"
        ><view class="play-toolbar"
          ><button
            role="button"
            class="play-all"
            :disabled="!tracks.length"
            @click="playTracks(tracks)"
          >
            <view class="play-all-icon"><text class="ri-play-fill" /></view
            ><text
              >{{ filter.trim() ? '播放结果' : '播放全部'
              }}<text class="track-total">（{{ tracks.length }}）</text></text
            ></button
          ><button
            role="button"
            class="button-icon tool-icon"
            :class="{ selected: filterOpen }"
            aria-label="搜索歌单内歌曲"
            @click="
              filterOpen = !filterOpen;
              filter = '';
            "
          >
            <text class="ri-search-line" /></button
          ><button
            role="button"
            class="button-icon tool-icon"
            :class="{ selected: sort !== 'default' }"
            aria-label="歌曲排序"
            @click="sortOpen = true"
          >
            <text class="ri-sort-desc" /></button></view
        ><view v-if="filterOpen" class="filter-row"
          ><input
            v-model="filter"
            class="field-input"
            placeholder="搜索此歌单中的歌曲或歌手"
            focus
          /><button
            role="button"
            class="text-button"
            @click="
              filterOpen = false;
              filter = '';
            "
          >
            取消
          </button></view
        ></view
      ><view v-if="collectionLoading" class="state-box"
        ><text class="spinner" /><view>正在打开歌单</view></view
      ><view v-else-if="collectionError" class="state-box"
        >{{ collectionError
        }}<button
          role="button"
          class="text-button"
          @click="selectedCollection && openCollection(selectedCollection)"
        >
          重新加载
        </button></view
      ><view v-else-if="!tracks.length" class="state-box"
        ><text
          class="empty-symbol"
          :class="filter ? 'ri-search-line' : 'ri-play-list-add-line'"
        /><view>{{ filter ? '没有找到匹配的歌曲' : '还没有收藏歌曲' }}</view
        ><view class="collection-empty-tip">{{
          filter ? '试试其他歌名或歌手名。' : '在歌曲菜单中加入歌单，喜欢的音乐就会留在这里。'
        }}</view></view
      ><track-list
        :tracks="tracks"
        numbered
        :ranking="isRank"
        :positions="rankPositions"
        @more="emit('more', $event)" /><view class="content-bottom" /></scroll-view
    ><sheet-frame v-if="sortOpen" title="歌曲排序" @close="sortOpen = false"
      ><button
        v-for="item in [
          { key: 'default', label: isRank ? '榜单顺序' : '默认顺序' },
          { key: 'title', label: '按歌曲名称' },
          { key: 'artist', label: '按歌手名称' }
        ]"
        :key="item.key"
        role="button"
        class="sheet-row"
        @click="
          sort = item.key as typeof sort;
          sortOpen = false;
        "
      >
        <text>{{ item.label }}</text
        ><text
          v-if="sort === item.key"
          class="sheet-row-end ri-check-line"
          style="color: var(--qqm-accent-text)"
        /></button></sheet-frame
  ></view>
</template>
<style scoped>
.collection-view {
  height: 100%;
}
.collection-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 28px 32px 22px;
  background: linear-gradient(180deg, var(--page-wash), var(--qqm-bg));
  min-height: 198px;
}
.hero-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 13px;
  position: relative;
  z-index: 2;
}
.collection-category {
  font-size: calc(12px + var(--font-size-adjustment));
  letter-spacing: 0.8px;
  color: var(--qqm-accent-text);
}
.collection-title {
  font-size: calc(24px + var(--font-size-adjustment));
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.4px;
  -webkit-line-clamp: 3;
}
.collection-subtitle {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.collection-art {
  width: 111px;
  height: 111px;
  position: relative;
  flex-shrink: 0;
}
.collection-cover {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  box-shadow: 0 12px 23px rgba(20, 40, 26, 0.11);
  border-radius: 13px;
}
.vinyl-disc {
  position: absolute;
  right: -14px;
  top: 2px;
  border-radius: 50%;
  width: 108px;
  height: 108px;
  background: repeating-radial-gradient(circle, #333833 0, #171c18 2px, #202820 3px);
  border: 1px solid #4d594d;
}
.ranked {
  background: #91ad63;
  color: #fff;
  min-height: 210px;
  padding-top: 23px;
  padding-bottom: 35px;
}
.ranked .collection-title {
  font-size: calc(33px + var(--font-size-adjustment));
  font-weight: 700;
}
.ranked .collection-category,
.ranked .collection-subtitle {
  color: rgba(255, 255, 255, 0.9);
}
.ranked .collection-category {
  font-size: calc(14px + var(--font-size-adjustment));
}
.personal-summary {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 22px 25px;
  background: linear-gradient(180deg, var(--page-wash), var(--qqm-bg));
}
.personal-symbol {
  font-size: 37px;
  color: var(--qqm-accent-text);
}
.personal-symbol.ri-heart-3-fill {
  color: #ed727d;
}
.personal-title {
  display: block;
  font-size: calc(23px + var(--font-size-adjustment));
  font-weight: 600;
}
.personal-description {
  display: block;
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 8px;
}
.collection-description {
  font-size: calc(12px + var(--font-size-adjustment));
  line-height: 1.7;
  color: var(--qqm-muted);
  margin: 0 22px 12px;
}
.collection-tools {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--qqm-bg);
}
.play-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 14px 12px 14px 20px;
}
.play-all {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  text-align: left;
  font-size: calc(16px + var(--font-size-adjustment)) !important;
  font-weight: 550 !important;
}
.play-all-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--qqm-primary);
  color: #123d27;
  font-size: 26px;
  flex-shrink: 0;
}
.track-total {
  font-size: calc(14px + var(--font-size-adjustment));
  font-weight: 400;
}
.tool-icon {
  color: var(--qqm-muted) !important;
  font-size: 23px !important;
  width: 39px !important;
}
.tool-icon.selected {
  color: var(--qqm-accent-text) !important;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 14px;
}
.filter-row .field-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  font-size: calc(14px + var(--font-size-adjustment));
  background: var(--qqm-surface);
}
.collection-empty-tip {
  font-size: calc(12px + var(--font-size-adjustment));
  margin: 9px auto 0;
  max-width: 240px;
}
@media (max-width: 365px) {
  .collection-art {
    width: 97px;
    height: 97px;
  }
  .vinyl-disc {
    width: 94px;
    height: 94px;
  }
  .collection-title {
    font-size: calc(22px + var(--font-size-adjustment));
  }
  .ranked .collection-title {
    font-size: calc(29px + var(--font-size-adjustment));
  }
  .play-all {
    font-size: calc(15px + var(--font-size-adjustment)) !important;
  }
}
</style>
