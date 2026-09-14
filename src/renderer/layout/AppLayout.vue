<template>
  <!-- 移动端使用专用布局（平板模式下使用 PC 布局） -->
  <mobile-layout v-if="isPhone && !settingsStore.setData?.tabletMode" :is-phone="isPhone" />

  <!-- PC 端 / 浏览器移动端 / 平板模式 保持原有布局 -->
  <div v-else class="layout-page" :class="{ mobile: settingsStore.isMobile }">
    <div id="layout-main" class="layout-main">
      <title-bar />
      <div class="layout-main-page">
        <div class="main">
          <!-- 搜索栏 -->
          <search-bar class="search-bar" />
          <!-- 主页面路由 -->
          <div
            class="main-content"
            :native-scrollbar="false"
            :class="{ 'mobile-content': !shouldShowMobileMenu }"
          >
            <router-view
              v-slot="{ Component }"
              class="main-page"
              :class="route.meta.noScroll && !settingsStore.isMobile ? 'pr-3' : ''"
            >
              <Transition name="fade-slide" mode="out-in">
                <keep-alive :include="keepAliveInclude" :max="8">
                  <component :is="Component" />
                </keep-alive>
              </Transition>
            </router-view>
          </div>
          <!-- 移动端底部菜单（浏览器模拟移动端时使用） -->
          <app-menu v-if="shouldShowMobileMenu" class="menu mobile-menu" :menus="menuStore.menus" />
        </div>
      </div>
      <!-- 底部音乐播放 -->
      <template v-if="!settingsStore.isMiniMode">
        <play-bar
          v-if="!settingsStore.isMobile"
          :style="playerStore.musicFull ? 'bottom: 0;' : ''"
        />
        <mobile-play-bar
          v-else-if="settingsStore.isMobile && isPlay"
          v-show="isPlay"
          :style="settingsStore.isMobile && playerStore.musicFull ? 'bottom: 0;' : ''"
        />
      </template>
    </div>
    <update-modal v-if="isDesktopRuntime" />
    <app-update-notice v-if="isDesktopRuntime" />
    <playlist-drawer v-model="showPlaylistDrawer" :song-id="currentSongId" />
    <sleep-timer-top v-if="!settingsStore.isMobile" />
    <!-- 播放列表抽屉 -->
    <playing-list-drawer />
  </div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, provide, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import AppUpdateNotice from '@/components/common/AppUpdateNotice.vue';
import UpdateModal from '@/components/common/UpdateModal.vue';
import SleepTimerTop from '@/components/player/SleepTimerTop.vue';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { isDesktopRuntime } from '@/utils';
import { consumeMiniModePlaylistDrawerSongId } from '@/utils/miniModeNavigation';

// 关键布局组件同步导入（始终可见，避免加载闪烁）
import AppMenu from './components/AppMenu.vue';
import SearchBar from './components/SearchBar.vue';
import TitleBar from './components/TitleBar.vue';
// 移动端专用布局
const MobileLayout = defineAsyncComponent(() => import('./MobileLayout.vue'));

const keepAliveInclude = computed(() => {
  const allRoutes = [...homeRouter, ...otherRouter];

  return allRoutes
    .filter((item) => {
      return item.meta?.keepAlive;
    })
    .map((item) => {
      return typeof item.name === 'string'
        ? item.name.charAt(0).toUpperCase() + item.name.slice(1)
        : '';
    })
    .filter(Boolean);
});

// 非关键组件保持异步加载
const PlayBar = defineAsyncComponent(() => import('@/components/player/PlayBar.vue'));
const MobilePlayBar = defineAsyncComponent(() => import('@/components/player/MobilePlayBar.vue'));
const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);
const PlaylistDrawer = defineAsyncComponent(() => import('@/components/common/PlaylistDrawer.vue'));

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const menuStore = useMenuStore();

const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);
const route = useRoute();

// 判断当前路由是否应该在移动端显示AppMenu
const shouldShowMobileMenu = computed(() => {
  // 过滤出在menus中定义的路径
  const menuPaths = menuStore.menus.map((item: any) => item.path);
  // 检查当前路由路径是否在menus中
  return menuPaths.includes(route.path) && settingsStore.isMobile && !playerStore.musicFull;
});

provide('shouldShowMobileMenu', shouldShowMobileMenu);

// 使用 settingsStore.isMobile 进行移动端检测而不是 Capacitor 设备检测
const isPhone = computed(() => settingsStore.isMobile);

onMounted(() => {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
});

const showPlaylistDrawer = ref(false);
const currentSongId = ref<number | string | undefined>();

// 提供一个方法来打开歌单抽屉
const openPlaylistDrawer = (songId: number | string, isOpen: boolean = true) => {
  currentSongId.value = songId;
  showPlaylistDrawer.value = isOpen;
  playerStore.setMusicFull(false);
  playerStore.setPlayListDrawerVisible(!isOpen);
};

// 将方法提供给全局
provide('openPlaylistDrawer', openPlaylistDrawer);

// 迷你窗里的“加入歌单”动作依赖主布局抽屉，所以恢复主窗口后再消费待办 songId。
watch(
  () => [settingsStore.isMiniMode, route.fullPath],
  () => {
    if (settingsStore.isMiniMode) return;
    const pendingSongId = consumeMiniModePlaylistDrawerSongId();
    if (pendingSongId == null) return;
    openPlaylistDrawer(pendingSongId);
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.layout-page {
  @apply w-screen h-screen overflow-hidden;
  --layout-shell-bg: color-mix(in srgb, var(--qqm-bg, #f7f8fa) 92%, var(--qqm-surface, #ffffff));
  background: var(--layout-shell-bg);
}

:global(.dark) .layout-page {
  --layout-shell-bg: color-mix(in srgb, var(--qqm-bg, #050505) 88%, var(--qqm-surface, #101112));
}

.layout-main {
  @apply w-full h-full relative text-neutral-900 dark:text-neutral-100;
  background: var(--layout-shell-bg);
}

.layout-main-page {
  @apply flex;
  height: calc(100% - 40px);
  background: var(--layout-shell-bg);
}

// 根因：播放栏以前依赖选中歌曲才挂载，首次启动/清空歌曲后整个控制区消失；
// 原占位还依赖播放 URL，解析中与暂停时高度不一致。桌面始终保留播放器和底边间距，
// 内容区直接扣除其高度，使列表最后一行不会被绝对定位的播放栏遮挡。
.layout-page:not(.mobile) .layout-main-page {
  height: calc(100% - 40px - 104px);
}

.menu {
  @apply h-full;
  background: var(--layout-shell-bg);
}

.main {
  @apply min-w-0 flex-1 flex flex-col;
  overflow: hidden;
  background: var(--layout-shell-bg);
}

.main-content {
  @apply flex-1 overflow-hidden;
  position: relative;
  z-index: 1;
  background: var(--qqm-bg, #f7f8fa);
  overflow: hidden;
}

:global(.dark) .main-content {
  background: var(--qqm-bg, #050505);
}

.main-page {
  @apply h-full;
}

.mobile {
  .main-content {
    height: calc(100vh - 130px);
    overflow: auto;
    display: block;
    flex: none;
    position: relative;
  }

  .mobile-content {
    height: calc(100vh - 75px);
    position: relative;
  }
}
</style>
