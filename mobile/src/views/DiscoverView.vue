<script setup lang="ts">
import { computed } from 'vue';

import CoverArt from '@/components/CoverArt.vue';
import DiscoverFeatured from '@/components/DiscoverFeatured.vue';
import TrackList from '@/components/TrackList.vue';
import type { Track } from '@/services/musicApi';
import {
  activeTab,
  artists,
  artistsError,
  artistsLoading,
  discoverCategory,
  homeError,
  homeLoading,
  openCollection,
  rankings,
  ranksError,
  ranksLoading,
  refreshArtists,
  refreshHome,
  refreshRanks,
  search,
  secondaryPage,
  showCategory,
  spotlightSongs
} from '@/stores/browse';
import { deviceMode, viewport, wideLayout } from '@/stores/device';
import { history, homeCache } from '@/stores/library';
import { playTracks } from '@/stores/player';
const emit = defineEmits<{ more: [track: Track] }>();
const heroes = computed(() => homeCache.value.slice(0, 3));
const collections = computed(() => homeCache.value.slice(3));
const recommendationLimit = computed(() =>
  wideLayout.value ? (viewport.value.width >= 1480 ? 8 : viewport.value.width >= 1000 ? 6 : 3) : 3
);
const dateLabel = `${new Date().getMonth() + 1}月${new Date().getDate()}日`;
</script>
<template>
  <view class="discover-view">
    <view class="discover-tabs" role="tablist" aria-label="发现分类"
      ><button
        v-for="tab in [
          { id: 'recommend', name: '推荐' },
          { id: 'ranks', name: '排行榜' },
          { id: 'artists', name: '歌手' }
        ]"
        :key="tab.id"
        role="tab"
        :aria-selected="discoverCategory === tab.id"
        :class="{ selected: discoverCategory === tab.id }"
        @click="showCategory(tab.id as typeof discoverCategory)"
      >
        <text class="discover-tab-label">{{ tab.name }}</text></button
      ><text class="discover-date">{{ dateLabel }}</text></view
    >
    <scroll-view v-show="discoverCategory === 'recommend'" scroll-y class="discover-scroll">
      <view class="discovery-primary"
        ><view class="discovery-featured">
          <discover-featured :items="heroes" :loading="homeLoading" @select="openCollection" />
          <view v-if="homeError" class="state-box"
            >{{ homeError
            }}<button role="button" class="text-button" @click="refreshHome">重新加载</button></view
          >
          <view class="music-shortcuts"
            ><button role="button" @click="showCategory('artists')">
              <text class="ri-user-star-line" /><text>歌手</text></button
            ><button role="button" @click="showCategory('ranks')">
              <text class="ri-bar-chart-grouped-line" /><text>排行</text></button
            ><button role="button" @click="activeTab = 'playlists'">
              <text class="ri-play-list-2-line" /><text>歌单</text></button
            ><button
              role="button"
              @click="secondaryPage = deviceMode === 'car' ? 'local' : 'downloads'"
            >
              <text
                :class="deviceMode === 'car' ? 'ri-folder-music-line' : 'ri-download-2-line'"
              /><text>{{ deviceMode === 'car' ? '本地' : '下载' }}</text>
            </button></view
          > </view
        ><view v-if="spotlightSongs.length" class="discovery-suggestions"
          ><view class="section-heading"
            ><view class="heading-with-play"
              ><text class="section-title">推荐你听</text
              ><button
                role="button"
                class="section-play"
                aria-label="播放推荐歌曲"
                @click="playTracks(spotlightSongs)"
              >
                <view class="section-play-symbol"
                  ><text class="ri-play-fill"
                /></view></button></view
            ><text class="section-caption">好歌，值得循环</text></view
          ><track-list
            :tracks="spotlightSongs"
            :limit="recommendationLimit"
            compact
            @more="emit('more', $event)" /></view
      ></view>
      <template v-if="history.length"
        ><view class="section-heading"
          ><text class="section-title">继续听</text
          ><button
            role="button"
            class="section-link"
            @click="
              openCollection(
                {
                  id: 'history',
                  title: '最近播放',
                  cover: history[0]?.cover || '',
                  kind: 'history'
                },
                history
              )
            "
          >
            全部<text class="ri-arrow-right-s-line" /></button></view
        ><scroll-view scroll-x class="recent-scroll" :show-scrollbar="false"
          ><view class="recent-row"
            ><button
              v-for="(song, index) in history.slice(0, 6)"
              :key="song.id"
              role="button"
              class="recent-item"
              @click="playTracks(history, index)"
            >
              <view class="recent-cover"
                ><cover-art :src="song.cover" /><view class="small-play"
                  ><text class="ri-play-fill" /></view></view
              ><text class="recent-name ellipsis">{{ song.title }}</text
              ><text class="recent-artist ellipsis">{{ song.artist }}</text>
            </button></view
          ></scroll-view
        ></template
      >
      <view class="section-heading"
        ><text class="section-title">精选歌单</text
        ><button role="button" class="section-link" :disabled="homeLoading" @click="refreshHome">
          {{ homeLoading ? '更新中' : '刷新'
          }}<text class="ri-refresh-line" :class="{ refreshing: homeLoading }" /></button
      ></view>
      <view class="collection-grid"
        ><button
          v-for="item in collections"
          :key="item.id"
          role="button"
          class="collection-card"
          @click="openCollection(item)"
        >
          <view class="collection-art"
            ><cover-art :src="item.cover" radius="13px" /><view class="small-play"
              ><text class="ri-arrow-right-s-line" /></view></view
          ><text class="collection-name line-clamp">{{ item.title }}</text>
        </button></view
      ><view class="content-bottom" />
    </scroll-view>
    <scroll-view v-show="discoverCategory === 'ranks'" scroll-y class="discover-scroll"
      ><view class="category-heading"
        ><text class="category-caption">听见当下的好音乐</text
        ><button
          role="button"
          class="button-icon muted"
          aria-label="刷新排行榜"
          @click="refreshRanks"
        >
          <text class="ri-refresh-line" /></button></view
      ><view v-if="ranksLoading && !rankings.length" class="state-box"
        ><text class="spinner" /><view>正在更新排行榜</view></view
      ><view v-if="ranksError" class="state-box"
        >{{ ranksError
        }}<button role="button" class="text-button" @click="refreshRanks">重新加载</button></view
      ><button
        v-for="rank in rankings"
        :key="rank.id"
        role="button"
        class="rank-card"
        @click="openCollection(rank)"
      >
        <view class="rank-art"><cover-art :src="rank.cover" radius="13px" /></view
        ><view class="rank-info"
          ><text class="rank-label">{{ rank.updateFrequency || '音乐榜单' }}</text
          ><text class="rank-name">{{ rank.title }}</text
          ><text class="rank-note line-clamp">{{ rank.description }}</text></view
        ><text class="rank-arrow ri-arrow-right-s-line" /></button
      ><view class="content-bottom"
    /></scroll-view>
    <scroll-view v-show="discoverCategory === 'artists'" scroll-y class="discover-scroll"
      ><view class="category-heading"
        ><text class="category-caption">熟悉的声音，总有新的发现</text
        ><button
          role="button"
          class="button-icon muted"
          aria-label="刷新歌手"
          @click="refreshArtists"
        >
          <text class="ri-refresh-line" /></button></view
      ><view v-if="artistsLoading && !artists.length" class="state-box"
        ><text class="spinner" /><view>正在加载歌手</view></view
      ><view v-if="artistsError" class="state-box"
        >{{ artistsError
        }}<button role="button" class="text-button" @click="refreshArtists">重试</button></view
      ><view class="artists-grid"
        ><button
          v-for="artist in artists"
          :key="artist.id"
          role="button"
          class="artist-card"
          @click="search(artist.name)"
        >
          <view class="artist-photo"><cover-art :src="artist.cover" radius="50%" /></view
          ><text>{{ artist.name }}</text
          ><text class="artist-caption"
            >查看歌曲<text class="ri-arrow-right-s-line"
          /></text></button></view
      ><button role="button" class="find-artist" @click="activeTab = 'search'">
        <text class="ri-search-line" />搜索更多歌手
      </button></scroll-view
    >
  </view>
</template>
<style scoped>
.discover-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.discover-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px var(--page-gutter) 14px;
  flex-shrink: 0;
}
.discover-tabs button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px !important;
  min-height: 36px;
  height: 36px;
  font-size: calc(16px + var(--font-size-adjustment));
  font-weight: 400;
  border-radius: 22px !important;
  color: var(--qqm-muted) !important;
  position: relative;
  isolation: isolate;
}
.discover-tab-label {
  display: block;
  line-height: 1.2;
}
.discover-tabs button.selected {
  color: #103d25 !important;
  background: transparent !important;
  font-weight: 600;
}
.discover-tabs button.selected::before {
  content: '';
  position: absolute;
  inset: 4px 0;
  z-index: -1;
  border-radius: 18px;
  background: var(--qqm-primary);
}
.discover-tabs button:first-child {
  margin-left: -3px !important;
}
.discover-date {
  margin-left: auto;
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  white-space: nowrap;
}
.discover-scroll {
  flex: 1;
  min-height: 0;
}
.music-shortcuts {
  display: flex;
  margin: 12px var(--page-gutter) 0;
}
.music-shortcuts button {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: calc(13px + var(--font-size-adjustment));
  min-height: 64px;
  transition: transform 0.16s var(--qqm-ease);
}
.music-shortcuts button > text:first-child {
  font-size: 28px;
  color: var(--qqm-accent-text);
}
.music-shortcuts button:active {
  transform: translateY(1px) scale(0.96);
}
.heading-with-play {
  display: flex;
  align-items: center;
  gap: 4px;
}
.section-play {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.section-play-symbol {
  width: 27px;
  height: 27px;
  border-radius: 50% !important;
  background: var(--qqm-surface) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 1px 5px rgba(25, 42, 31, 0.035);
}
.section-play:active .section-play-symbol {
  background: var(--qqm-primary-soft) !important;
  color: var(--qqm-accent-text);
}
.recent-scroll {
  white-space: nowrap;
}
.recent-row {
  display: inline-flex;
  gap: 12px;
  padding: 0 var(--page-gutter) 4px;
}
.recent-item {
  width: 118px;
  text-align: left;
}
.recent-cover {
  height: 118px;
  position: relative;
  border-radius: 12px;
  box-shadow: var(--cover-shadow);
}
.small-play {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(18, 28, 23, 0.32);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.recent-name {
  display: block;
  font-size: calc(14px + var(--font-size-adjustment));
  margin-top: 9px;
  line-height: 1.5;
}
.recent-artist {
  display: block;
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 3px;
}
.collection-grid {
  padding: 0 var(--page-gutter);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 14px;
}
.collection-card {
  text-align: left;
  min-width: 0;
}
.collection-art {
  width: 100%;
  aspect-ratio: 1;
  position: relative;
  border-radius: 13px;
  box-shadow: var(--cover-shadow);
}
.collection-name {
  font-size: calc(14px + var(--font-size-adjustment));
  line-height: 1.6;
  font-weight: 400;
  margin-top: 10px;
}
.category-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 10px 20px;
}
.category-caption {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.rank-card {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 20px 14px !important;
  padding: 16px !important;
  border-radius: 17px !important;
  background: var(--qqm-surface) !important;
  text-align: left;
}
.rank-art {
  height: 90px;
  width: 90px;
  flex-shrink: 0;
}
.rank-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rank-label {
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-accent-text);
}
.rank-name {
  font-size: calc(21px + var(--font-size-adjustment));
  font-weight: 650;
}
.rank-note {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  line-height: 1.45;
}
.rank-arrow {
  font-size: 20px;
  color: var(--qqm-muted);
}
.artists-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px 15px;
  padding: 15px 20px 30px;
}
.artist-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: calc(15px + var(--font-size-adjustment));
}
.artist-photo {
  width: 88px;
  height: 88px;
}
.artist-caption {
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  display: flex;
  align-items: center;
  gap: 1px;
  margin-top: -7px;
}
.find-artist {
  display: flex;
  gap: 9px;
  align-items: center;
  justify-content: center;
  padding: 16px !important;
  margin: 0 20px 25px !important;
  border-radius: 14px !important;
  background: var(--qqm-surface) !important;
  color: var(--qqm-accent-text) !important;
  font-size: calc(14px + var(--font-size-adjustment));
}
.refreshing {
  animation: spin 0.8s linear infinite;
}
@media (max-width: 365px) {
  .discover-tabs {
    gap: 5px;
  }
  .discover-tabs button {
    font-size: calc(15px + var(--font-size-adjustment));
  }
  .artist-photo {
    width: 78px;
    height: 78px;
  }
}
@media (max-height: 720px) {
  .discover-tabs {
    padding-bottom: 10px;
  }
  .music-shortcuts {
    margin-top: 8px;
  }
  .music-shortcuts button {
    min-height: 52px;
    gap: 5px;
  }
  .section-heading {
    margin-top: 20px;
    margin-bottom: 8px;
  }
}
</style>
