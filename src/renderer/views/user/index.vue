<script setup lang="ts">
import { shallowRef } from 'vue';

import Favorite from '@/views/favorite/index.vue';
import HistoryList from '@/views/history/index.vue';

import UserPlaylists from './UserPlaylists.vue';

defineOptions({ name: 'User' });
const section = shallowRef<'favorites' | 'playlists' | 'history'>('favorites');
const sections = [
  { key: 'favorites' as const, label: '我的收藏', icon: 'ri-heart-line' },
  { key: 'playlists' as const, label: '我的歌单', icon: 'ri-play-list-line' },
  { key: 'history' as const, label: '最近播放', icon: 'ri-history-line' }
];
</script>

<template>
  <section class="user-library">
    <header class="library-heading">
      <div>
        <h1>我的音乐</h1>
        <p>喜欢的歌，常听的旋律，都在这里。</p>
      </div>
      <i class="ri-user-heart-line library-mark" aria-hidden="true" />
    </header>
    <nav class="library-tabs" aria-label="个人音乐分类">
      <button
        v-for="item in sections"
        :key="item.key"
        :class="{ active: section === item.key }"
        :aria-pressed="section === item.key"
        @click="section = item.key"
      >
        <i :class="item.icon" aria-hidden="true" />{{ item.label }}
      </button>
    </nav>
    <div class="library-content">
      <favorite v-if="section === 'favorites'" />
      <user-playlists v-else-if="section === 'playlists'" />
      <history-list v-else />
    </div>
  </section>
</template>

<style scoped>
.user-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px clamp(18px, 2.2vw, 32px) 16px;
  color: var(--qqm-text);
}
.library-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}
.library-heading h1 {
  font-size: 26px;
  font-weight: 650;
  margin: 0 0 7px;
}
.library-heading p {
  color: var(--qqm-muted);
  font-size: 13px;
  margin: 0;
}
.library-mark {
  font-size: 36px;
  color: var(--qqm-primary);
  opacity: 0.65;
}
.library-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.library-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  font-size: 13px;
  border-radius: 8px;
  color: var(--qqm-muted);
  transition:
    background 0.15s,
    color 0.15s;
}
.library-tabs button.active {
  color: var(--qqm-text);
  background: color-mix(in srgb, var(--qqm-primary) 14%, transparent);
}
.library-tabs button:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 3px;
}
.library-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--qqm-border);
  border-radius: 12px;
  background: var(--qqm-surface);
}
</style>
