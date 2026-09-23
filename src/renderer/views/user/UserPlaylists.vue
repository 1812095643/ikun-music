<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { useLocalPlaylistsStore } from '@/store/modules/localPlaylists';
import { useUserStore } from '@/store/modules/user';

import LibraryCollections from './LibraryCollections.vue';

const router = useRouter();
const user = useUserStore();
const local = useLocalPlaylistsStore();
const items = computed(() =>
  [
    ...local.playlists.map((list) => ({
      id: list.id,
      name: list.name,
      coverImgUrl: list.songs[0]?.picUrl,
      trackCount: list.songs.length,
      creator: { nickname: '本机歌单' }
    })),
    ...user.playList
  ].map((item) => ({
    id: item.id,
    name: item.name,
    cover: item.coverImgUrl || item.picUrl,
    description: [
      typeof item.trackCount === 'number' ? `${item.trackCount} 首歌曲` : '',
      item.creator?.nickname
    ]
      .filter(Boolean)
      .join(' · ')
  }))
);
function open(id: string | number) {
  const saved = local.playlists.find((item) => item.id === id);
  if (saved) {
    navigateToMusicList(router, {
      id,
      type: 'local',
      name: saved.name,
      songList: saved.songs,
      listInfo: { id, name: saved.name, coverImgUrl: saved.songs[0]?.picUrl }
    });
    return;
  }
  const item = user.playList.find((value) => value.id === id);
  if (item) navigateToMusicList(router, { id, type: 'playlist', name: item.name, listInfo: item });
}
</script>
<template>
  <button class="music-list-button playlist-import" @click="router.push('/playlist/import')">
    <i class="ri-import-line" aria-hidden="true" />导入歌单
  </button>
  <library-collections
    :items="items"
    empty-title="让歌单装下你的每一种心情"
    empty-description="已保存的歌单会留在这里。听过的歌单，可以在「最近播放」中找回。"
    @open="open"
  >
    <template #empty-action
      ><button
        class="playlist-discover"
        @click="router.push({ path: '/user', query: { tab: 'history', category: 'playlists' } })"
      >
        查看听过的歌单 <i class="ri-arrow-right-line" /></button
    ></template>
  </library-collections>
</template>
<style scoped>
.playlist-import {
  align-self: flex-start;
  margin-top: 18px;
}
.playlist-discover {
  margin-top: 10px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--qqm-primary-strong);
}
</style>
