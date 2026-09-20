<script setup lang="ts">
import { onBackPress, onHide, onShow } from '@dcloudio/uni-app';
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';

import AppHeader from '@/components/AppHeader.vue';
import AppUpdateSheet from '@/components/AppUpdateSheet.vue';
import BottomNavigation from '@/components/BottomNavigation.vue';
import MiniPlayer from '@/components/MiniPlayer.vue';
import NavigationRail from '@/components/NavigationRail.vue';
import PlayerSheet from '@/components/PlayerSheet.vue';
import PlaylistActions from '@/components/PlaylistActions.vue';
import PlaylistEditor from '@/components/PlaylistEditor.vue';
import QualitySheet from '@/components/QualitySheet.vue';
import QueueSheet from '@/components/QueueSheet.vue';
import SpectrumBars from '@/components/SpectrumBars.vue';
import StartupSplash from '@/components/StartupSplash.vue';
import TrackActions from '@/components/TrackActions.vue';
import { updateVisible } from '@/services/appUpdate';
import type { Track } from '@/services/musicApi';
import { setSpectrumEnabled } from '@/services/spectrum';
import {
  activeTab,
  closeCollection,
  enterSearch,
  homeLoading,
  refreshHome,
  secondaryPage,
  selectedCollection
} from '@/stores/browse';
import { deviceMode, initializeDevice, showSpectrum, wideLayout } from '@/stores/device';
import { homeCache, type LocalPlaylist, theme, toastMessage } from '@/stores/library';
import { closeTopSheet } from '@/stores/overlays';
import { current, playerOpen } from '@/stores/player';
import CollectionView from '@/views/CollectionView.vue';
import DiscoverView from '@/views/DiscoverView.vue';
import DownloadsView from '@/views/DownloadsView.vue';
import ImportView from '@/views/ImportView.vue';
import LibraryView from '@/views/LibraryView.vue';
import LocalMusicView from '@/views/LocalMusicView.vue';
import PlaylistsView from '@/views/PlaylistsView.vue';
import SearchView from '@/views/SearchView.vue';
import SettingsView from '@/views/SettingsView.vue';
import TransferView from '@/views/TransferView.vue';
const actionTrack = shallowRef<Track | null>(null);
const downloadTrack = shallowRef<Track | undefined>();
const queueOpen = shallowRef(false);
const qualityOpen = shallowRef(false);
const editorOpen = shallowRef(false);
const editorPlaylist = shallowRef<LocalPlaylist | undefined>();
const playlistMenu = shallowRef<LocalPlaylist | null>(null);
const splash = shallowRef(true);
const visitedTabs = shallowRef(new Set(['discover', activeTab.value]));
const detail = computed(() => Boolean(selectedCollection.value || secondaryPage.value));
const pageTitle = computed(() =>
  secondaryPage.value === 'transfer'
    ? '局域网互传'
    : secondaryPage.value === 'local'
      ? '本地音乐'
      : secondaryPage.value === 'import'
        ? '文字导入'
        : secondaryPage.value === 'settings'
          ? '设置'
          : secondaryPage.value === 'downloads'
            ? '本地下载'
            : selectedCollection.value?.kind === 'favorites'
              ? '我的收藏'
              : selectedCollection.value?.kind === 'history'
                ? '最近播放'
                : selectedCollection.value?.kind === 'rank'
                  ? '排行榜'
                  : selectedCollection.value
                    ? '歌单'
                    : activeTab.value === 'playlists'
                      ? '歌单'
                      : '我的音乐'
);
watch(activeTab, (tab) => {
  visitedTabs.value = new Set([...visitedTabs.value, tab]);
});
onMounted(() => {
  initializeDevice();
  void refreshHome();
  // #ifdef H5
  document.addEventListener('keydown', handleEscape);
  // #endif
});
function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && goBack()) {
    event.preventDefault();
    event.stopPropagation();
  }
}
onBeforeUnmount(() => {
  // #ifdef H5
  document.removeEventListener('keydown', handleEscape);
  // #endif
});
function openEditor(list?: LocalPlaylist) {
  playlistMenu.value = null;
  editorPlaylist.value = list;
  editorOpen.value = true;
}
function openDownload(track: Track) {
  actionTrack.value = null;
  downloadTrack.value = track;
  qualityOpen.value = true;
}
function openQuality() {
  downloadTrack.value = undefined;
  qualityOpen.value = true;
}
function openSettings() {
  closeCollection();
  secondaryPage.value = 'settings';
}
function goBack() {
  if (closeTopSheet()) return true;
  if (qualityOpen.value) {
    qualityOpen.value = false;
    return true;
  }
  if (editorOpen.value) {
    editorOpen.value = false;
    return true;
  }
  if (playlistMenu.value) {
    playlistMenu.value = null;
    return true;
  }
  if (actionTrack.value) {
    actionTrack.value = null;
    return true;
  }
  if (queueOpen.value) {
    queueOpen.value = false;
    return true;
  }
  if (playerOpen.value) {
    playerOpen.value = false;
    return true;
  }
  if (secondaryPage.value) {
    secondaryPage.value = null;
    return true;
  }
  if (selectedCollection.value) {
    closeCollection();
    return true;
  }
  if (activeTab.value !== 'discover') {
    activeTab.value = 'discover';
    return true;
  }
  return false;
}
onBackPress(goBack);
watch(showSpectrum, (value) => setSpectrumEnabled(value), { immediate: true });
onShow(() => setSpectrumEnabled(showSpectrum.value));
onHide(() => setSpectrumEnabled(false));
</script>
<template>
  <view
    class="mobile-app"
    :class="[
      `theme-${theme}`,
      `device-${deviceMode}`,
      {
        'layout-wide': wideLayout,
        'detail-page': detail,
        'collection-detail': Boolean(selectedCollection),
        'discovery-scene': activeTab === 'discover' && !detail,
        'rank-scene': selectedCollection?.kind === 'rank'
      }
    ]"
    ><view class="app-workspace"
      ><navigation-rail v-if="wideLayout" /><view class="main-column"
        ><app-header
          v-if="activeTab !== 'search' || detail"
          :title="pageTitle"
          :discovery="activeTab === 'discover' && !detail"
          :back="detail"
          :settings="activeTab === 'library' && !detail"
          @back="goBack"
          @search="enterSearch"
          @settings="openSettings" /><view class="app-content"
          ><view v-show="!detail" class="primary-pages"
            ><view v-show="activeTab === 'discover'" class="page-slot"
              ><discover-view @more="actionTrack = $event" /></view
            ><view
              v-if="visitedTabs.has('search')"
              v-show="activeTab === 'search'"
              class="page-slot"
              ><search-view @more="actionTrack = $event" /></view
            ><view
              v-if="visitedTabs.has('playlists')"
              v-show="activeTab === 'playlists'"
              class="page-slot"
              ><playlists-view @create="openEditor()" @manage="playlistMenu = $event" /></view
            ><view
              v-if="visitedTabs.has('library')"
              v-show="activeTab === 'library'"
              class="page-slot"
              ><library-view @create="openEditor()" @manage="playlistMenu = $event" /></view></view
          ><transfer-view v-if="secondaryPage === 'transfer'" /><local-music-view
            v-else-if="secondaryPage === 'local'"
            @more="actionTrack = $event" /><import-view
            v-else-if="secondaryPage === 'import'" /><settings-view
            v-else-if="secondaryPage === 'settings'"
            @quality="openQuality" /><downloads-view
            v-else-if="secondaryPage === 'downloads'"
            @more="actionTrack = $event" /><collection-view
            v-else-if="selectedCollection"
            @more="actionTrack = $event" /></view></view></view
    ><spectrum-bars v-if="showSpectrum && current && !playerOpen" /><mini-player
      @queue="queueOpen = true" /><bottom-navigation v-if="!detail && !wideLayout" /><player-sheet
      v-if="playerOpen"
      @more="actionTrack = $event"
      @queue="queueOpen = true"
      @download="openDownload"
      @quality="openQuality" /><track-actions
      v-if="actionTrack"
      :track="actionTrack"
      @close="actionTrack = null"
      @download="openDownload" /><queue-sheet
      v-if="queueOpen"
      @close="queueOpen = false" /><playlist-actions
      v-if="playlistMenu"
      :playlist="playlistMenu"
      @close="playlistMenu = null"
      @edit="openEditor" /><playlist-editor
      v-if="editorOpen"
      :playlist="editorPlaylist"
      @close="editorOpen = false" /><quality-sheet
      v-if="qualityOpen"
      :download-track="downloadTrack"
      @close="qualityOpen = false" /><view v-if="toastMessage" class="toast" role="status">{{
      toastMessage
    }}</view
    ><app-update-sheet v-if="updateVisible && !splash" /><startup-splash
      v-if="splash"
      :ready="homeCache.length > 0 || !homeLoading"
      @complete="splash = false"
  /></view>
</template>
<style scoped>
.mobile-app {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top);
}
.discovery-scene {
  background: linear-gradient(180deg, var(--page-wash), var(--qqm-bg) 255px);
}
.app-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
}
.main-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.app-content {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.primary-pages,
.page-slot {
  position: absolute;
  inset: 0;
}
.collection-detail :deep(.app-header) {
  background: var(--page-wash);
}
.rank-scene :deep(.app-header) {
  background: #91ad63;
  color: #fff;
}
.rank-scene {
  background: linear-gradient(180deg, #91ad63 260px, var(--qqm-bg) 260px);
}
.detail-page .app-content {
  background: var(--qqm-bg);
}
.detail-page :deep(.mini-player) {
  height: calc(var(--bar-height) + var(--safe-bottom));
  min-height: calc(var(--bar-height) + var(--safe-bottom));
  padding-bottom: calc(3px + var(--safe-bottom));
}
.detail-page :deep(.mini-timeline) {
  bottom: calc(4px + var(--safe-bottom));
}
</style>
