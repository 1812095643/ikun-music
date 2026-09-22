<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useFavoriteStore } from '@/store/modules/favorite';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { useUserStore } from '@/store/modules/user';
import { isDesktopRuntime } from '@/utils';

import LibraryHistory from './LibraryHistory.vue';
import LibraryTracks from './LibraryTracks.vue';
import { useLibrarySongs } from './useLibrarySongs';
import UserPlaylists from './UserPlaylists.vue';

defineOptions({ name: 'User' });
const route = useRoute();
const router = useRouter();
const favorite = useFavoriteStore();
const history = usePlayHistoryStore();
const user = useUserStore();
const { favorites, loading, missingCount, refresh } = useLibrarySongs();
const sections = computed(() => [
  { key: 'favorites', label: '我喜欢', count: favorite.favoriteList.length },
  { key: 'playlists', label: '我的歌单', count: user.playList.length },
  { key: 'history', label: '最近播放', count: history.musicHistory.length }
]);
const section = computed(() =>
  sections.value.some((item) => item.key === route.query.tab)
    ? String(route.query.tab)
    : 'favorites'
);
function changeSection(key: string) {
  void router.replace({ path: '/user', query: { tab: key } });
}
function onTabKey(event: KeyboardEvent, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? sections.value.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + sections.value.length) %
          sections.value.length;
  changeSection(sections.value[next].key);
  const tabs = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]');
  tabs?.[next]?.focus();
}
</script>

<template>
  <section class="user-library">
    <header class="library-heading">
      <div class="library-art" aria-hidden="true">
        <span class="library-record" /><i class="ri-heart-fill" /><span class="library-art-caption"
          >MY MUSIC</span
        >
      </div>
      <div class="library-heading-copy">
        <p class="library-eyebrow">只属于你的音乐时光</p>
        <h1>我的音乐</h1>
        <p class="library-description">把喜欢留下，让好音乐常伴左右。</p>
      </div>
      <div class="library-shortcuts">
        <button v-if="isDesktopRuntime" @click="router.push('/downloads')">
          <i class="ri-download-2-line" />下载管理</button
        ><button @click="router.push('/heatmap')"><i class="ri-bar-chart-2-line" />听歌足迹</button>
      </div>
    </header>
    <nav class="library-tabs" role="tablist" aria-label="我的音乐分类">
      <button
        v-for="(item, index) in sections"
        :id="`library-tab-${item.key}`"
        :key="item.key"
        role="tab"
        :aria-selected="section === item.key"
        aria-controls="library-content"
        :tabindex="section === item.key ? 0 : -1"
        :class="{ active: section === item.key }"
        @click="changeSection(item.key)"
        @keydown="onTabKey($event, index)"
      >
        {{ item.label }}<span>{{ item.count }}</span>
      </button>
    </nav>
    <div
      id="library-content"
      class="library-content"
      role="tabpanel"
      :aria-labelledby="`library-tab-${section}`"
    >
      <library-tracks
        v-if="section === 'favorites'"
        :songs="favorites"
        kind="favorites"
        :loading="loading"
        :missing-count="missingCount"
        @retry="refresh"
      />
      <user-playlists v-else-if="section === 'playlists'" />
      <library-history v-else />
    </div>
  </section>
</template>

<style scoped>
.user-library {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 30px clamp(24px, 4vw, 60px) 12px;
  color: var(--qqm-text);
}
.library-heading {
  display: flex;
  align-items: center;
  gap: 26px;
  padding-bottom: 32px;
}
.library-art {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  border-radius: 16px;
  color: #f0fff5;
  background: #218764;
}
.library-record {
  position: absolute;
  width: 148px;
  height: 148px;
  left: 32px;
  top: -21px;
  border: 1px solid rgba(229, 255, 244, 0.22);
  border-radius: 50%;
  box-shadow:
    0 0 0 12px rgba(229, 255, 244, 0.04),
    0 0 0 25px rgba(229, 255, 244, 0.035),
    inset 0 0 0 13px rgba(229, 255, 244, 0.035);
}
.library-art > i {
  position: relative;
  font-size: 44px;
  padding-bottom: 9px;
}
.library-art-caption {
  position: absolute;
  left: 14px;
  bottom: 11px;
  font-size: 8px;
  letter-spacing: 2px;
  opacity: 0.72;
}
.library-heading-copy {
  min-width: 0;
}
.library-eyebrow {
  margin: 0 0 7px;
  color: var(--qqm-muted);
  font-size: 11px;
  letter-spacing: 1px;
}
.library-heading h1 {
  font-size: 30px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -0.5px;
  margin: 0;
}
.library-description {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--qqm-muted);
}
.library-shortcuts {
  margin-left: auto;
  display: flex;
  gap: 18px;
  align-self: flex-end;
  padding-bottom: 6px;
}
.library-shortcuts button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--qqm-muted);
  font-size: 12px;
  white-space: nowrap;
}
.library-shortcuts button:hover {
  color: var(--qqm-primary-strong);
}
.library-tabs {
  display: flex;
  gap: 32px;
  border-bottom: 1px solid var(--qqm-border);
}
.library-tabs button {
  position: relative;
  padding: 0 0 15px;
  display: flex;
  align-items: baseline;
  gap: 7px;
  color: var(--qqm-muted);
  font-size: 17px;
  white-space: nowrap;
}
.library-tabs button > span {
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.library-tabs button.active {
  color: var(--qqm-text);
  font-weight: 600;
}
.library-tabs button.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 27px;
  height: 3px;
  border-radius: 3px;
  background: var(--qqm-primary);
}
.library-tabs button:hover {
  color: var(--qqm-primary-strong);
}
.library-content {
  display: flex;
  flex: 1;
  min-height: 0;
}
.user-library :deep(button:focus-visible) {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 3px;
}
.user-library :deep(.library-columns) {
  display: grid;
  grid-template-columns:
    32px minmax(160px, 2.6fr) minmax(95px, 1.1fr) minmax(95px, 1.2fr)
    50px 128px;
  gap: 16px;
  align-items: center;
}
@media (max-width: 1000px) {
  .user-library :deep(.library-columns) {
    grid-template-columns: 28px minmax(150px, 2fr) minmax(85px, 1fr) 45px 128px;
    gap: 12px;
  }
}
@media (max-width: 720px) {
  .user-library {
    padding: 20px 18px 8px;
  }
  .library-heading {
    gap: 17px;
    padding-bottom: 25px;
  }
  .library-art {
    width: 80px;
    height: 80px;
    border-radius: 12px;
  }
  .library-art > i {
    font-size: 32px;
  }
  .library-art-caption {
    font-size: 6px;
    left: 10px;
    bottom: 8px;
  }
  .library-heading h1 {
    font-size: 25px;
  }
  .library-shortcuts {
    display: none;
  }
  .library-eyebrow {
    font-size: 10px;
  }
  .library-description {
    font-size: 11px;
    margin-top: 8px;
  }
  .library-tabs {
    gap: 25px;
  }
  .library-tabs button {
    font-size: 15px;
  }
  .user-library :deep(.library-columns) {
    grid-template-columns: 24px minmax(130px, 1fr) 40px 28px;
    gap: 8px;
  }
}
</style>
