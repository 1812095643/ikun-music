<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import type { Track } from '@/services/musicApi';
import { selectedCollection } from '@/stores/browse';
import {
  addToPlaylist,
  createPlaylist,
  favoriteIds,
  playlists,
  removeFromPlaylist,
  toast,
  toggleFavorite
} from '@/stores/library';
import { playNext } from '@/stores/player';

import CoverArt from './CoverArt.vue';
import SheetFrame from './SheetFrame.vue';
const props = defineProps<{ track: Track }>();
const emit = defineEmits<{ close: []; download: [track: Track] }>();
const choosing = shallowRef(false);
const newName = shallowRef('');
const liked = computed(() => favoriteIds.value.has(props.track.id));
const localCollection = computed(() =>
  selectedCollection.value?.kind === 'local' ? selectedCollection.value.id : null
);
function add(id: string) {
  addToPlaylist(id, props.track);
  emit('close');
}
function createAndAdd() {
  const list = createPlaylist(newName.value);
  if (list) add(list.id);
}
function remove() {
  if (localCollection.value) removeFromPlaylist(localCollection.value, props.track.id);
  toast('已从歌单中移除');
  emit('close');
}
</script>
<template>
  <sheet-frame :title="choosing ? '添加到歌单' : '歌曲'" @close="emit('close')"
    ><template v-if="!choosing"
      ><view class="action-song"
        ><view class="action-cover"><cover-art :src="track.cover" radius="12px" /></view
        ><view class="action-info"
          ><text class="action-title line-clamp">{{ track.title }}</text
          ><text class="action-artist ellipsis">{{ track.artist }}</text></view
        ></view
      ><view class="quick-actions"
        ><button
          role="button"
          @click="
            toggleFavorite(track);
            emit('close');
          "
        >
          <view :class="{ liked }"
            ><text :class="liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'" /></view
          ><text>{{ liked ? '取消喜欢' : '喜欢' }}</text></button
        ><button
          role="button"
          @click="
            playNext(track);
            emit('close');
          "
        >
          <view><text class="ri-play-list-add-line" /></view><text>下一首播放</text></button
        ><button role="button" @click="emit('download', track)">
          <view><text class="ri-download-line" /></view><text>下载</text>
        </button></view
      ><view class="sheet-divider" /><button
        role="button"
        class="sheet-row"
        @click="choosing = true"
      >
        <text class="sheet-row-icon ri-folder-music-line" /><text>添加到歌单</text
        ><text class="sheet-row-end ri-arrow-right-s-line" /></button
      ><view v-if="track.album" class="album-information"
        ><text class="ri-album-line" /><view
          ><text class="album-information-label">专辑</text
          ><text class="album-name line-clamp">{{ track.album }}</text></view
        ></view
      ><button
        v-if="localCollection"
        role="button"
        class="sheet-row"
        style="color: #d3666f"
        @click="remove"
      >
        <text class="sheet-row-icon ri-subtract-line" /><text>从此歌单移除</text>
      </button></template
    ><template v-else
      ><view class="new-playlist"
        ><text class="new-playlist-label">新建歌单</text
        ><view class="new-playlist-form"
          ><input
            v-model="newName"
            class="field-input"
            maxlength="40"
            placeholder="输入歌单名称"
            confirm-type="done"
            @confirm="createAndAdd"
          /><button
            role="button"
            class="text-button"
            :disabled="!newName.trim()"
            @click="createAndAdd"
          >
            创建并加入
          </button></view
        ></view
      ><view class="sheet-divider" /><button
        v-for="list in playlists"
        :key="list.id"
        role="button"
        class="sheet-row choose-list"
        @click="add(list.id)"
      >
        <view class="choose-list-cover"
          ><cover-art :src="list.tracks[0]?.cover" radius="8px" /></view
        ><view class="choose-list-info"
          ><text class="ellipsis">{{ list.title }}</text
          ><text class="sheet-row-description">{{ list.tracks.length }} 首歌曲</text></view
        ><text class="sheet-row-end ri-add-line" /></button
      ><view v-if="!playlists.length" class="state-box"
        >创建一张歌单，这首歌就会成为第一首。</view
      ></template
    ></sheet-frame
  >
</template>
<style scoped>
.action-song {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 22px 21px;
}
.action-cover {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
}
.action-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.action-title {
  font-size: calc(18px + var(--font-size-adjustment));
  font-weight: 550;
  line-height: 1.45;
}
.action-artist {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.quick-actions {
  display: flex;
  padding: 0 16px 17px;
}
.quick-actions button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  font-size: calc(13px + var(--font-size-adjustment)) !important;
}
.quick-actions button > view {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--qqm-surface-muted);
  font-size: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.quick-actions .liked {
  color: #ed737e;
}
.album-information {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 14px 22px 19px;
  color: var(--qqm-muted);
}
.album-information > .ri-album-line {
  font-size: 23px;
  width: 26px;
}
.album-information > view {
  min-width: 0;
  flex: 1;
}
.album-information-label {
  font-size: calc(11px + var(--font-size-adjustment));
  display: block;
  margin-bottom: 5px;
}
.album-name {
  font-size: calc(14px + var(--font-size-adjustment));
  color: var(--qqm-text);
}
.new-playlist {
  padding: 4px 22px 10px;
}
.new-playlist-label {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.new-playlist-form {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.new-playlist-form .field-input {
  min-width: 0;
  flex: 1;
  height: 44px;
  font-size: calc(14px + var(--font-size-adjustment));
}
.new-playlist-form .text-button {
  font-size: calc(12px + var(--font-size-adjustment)) !important;
  padding: 9px 0 !important;
}
.choose-list-cover {
  width: 43px;
  height: 43px;
  flex-shrink: 0;
}
.choose-list-info {
  min-width: 0;
  flex: 1;
}
.choose-list-info > .ellipsis {
  display: block;
  font-size: calc(15px + var(--font-size-adjustment));
}
</style>
