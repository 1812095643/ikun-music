<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlaylistItem from '@/components/common/PlaylistItem.vue';
import { type PlaylistHistoryItem, usePlayHistoryStore } from '@/store/modules/playHistory';
import { useUserStore } from '@/store/modules/user';

const router = useRouter();
const userStore = useUserStore();
const historyStore = usePlayHistoryStore();
const savedPlaylists = computed<PlaylistHistoryItem[]>(() => userStore.playList);
const recentPlaylists = computed(() => historyStore.playlistHistory);
function openPlaylist(item: PlaylistHistoryItem) {
  navigateToMusicList(router, { id: item.id, type: 'playlist', name: item.name, listInfo: item });
}
</script>

<template>
  <n-scrollbar class="h-full">
    <div class="personal-playlists">
      <section v-if="savedPlaylists.length">
        <h2>已保存的歌单</h2>
        <playlist-item
          v-for="item in savedPlaylists"
          :key="item.id"
          :item="item"
          @click="openPlaylist"
        />
      </section>
      <section>
        <h2>最近听过的歌单</h2>
        <playlist-item
          v-for="item in recentPlaylists"
          :key="item.id"
          :item="item"
          @click="openPlaylist"
        />
        <div v-if="!recentPlaylists.length" class="playlist-empty">
          <i class="ri-play-list-line" aria-hidden="true" />
          <p>还没有听过的歌单</p>
          <span>打开喜欢的歌单并播放，这里会自动记录。</span>
          <button @click="router.push('/list')">去发现歌单</button>
        </div>
      </section>
    </div>
  </n-scrollbar>
</template>

<style scoped>
.personal-playlists {
  padding: 24px;
}
.personal-playlists section + section {
  margin-top: 24px;
}
h2 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}
.playlist-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 44px 16px;
  gap: 10px;
  text-align: center;
  color: var(--qqm-muted);
  font-size: 13px;
}
.playlist-empty > i {
  font-size: 36px;
  margin-bottom: 4px;
}
.playlist-empty p {
  font-size: 15px;
  color: var(--qqm-text);
  margin: 0;
}
.playlist-empty button {
  margin-top: 12px;
  padding: 8px 18px;
  border-radius: 8px;
  color: var(--qqm-text);
  background: color-mix(in srgb, var(--qqm-primary) 14%, transparent);
}
</style>
