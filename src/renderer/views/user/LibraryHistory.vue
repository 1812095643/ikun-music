<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import type { SongResult } from '@/types/music';
import { mapDjProgramToSongResult } from '@/utils/podcastUtils';

import LibraryCollections from './LibraryCollections.vue';
import LibraryTracks from './LibraryTracks.vue';

const history = usePlayHistoryStore();
const route = useRoute();
const router = useRouter();
const categories = [
  { key: 'songs', label: '歌曲' },
  { key: 'playlists', label: '歌单' },
  { key: 'albums', label: '专辑' },
  { key: 'episodes', label: '播客节目' },
  { key: 'radios', label: '播客电台' }
];
const category = computed(() =>
  categories.some((item) => item.key === route.query.category)
    ? String(route.query.category)
    : 'songs'
);
const podcasts = computed(() => history.podcastHistory.map(mapDjProgramToSongResult));
const collections = computed(() => {
  if (category.value === 'playlists')
    return history.playlistHistory.map((item) => ({
      id: item.id,
      name: item.name,
      cover: item.coverImgUrl || item.picUrl,
      description: item.creator?.nickname || (item.trackCount ? `${item.trackCount} 首歌曲` : '')
    }));
  if (category.value === 'albums')
    return history.albumHistory.map((item) => ({
      id: item.id,
      name: item.name,
      cover: item.picUrl,
      description: item.artist?.name || ''
    }));
  return history.podcastRadioHistory.map((item) => ({
    id: item.id,
    name: item.name,
    cover: item.picUrl,
    description: item.dj?.nickname || item.desc || ''
  }));
});
function open(id: string | number) {
  if (category.value === 'radios') {
    void router.push({ name: 'podcastRadio', params: { id } });
    return;
  }
  const item =
    category.value === 'albums'
      ? history.albumHistory.find((entry) => entry.id === id)
      : history.playlistHistory.find((entry) => entry.id === id);
  if (item)
    navigateToMusicList(router, {
      id,
      type: category.value === 'albums' ? 'album' : 'playlist',
      name: item.name,
      listInfo: item
    });
}
function remove(id: string | number) {
  if (category.value === 'playlists') {
    const item = history.playlistHistory.find((entry) => entry.id === id);
    if (item) history.delPlaylist(item);
  } else if (category.value === 'albums') {
    const item = history.albumHistory.find((entry) => entry.id === id);
    if (item) history.delAlbum(item);
  } else {
    const item = history.podcastRadioHistory.find((entry) => entry.id === id);
    if (item) history.delPodcastRadio(item);
  }
}
function removePodcast(song: SongResult) {
  const item = history.podcastHistory.find(
    (entry) => String(mapDjProgramToSongResult(entry).id) === String(song.id)
  );
  if (item) history.delPodcast(item);
}
</script>

<template>
  <section class="library-history">
    <nav class="history-categories" aria-label="最近播放分类">
      <button
        v-for="item in categories"
        :key="item.key"
        :class="{ active: category === item.key }"
        :aria-pressed="category === item.key"
        @click="router.replace({ path: '/user', query: { tab: 'history', category: item.key } })"
      >
        {{ item.label }}
      </button>
    </nav>
    <library-tracks
      v-if="category === 'songs'"
      :songs="history.musicHistory"
      kind="history"
      @remove="history.delMusic"
    />
    <library-tracks
      v-else-if="category === 'episodes'"
      :songs="podcasts"
      kind="podcasts"
      @remove="removePodcast"
    />
    <library-collections
      v-else
      :key="category"
      :items="collections"
      removable
      @open="open"
      @remove="remove"
    />
  </section>
</template>
<style scoped>
.library-history {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.history-categories {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-top: 18px;
  flex-wrap: wrap;
}
.history-categories > button {
  padding: 5px 12px;
  border-radius: 6px;
  color: var(--qqm-muted);
  font-size: 12px;
}
.history-categories > button.active {
  color: var(--qqm-primary-strong);
  background: var(--qqm-primary-soft);
}
.history-categories > button:hover {
  color: var(--qqm-primary-strong);
}
</style>
