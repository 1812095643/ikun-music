<script setup lang="ts">
import CoverArt from '@/components/CoverArt.vue';
import { activeTab, openCollection, secondaryPage } from '@/stores/browse';
import {
  downloadRecords,
  favorites,
  history,
  type LocalPlaylist,
  playlists
} from '@/stores/library';
import { localTracks } from '@/stores/localMusic';
import { playTracks } from '@/stores/player';
const emit = defineEmits<{ create: []; manage: [list: LocalPlaylist] }>();
function openFavorites() {
  void openCollection(
    {
      id: 'favorites',
      title: '我喜欢的音乐',
      cover: favorites.value[0]?.cover || '',
      kind: 'favorites'
    },
    favorites.value
  );
}
function openHistory() {
  void openCollection(
    { id: 'history', title: '最近播放', cover: history.value[0]?.cover || '', kind: 'history' },
    history.value
  );
}
</script>
<template>
  <scroll-view scroll-y class="content-scroll"
    ><view class="library-welcome"
      ><image class="library-brand" src="/static/brand.png" mode="aspectFill" /><view
        ><text class="library-name">ikun 音乐</text
        ><text class="library-tagline">喜欢的音乐，一直在这里。</text></view
      ></view
    ><view class="library-shortcuts"
      ><button role="button" @click="openFavorites">
        <text class="ri-heart-3-fill" /><text>收藏</text
        ><text class="shortcut-count">{{ favorites.length }}</text></button
      ><button role="button" @click="secondaryPage = 'downloads'">
        <text class="ri-download-2-fill" /><text>本地下载</text
        ><text class="shortcut-count">{{
          downloadRecords.filter((item) => item.state === 'completed').length
        }}</text></button
      ><button role="button" @click="activeTab = 'playlists'">
        <text class="ri-play-list-2-fill" /><text>我的歌单</text
        ><text class="shortcut-count">{{ playlists.length }}</text></button
      ><button role="button" @click="openHistory">
        <text class="ri-history-fill" /><text>最近播放</text
        ><text class="shortcut-count">{{ history.length }}</text>
      </button></view
    ><view class="section-heading"
      ><text class="section-title">最近播放</text
      ><button role="button" class="section-link" @click="openHistory">
        全部<text class="ri-arrow-right-s-line" /></button></view
    ><scroll-view v-if="history.length" scroll-x class="history-scroll" :show-scrollbar="false"
      ><view class="history-row"
        ><button role="button" class="history-card history-all" @click="openHistory">
          <view class="history-mosaic"
            ><view
              v-for="song in history.slice(0, 4)"
              :key="song.id"
              :class="{ solo: history.length === 1 }"
              ><cover-art :src="song.cover" radius="0" /></view
            ><view class="mosaic-play"><text class="ri-play-fill" /></view></view
          ><text class="history-title">已播歌曲</text
          ><text class="history-artist">{{ history.length }} 首</text></button
        ><button
          v-for="(song, index) in history.slice(0, 5)"
          :key="song.id"
          role="button"
          class="history-card"
          @click="playTracks(history, index)"
        >
          <view class="history-cover"><cover-art :src="song.cover" radius="13px" /></view
          ><text class="history-title ellipsis">{{ song.title }}</text
          ><text class="history-artist ellipsis">{{ song.artist }}</text>
        </button></view
      ></scroll-view
    ><view v-else class="library-empty"
      ><text class="ri-headphone-line" /><text>听过的歌曲会留在这里</text
      ><button role="button" class="text-button" @click="activeTab = 'discover'">
        去发现好音乐<text class="ri-arrow-right-s-line" /></button></view
    ><view class="section-heading"
      ><text class="section-title"
        >自建歌单<text class="library-list-count">{{ playlists.length }}</text></text
      ><button role="button" class="button-icon" aria-label="新建歌单" @click="emit('create')">
        <text class="ri-add-line" /></button></view
    ><button v-if="!playlists.length" role="button" class="create-playlist" @click="emit('create')">
      <view class="create-list-symbol"><text class="ri-add-line" /></view
      ><view
        ><text>新建一张歌单</text
        ><text class="create-list-caption">为通勤、散步或某个特别的时刻</text></view
      ><text class="ri-arrow-right-s-line" /></button
    ><view v-for="list in playlists.slice(0, 5)" :key="list.id" class="library-playlist"
      ><button
        role="button"
        class="library-playlist-main"
        @click="
          openCollection(
            { id: list.id, title: list.title, cover: list.tracks[0]?.cover || '', kind: 'local' },
            list.tracks
          )
        "
      >
        <view class="library-playlist-cover"
          ><cover-art :src="list.tracks[0]?.cover" radius="10px" /></view
        ><view
          ><text class="library-playlist-title ellipsis">{{ list.title }}</text
          ><text class="library-playlist-count">{{ list.tracks.length }} 首歌曲</text></view
        ></button
      ><button
        role="button"
        class="button-icon muted"
        :aria-label="`${list.title}的操作`"
        @click="emit('manage', list)"
      >
        <text class="ri-more-2-fill" /></button></view
    ><view class="library-device-tools"
      ><button role="button" class="library-settings" @click="secondaryPage = 'local'">
        <text class="ri-folder-music-line" /><view
          ><text>本地音乐</text
          ><text class="device-tool-description"
            >{{ localTracks.length }} 首 · 扫描与勾选导入</text
          ></view
        ><text class="ri-arrow-right-s-line" />
      </button>
      <button role="button" class="library-settings" @click="secondaryPage = 'transfer'">
        <text class="ri-share-forward-box-line" /><view
          ><text>局域网互传</text
          ><text class="device-tool-description">与手机、平板互传文件和文字</text></view
        ><text class="ri-arrow-right-s-line" /></button
    ></view>
    <button role="button" class="library-settings" @click="secondaryPage = 'settings'">
      <text class="ri-settings-3-line" /><text>音乐设置</text
      ><text class="ri-arrow-right-s-line" /></button
    ><view class="content-bottom"
  /></scroll-view>
</template>
<style scoped>
.device-tool-description {
  display: block;
  font-size: 11px;
  color: var(--qqm-muted);
  margin-top: 5px;
}
.library-settings > view {
  flex: 1;
  text-align: left;
}
.library-welcome {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 16px 23px 27px;
}
.library-brand {
  width: 58px;
  height: 58px;
  border-radius: 19px;
}
.library-name {
  display: block;
  font-size: calc(21px + var(--font-size-adjustment));
  font-weight: 600;
}
.library-tagline {
  display: block;
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 8px;
}
.library-shortcuts {
  display: flex;
  padding: 5px 13px 12px;
}
.library-shortcuts button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: calc(13px + var(--font-size-adjustment));
}
.library-shortcuts button > text:first-child {
  font-size: 29px;
  color: var(--qqm-text);
  margin-bottom: 3px;
}
.library-shortcuts button:first-child > text:first-child {
  color: #ed737e;
}
.shortcut-count {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: -3px;
}
.history-scroll {
  white-space: nowrap;
}
.history-row {
  display: inline-flex;
  padding: 0 20px;
  gap: 13px;
}
.history-card {
  width: 119px;
  min-width: 0;
  text-align: left;
}
.history-cover {
  height: 119px;
}
.history-mosaic {
  height: 119px;
  width: 119px;
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  border-radius: 13px;
  overflow: hidden;
  background: var(--qqm-surface-muted);
  gap: 1px;
}
.history-mosaic > .solo {
  grid-column: span 2;
  grid-row: span 2;
}
.mosaic-play {
  position: absolute;
  right: 9px;
  bottom: 8px;
  color: white;
  font-size: 23px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
}
.history-title {
  display: block;
  font-size: calc(14px + var(--font-size-adjustment));
  margin-top: 11px;
}
.history-artist {
  display: block;
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 5px;
}
.library-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
  color: var(--qqm-muted);
  font-size: calc(13px + var(--font-size-adjustment));
}
.library-empty > .ri-headphone-line {
  font-size: 34px;
  opacity: 0.7;
}
.library-empty .text-button {
  font-size: calc(12px + var(--font-size-adjustment)) !important;
}
.library-list-count {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-left: 7px;
  font-weight: 400;
}
.create-playlist {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 5px 22px !important;
  text-align: left;
  font-size: calc(15px + var(--font-size-adjustment)) !important;
}
.create-list-symbol {
  width: 59px;
  height: 59px;
  border-radius: 12px;
  background: var(--qqm-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 27px;
  color: var(--qqm-accent-text);
}
.create-list-caption {
  display: block;
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 8px;
}
.create-playlist > .ri-arrow-right-s-line {
  margin-left: auto;
  color: var(--qqm-muted);
}
.library-playlist {
  display: flex;
  align-items: center;
  padding: 8px 13px 8px 20px;
}
.library-playlist-main {
  display: flex;
  align-items: center;
  gap: 13px;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.library-playlist-cover {
  width: 59px;
  height: 59px;
  flex-shrink: 0;
}
.library-playlist-main > view:last-child {
  flex: 1;
  min-width: 0;
}
.library-playlist-title {
  display: block;
  font-size: calc(15px + var(--font-size-adjustment));
}
.library-playlist-count {
  display: block;
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 7px;
}
.library-playlist .button-icon {
  font-size: 20px !important;
}
.library-settings {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 27px 20px 0 !important;
  padding: 16px 15px !important;
  border-radius: 13px !important;
  background: var(--qqm-surface) !important;
  font-size: calc(14px + var(--font-size-adjustment)) !important;
  text-align: left;
}
.library-settings > .ri-settings-3-line {
  font-size: 21px;
}
.library-settings > .ri-arrow-right-s-line {
  margin-left: auto;
  font-size: 21px;
  color: var(--qqm-muted);
}
</style>
