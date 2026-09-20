<script setup lang="ts">
import { shallowRef } from 'vue';

import CoverArt from '@/components/CoverArt.vue';
import { openCollection, secondaryPage } from '@/stores/browse';
import { favorites, type LocalPlaylist, playlists } from '@/stores/library';
const emit = defineEmits<{ create: []; manage: [list: LocalPlaylist] }>();
const grid = shallowRef(false);
</script>
<template>
  <scroll-view scroll-y class="content-scroll"
    ><button
      role="button"
      class="favorite-collection"
      @click="
        openCollection(
          {
            id: 'favorites',
            title: '我喜欢的音乐',
            cover: favorites[0]?.cover || '',
            kind: 'favorites'
          },
          favorites
        )
      "
    >
      <view class="favorite-art"><text class="ri-heart-3-fill" /></view
      ><view class="favorite-info"
        ><text class="favorite-title">我喜欢的音乐</text
        ><text class="favorite-description">{{ favorites.length }} 首歌曲</text></view
      ><text class="favorite-arrow ri-arrow-right-s-line" /></button
    ><button role="button" class="import-playlist-entry" @click="secondaryPage = 'import'">
      <text class="ri-file-list-3-line" /><view
        ><text>文字导入歌单</text><text>粘贴列表，识别后勾选添加</text></view
      ><text class="ri-arrow-right-s-line" /></button
    ><view class="playlist-toolbar"
      ><view class="playlist-section-title"
        ><text>自建歌单</text><text class="playlist-count">{{ playlists.length }}</text></view
      ><button
        role="button"
        class="button-icon muted"
        :aria-label="grid ? '切换列表视图' : '切换封面视图'"
        @click="grid = !grid"
      >
        <text :class="grid ? 'ri-list-check' : 'ri-layout-grid-line'" /></button
      ><button role="button" class="button-icon" aria-label="新建歌单" @click="emit('create')">
        <text class="ri-add-line" /></button></view
    ><view v-if="!playlists.length" class="playlist-empty"
      ><button role="button" class="empty-create" @click="emit('create')">
        <view class="new-list-art"><text class="ri-add-line" /></view
        ><view
          ><text class="empty-title">创建你的第一张歌单</text
          ><text class="empty-description">把喜欢的歌，放在一起。</text></view
        ><text class="ri-arrow-right-s-line" /></button></view
    ><view :class="grid ? 'playlist-grid' : 'playlist-list'"
      ><view v-for="list in playlists" :key="list.id" class="local-playlist"
        ><button
          role="button"
          class="local-playlist-main"
          @click="
            openCollection(
              { id: list.id, title: list.title, cover: list.tracks[0]?.cover || '', kind: 'local' },
              list.tracks
            )
          "
        >
          <view class="list-cover"
            ><cover-art :src="list.tracks[0]?.cover" radius="12px" /><view
              v-if="grid"
              class="list-play"
              ><text class="ri-play-fill" /></view></view
          ><view class="list-info"
            ><text class="list-name ellipsis">{{ list.title }}</text
            ><text class="list-count">{{ list.tracks.length }} 首歌曲</text></view
          ></button
        ><button
          role="button"
          class="button-icon list-menu"
          :aria-label="`${list.title}的歌单操作`"
          @click="emit('manage', list)"
        >
          <text class="ri-more-2-fill" /></button></view></view
    ><view class="content-bottom"
  /></scroll-view>
</template>
<style scoped>
.import-playlist-entry {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 14px 20px !important;
  margin: 0 20px 20px !important;
  border-radius: 16px !important;
  background: var(--qqm-surface) !important;
  text-align: left;
}
.import-playlist-entry > text:first-child {
  font-size: 24px;
  color: var(--qqm-accent-text);
}
.import-playlist-entry > view {
  flex: 1;
  font-size: 14px;
}
.import-playlist-entry > view > text:last-child {
  display: block;
  font-size: 11px;
  color: var(--qqm-muted);
  margin-top: 6px;
}
.favorite-collection {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px !important;
  margin: 13px 20px 29px !important;
  background: var(--qqm-surface) !important;
  border-radius: 16px !important;
  text-align: left;
}
.favorite-art {
  height: 65px;
  width: 65px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f4d5d9, #fbecef);
  color: #de6c7b;
  border-radius: 13px;
  font-size: 31px;
}
.favorite-info {
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex: 1;
  min-width: 0;
}
.favorite-title {
  font-size: calc(17px + var(--font-size-adjustment));
  font-weight: 550;
}
.favorite-description {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.favorite-arrow {
  font-size: 22px;
  color: var(--qqm-muted);
}
.playlist-toolbar {
  display: flex;
  align-items: center;
  margin: 0 14px 13px 20px;
}
.playlist-section-title {
  display: flex;
  align-items: baseline;
  gap: 7px;
  flex: 1;
  font-size: calc(21px + var(--font-size-adjustment));
  font-weight: 600;
}
.playlist-count {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  font-weight: 400;
}
.playlist-toolbar .button-icon {
  font-size: 22px !important;
  width: 38px !important;
}
.empty-create {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  width: 100%;
  padding: 10px 20px !important;
}
.new-list-art {
  height: 66px;
  width: 66px;
  border: 1px dashed var(--qqm-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 29px;
  color: var(--qqm-accent-text);
}
.empty-title {
  display: block;
  font-size: calc(15px + var(--font-size-adjustment));
}
.empty-description {
  display: block;
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-top: 8px;
}
.empty-create > .ri-arrow-right-s-line {
  margin-left: auto;
  color: var(--qqm-muted);
}
.local-playlist {
  display: flex;
  align-items: center;
  padding: 10px 13px 10px 20px;
}
.local-playlist-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 15px;
  text-align: left;
}
.list-cover {
  width: 67px;
  height: 67px;
  flex-shrink: 0;
  position: relative;
}
.list-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-name {
  font-size: calc(16px + var(--font-size-adjustment));
  font-weight: 500;
}
.list-count {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.list-menu {
  font-size: 20px !important;
  color: var(--qqm-muted);
}
.playlist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 0 20px;
  gap: 24px 16px;
}
.playlist-grid .local-playlist {
  display: block;
  padding: 0;
  position: relative;
  min-width: 0;
}
.playlist-grid .local-playlist-main {
  display: block;
}
.playlist-grid .list-cover {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  margin-bottom: 11px;
}
.playlist-grid .list-info {
  padding-right: 25px;
  gap: 6px;
}
.playlist-grid .list-menu {
  position: absolute;
  bottom: -2px;
  right: -12px;
}
.list-play {
  position: absolute;
  right: 9px;
  bottom: 9px;
  color: #fff;
  font-size: 23px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
}
</style>
