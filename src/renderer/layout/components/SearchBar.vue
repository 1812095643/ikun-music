<template>
  <div class="flex items-center gap-2 px-4 search-bar-shell">
    <!-- ── LEFT: Tabs（无界设计顶部常驻）─────────────── -->
    <transition name="tab-slide">
      <div v-if="!showBackButton" class="tabs-track flex-shrink-0" ref="tabsTrackRef">
        <div class="tab-slider-bg" :style="sliderStyle" />
        <button
          v-for="(tab, i) in tabs"
          :key="tab.key"
          :ref="(el) => setTabRef(el as HTMLElement, i)"
          class="tab-btn"
          :class="isTabActive(tab.path) ? 'tab-btn--on' : 'tab-btn--off'"
          @click="router.push(tab.path)"
        >
          <span class="tab-icon" v-html="getTabIcon(tab.path)" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- 返回按钮 + 页面标题（meta.back 页面）-->
      <div v-else-if="showBackButton" class="flex items-center gap-2 flex-shrink-0">
        <button class="back-btn" @click="goBack">
          <i class="ri-arrow-left-line" />
        </button>
        <transition name="nav-title">
          <span v-if="navTitleStore.isVisible && !isSearchExpanded" class="nav-page-title">
            {{ navTitleStore.title }}
          </span>
        </transition>
      </div>
    </transition>

    <!-- ── SPACER ─────────────── -->
    <div class="flex-1" />

    <!-- 搜索输入框 -->
    <div class="search-wrap" :class="isSearchExpanded ? 'search-wrap--open' : 'search-wrap--idle'">
      <n-popover
        trigger="manual"
        placement="bottom-end"
        :show="showSuggestions"
        :show-arrow="false"
        style="margin-top: 6px"
        content-style="padding:0;border-radius:10px;overflow:hidden;border:1px solid rgba(20,24,31,0.08);box-shadow:none;"
        raw
      >
        <template #trigger>
          <div class="search-inner" :class="{ 'search-inner--focus': inputFocused }">
            <i class="iconfont icon-search search-icon-glyph" />
            <input
              ref="inputRef"
              name="music-search"
              aria-label="搜索歌曲、歌手或歌单"
              v-model="searchValue"
              class="search-input"
              :placeholder="cleanHotSearchKeyword"
              @input="handleInput(searchValue)"
              @keydown="handleKeydown"
              @focus="handleFocus"
              @blur="handleBlur"
            />
            <n-dropdown
              v-if="searchTypeOptions.length && isSearchExpanded"
              trigger="hover"
              :options="searchTypeOptions"
              @select="selectSearchType"
              @mousedown.prevent
            >
              <div class="type-chip" @mousedown.prevent>
                <span>{{
                  searchTypeOptions.find((i) => i.key === searchStore.searchType)?.label
                }}</span>
                <i class="iconfont icon-xiasanjiaoxing text-[10px]" />
              </div>
            </n-dropdown>
          </div>
        </template>
        <div class="suggestions-box">
          <n-scrollbar style="max-height: 260px">
            <div v-if="suggestionsLoading" class="suggest-loading">
              <n-spin size="small" />
            </div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              class="suggest-row"
              :class="{ 'suggest-row--hi': i === highlightedIndex }"
              @mousedown.prevent="selectSuggestion(s)"
              @mouseenter="highlightedIndex = i"
            >
              <i class="ri-search-line suggest-icon" />
              <span>{{ s }}</span>
            </div>
          </n-scrollbar>
        </div>
      </n-popover>
    </div>

    <!-- 下载按钮 -->
    <button v-if="showDownloadButton" class="action-btn" @click="navigateToDownloads">
      <n-badge :value="downloadingCount" :max="99" :show="downloadingCount > 0" :offset="[-2, 2]">
        <i class="ri-download-cloud-2-line" />
      </n-badge>
    </button>

    <n-tooltip v-if="isDesktopRuntime" trigger="hover">
      <template #trigger>
        <button
          class="action-btn"
          :class="{ 'update-checking': updateChecking }"
          :disabled="updateChecking"
          @click="handleAppUpdateClick"
        >
          <n-badge dot :show="hasAppUpdate" :offset="[-1, 3]">
            <i class="ri-upload-cloud-2-line" />
          </n-badge>
        </button>
      </template>
      {{ hasAppUpdate ? t('settings.about.hasUpdate') : t('settings.about.checkUpdate') }}
    </n-tooltip>

    <!-- 心动模式按钮 -->
    <n-tooltip v-if="showIntelligenceBtn" trigger="hover">
      <template #trigger>
        <button
          class="action-btn"
          :class="{ 'intelligence-active': isIntelligenceMode }"
          @click="toggleIntelligenceMode"
        >
          <i class="ri-heart-pulse-line" />
        </button>
      </template>
      {{
        isIntelligenceMode
          ? t('comp.searchBar.exitIntelligence')
          : t('comp.searchBar.intelligenceMode')
      }}
    </n-tooltip>

    <!-- 用户 -->
    <div v-if="!userStore.user" class="user-btn" @click="toLogin">
      <span class="login-label">{{ t('comp.searchBar.login') }}</span>
    </div>
    <n-popover v-else trigger="hover" placement="bottom-end" :show-arrow="false" raw>
      <template #trigger>
        <div class="user-btn cursor-pointer" @click="selectItem('user')">
          <n-avatar circle :size="26" :src="getImgUrl(userStore.user.avatarUrl)" />
        </div>
      </template>
      <div class="user-menu">
        <div class="user-menu-top" @click="selectItem('user')">
          <n-avatar circle :size="30" :src="getImgUrl(userStore.user?.avatarUrl)" />
          <span class="user-name">{{ userStore.user?.nickname }}</span>
        </div>
        <div class="menu-sep" />
        <div class="menu-list">
          <div class="menu-row" @click="selectItem('logout')">
            <i class="ri-logout-box-r-line" /><span>{{ t('comp.searchBar.logout') }}</span>
          </div>
        </div>
      </div>
    </n-popover>

    <!-- 更多设置 -->
    <n-popover trigger="hover" placement="bottom-end" :show-arrow="false" raw>
      <template #trigger>
        <button class="action-btn" aria-label="更多设置">
          <i class="ri-menu-line" />
        </button>
      </template>
      <div class="user-menu">
        <div class="menu-list">
          <div class="menu-row" @click="selectItem('set')">
            <i class="ri-settings-3-line" /><span>{{ t('comp.searchBar.set') }}</span>
          </div>
          <button
            v-if="isDesktopRuntime"
            class="menu-row menu-action"
            :disabled="updateChecking"
            @click="handleAppUpdateClick"
          >
            <i class="ri-refresh-line" />
            <span>{{ updateChecking ? '正在检查更新…' : t('settings.about.checkUpdate') }}</span>
          </button>
          <button class="menu-row menu-action" @click="openMobileDownload">
            <i class="ri-smartphone-line" /><span>下载移动版</span>
          </button>
          <div v-if="isDesktopRuntime" class="menu-row">
            <i class="ri-zoom-in-line" /><span>{{ t('comp.searchBar.zoom') }}</span>
            <div class="zoom-ctrl ml-auto">
              <button class="zoom-btn" @click.stop="decreaseZoom">
                <i class="ri-subtract-line" />
              </button>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <span
                    class="zoom-val"
                    :class="{ 'zoom-val--100': isZoom100() }"
                    @click.stop="resetZoom"
                  >
                    {{ Math.round(zoomFactor * 100) }}%
                  </span>
                </template>
                {{ isZoom100() ? t('comp.searchBar.zoom100') : t('comp.searchBar.resetZoom') }}
              </n-tooltip>
              <button class="zoom-btn" @click.stop="increaseZoom"><i class="ri-add-line" /></button>
            </div>
          </div>
          <div class="menu-row">
            <i :class="isDark ? 'ri-moon-line' : 'ri-sun-line'" />
            <span>{{ t('comp.searchBar.theme') }}</span>
            <n-switch v-model:value="isDark" class="ml-auto" size="small">
              <template #checked><i class="ri-moon-line text-[10px]" /></template>
              <template #unchecked><i class="ri-sun-line text-[10px]" /></template>
            </n-switch>
          </div>
          <div class="menu-row" @click="restartApp">
            <i class="ri-restart-line" /><span>{{ t('comp.searchBar.restart') }}</span>
          </div>
          <div class="menu-row" @click="selectItem('refresh')">
            <i class="ri-refresh-line" /><span>{{ t('comp.searchBar.refresh') }}</span>
          </div>
        </div>
      </div>
    </n-popover>
  </div>
</template>

<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core';
import { useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getSearchKeyword } from '@/api/home';
import { getUserDetail } from '@/api/login';
import { getSearchSuggestions } from '@/api/search';
import { SEARCH_TYPES, USER_SET_OPTIONS } from '@/const/bar-const';
import { useAppUpdateState } from '@/hooks/useAppUpdateState';
import { useDownloadStatus } from '@/hooks/useDownloadStatus';
import { useZoom } from '@/hooks/useZoom';
import { useIntelligenceModeStore } from '@/store/modules/intelligenceMode';
import { useNavTitleStore } from '@/store/modules/navTitle';
import { useSearchStore } from '@/store/modules/search';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isDesktopRuntime } from '@/utils';

import { APP_UPDATE_RELEASE_URL, APP_UPDATE_STATUS } from '../../../shared/appUpdate';

const router = useRouter();
const route = useRoute();
const navTitleStore = useNavTitleStore();
const searchStore = useSearchStore();
const settingsStore = useSettingsStore();
const userStore = useUserStore();
const userSetOptions = ref(USER_SET_OPTIONS);
const { t, locale } = useI18n();
const message = useMessage();

const intelligenceModeStore = useIntelligenceModeStore();
const { downloadingCount, navigateToDownloads } = useDownloadStatus();
const { appUpdateState, hasAppUpdate } = useAppUpdateState();
const showDownloadButton = computed(
  () =>
    isDesktopRuntime &&
    (settingsStore.setData?.alwaysShowDownloadButton || downloadingCount.value > 0)
);
const { zoomFactor, initZoomFactor, increaseZoom, decreaseZoom, resetZoom, isZoom100 } = useZoom();
const updateChecking = computed(() => appUpdateState.value.status === APP_UPDATE_STATUS.checking);

// ── 心动模式 ─────────────────────────────────────────
const isIntelligenceMode = computed(() => intelligenceModeStore.isIntelligenceMode);
const showIntelligenceBtn = computed(() => userStore.user && userStore.loginType === 'cookie');
const toggleIntelligenceMode = async () => {
  if (isIntelligenceMode.value) {
    intelligenceModeStore.clearIntelligenceMode();
  } else {
    await intelligenceModeStore.playIntelligenceMode();
  }
};

// ── Back button ───────────────────────────────────────
const showBackButton = computed(() => {
  const meta = router.currentRoute.value.meta;
  if (!settingsStore.isMobile && meta.isMobile === false) return false;
  return meta.back === true;
});
const goBack = () => router.back();

// ── Tabs ──────────────────────────────────────────────
const tabs = computed(() => {
  const items = [
    { key: 'home', label: t('comp.home'), path: '/' },
    { key: 'playlist', label: t('comp.list'), path: '/list' },
    { key: 'album', label: t('comp.newAlbum.title'), path: '/album' },
    {
      key: 'charts',
      label: t('comp.toplist'),
      path: '/toplist'
    },
    { key: 'mv', label: t('comp.mv'), path: '/mv' },
    { key: 'podcast', label: t('podcast.podcast'), path: '/podcast' },
    { key: 'history', label: t('comp.history'), path: '/history' },
    {
      key: 'localMusic',
      label: t('comp.localMusic'),
      path: '/local-music',
      desktopOnly: true
    }
  ];
  return items.filter((tab) => !tab.desktopOnly || isDesktopRuntime);
});
const isTabActive = (path: string) => route.path === path;

const tabIcons: Record<string, string> = {
  '/': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 10.8 12 4.6l7.5 6.2v7.7A1.5 1.5 0 0 1 18 20h-3.8v-5.4H9.8V20H6a1.5 1.5 0 0 1-1.5-1.5v-7.7Z"/></svg>',
  '/list':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12M6 11h12M6 16h7M17 15v4l3-2v-4l-3 2Z"/></svg>',
  '/album':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.8a7.2 7.2 0 1 0 0 14.4 7.2 7.2 0 0 0 0-14.4Zm0 4.8a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z"/></svg>',
  '/toplist':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18V10m7 8V6m7 12v-5"/></svg>',
  '/mv':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h10.5A2.5 2.5 0 0 1 18 10.5v3A2.5 2.5 0 0 1 15.5 16H5V8Zm13 3 3-1.8v5.6L18 13"/></svg>',
  '/podcast':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3 3 0 0 0 3-3V8a3 3 0 0 0-6 0v3.5a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 17.5V21"/></svg>',
  '/history':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v6l4 2M4.8 8.2A8 8 0 1 1 4 12"/></svg>',
  '/local-music':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8h6l1.5 2h7.5v7.5A1.5 1.5 0 0 1 18 19H6a1.5 1.5 0 0 1-1.5-1.5V8Z"/></svg>'
};

const getTabIcon = (tabPath: string) => tabIcons[tabPath] || tabIcons['/'];

// Sliding pill
const tabsTrackRef = ref<HTMLElement | null>(null);
const tabElsRef = ref<HTMLElement[]>([]);
const setTabRef = (el: HTMLElement, i: number) => {
  if (el) tabElsRef.value[i] = el;
};
const activeTabIndex = computed(() => tabs.value.findIndex((t) => isTabActive(t.path)));
const sliderStyle = computed(() => {
  const el = tabElsRef.value[activeTabIndex.value];
  if (!el) return { opacity: '0' };
  return {
    transform: `translateX(${el.offsetLeft}px)`,
    width: `${el.offsetWidth}px`,
    opacity: '1'
  };
});

// ── Search expand / collapse ──────────────────────────
const isSearchExpanded = ref(false);
const inputFocused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const handleFocus = () => {
  inputFocused.value = true;
  isSearchExpanded.value = true;
  if (searchValue.value && suggestions.value.length) showSuggestions.value = true;
};
const handleBlur = () => {
  inputFocused.value = false;
  setTimeout(() => {
    showSuggestions.value = false;
    isSearchExpanded.value = false;
  }, 150);
};

// ── Search logic ──────────────────────────────────────
const stripEmoji = (value: string) =>
  value.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
const hotSearchKeyword = ref(t('comp.searchBar.searchPlaceholder'));
const hotSearchValue = ref('');
const searchValue = ref('');
const cleanHotSearchKeyword = computed(() => stripEmoji(hotSearchKeyword.value));

watch(
  () => searchStore.searchValue,
  (v) => {
    if (v) searchValue.value = v;
  },
  { immediate: true }
);

const search = () => {
  const val = searchValue.value.trim() || hotSearchValue.value;
  if (!val) return;
  searchValue.value = val;
  suggestionSequence++;
  const q = { keyword: val, type: searchStore.searchType };
  if (router.currentRoute.value.path === '/search-result') {
    searchStore.searchValue = val;
    router.replace({ path: '/search-result', query: q });
  } else {
    router.push({ path: '/search-result', query: q });
  }
  showSuggestions.value = false;
};

const selectSearchType = (key: number) => {
  searchStore.searchType = key;
  if (searchValue.value)
    router.push({ path: '/search-result', query: { keyword: searchValue.value, type: key } });
  nextTick(() => inputRef.value?.focus());
};

const rawSearchTypes = ref(SEARCH_TYPES);
const searchTypeOptions = computed(() => {
  locale.value;
  return rawSearchTypes.value
    .filter(() => isDesktopRuntime)
    .map((type) => ({ label: t(type.label), key: type.key }));
});

const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);
const suggestionsLoading = ref(false);
const highlightedIndex = ref(-1);

let suggestionSequence = 0;
const debouncedSuggest = useDebounceFn(async (kw: string, sequence: number) => {
  if (!kw.trim()) return;
  suggestionsLoading.value = true;
  try {
    const result = await getSearchSuggestions(kw);
    // 根因：较早的慢响应会覆盖新输入并重新弹出已关闭的下拉框；只接收当前输入的结果。
    if (sequence !== suggestionSequence || searchValue.value !== kw) return;
    suggestions.value = result;
    showSuggestions.value = inputFocused.value && result.length > 0;
    highlightedIndex.value = -1;
  } finally {
    if (sequence === suggestionSequence) suggestionsLoading.value = false;
  }
}, 250);
const handleInput = (value: string) => {
  const sequence = ++suggestionSequence;
  if (!value.trim()) {
    suggestions.value = [];
    suggestionsLoading.value = false;
    showSuggestions.value = false;
    return;
  }
  void debouncedSuggest(value, sequence);
};
const selectSuggestion = (s: string) => {
  searchValue.value = s;
  showSuggestions.value = false;
  search();
};

const handleKeydown = (e: KeyboardEvent) => {
  const len = suggestions.value.length;
  if (!showSuggestions.value || !len) {
    if (e.key === 'Enter') search();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value + 1) % len;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value - 1 + len) % len;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    highlightedIndex.value >= 0
      ? selectSuggestion(suggestions.value[highlightedIndex.value])
      : search();
  }
  if (e.key === 'Escape') {
    showSuggestions.value = false;
  }
};

// ── User / misc ───────────────────────────────────────
const loadHotSearch = async () => {
  const { data } = await getSearchKeyword();
  hotSearchKeyword.value = stripEmoji(
    data.data.showKeyword || t('comp.searchBar.searchPlaceholder')
  );
  hotSearchValue.value = data.data.realkeyword;
};
const loadPage = async () => {
  if (!localStorage.getItem('token')) return;
  const { data } = await getUserDetail();
  userStore.user =
    data.profile || userStore.user || JSON.parse(localStorage.getItem('user') || '{}');
  localStorage.setItem('user', JSON.stringify(userStore.user));
};
watchEffect(() => {
  userSetOptions.value = userStore.user
    ? USER_SET_OPTIONS
    : USER_SET_OPTIONS.filter((i) => i.key !== 'logout');
});

const restartApp = () => window.desktop.send('restart');
const toLogin = () => router.push('/user');

const isDark = computed({
  get: () => settingsStore.theme === 'dark',
  set: () => settingsStore.toggleTheme()
});

const selectItem = (key: string) => {
  switch (key) {
    case 'logout':
      userStore.handleLogout();
      break;
    case 'set':
      router.push('/set');
      break;
    case 'user':
      router.push('/user');
      break;
    case 'refresh':
      window.location.reload();
      break;
  }
};

const openMobileDownload = async () => {
  try {
    if (isDesktopRuntime) {
      await window.desktop.openAppUpdatePage();
    } else {
      window.open(APP_UPDATE_RELEASE_URL, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    console.error('打开发行页面失败：', error);
    message.error('暂时无法打开下载页面，请稍后重试');
  }
};

const handleAppUpdateClick = async () => {
  if (updateChecking.value) return;
  if (hasAppUpdate.value) {
    settingsStore.setShowUpdateModal(true);
    return;
  }

  try {
    const result = await window.desktop.checkAppUpdate(true);
    settingsStore.setAppUpdateState(result);
    if (result.status === APP_UPDATE_STATUS.available) {
      settingsStore.setShowUpdateModal(true);
    } else if (result.status === APP_UPDATE_STATUS.notAvailable) {
      message.success(t('settings.about.latest'));
    } else if (result.status === APP_UPDATE_STATUS.error) {
      message.error(result.errorMessage || t('settings.about.messages.checkError'));
    }
  } catch (e) {
    console.error('检查更新失败:', e);
    message.error(t('settings.about.messages.checkError'));
  }
};

onMounted(() => {
  void loadHotSearch().catch(() => {
    hotSearchKeyword.value = t('comp.searchBar.searchPlaceholder');
  });
  void loadPage().catch((error) => console.warn('用户信息暂未刷新：', error));
  isDesktopRuntime && initZoomFactor();
});
</script>

<style scoped>
.search-bar-shell {
  min-height: 52px;
  background: transparent;
}

.tabs-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 40px;
  background: transparent;
  padding: 0;
  gap: 4px;
  box-sizing: border-box;
}
.dark .tabs-track {
  background: transparent;
}

.tab-slider-bg {
  position: absolute;
  top: 4px;
  left: 0;
  height: calc(100% - 8px);
  border-radius: 8px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 15%, transparent);
  box-shadow: none;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1),
    width 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
  pointer-events: none;
  z-index: 0;
}

.tab-btn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.2s,
    background 0.2s;
}
.tab-btn--on {
  color: var(--qqm-primary-strong, #13c76b);
}
.tab-btn--off {
  color: #6b7280;
}
.dark .tab-btn--off {
  color: #9ca3af;
}
.tab-btn--off:hover {
  color: #111827;
  background: rgba(24, 28, 34, 0.04);
}
.dark .tab-btn--off:hover {
  color: #f9fafb;
  background: rgba(255, 255, 255, 0.06);
}

/* ── Back button ─────────────────────────────────────── */
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.dark .back-btn {
  border-color: #374151;
  color: #9ca3af;
}
.back-btn:hover {
  color: #22c55e;
  border-color: #22c55e;
}

/* ── Search wrap ─────────────────────────────────────── */
.search-wrap {
  transition:
    flex 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.search-wrap--idle {
  flex: 0 0 180px;
  max-width: 180px;
}
.search-wrap--open {
  flex: 0 0 260px;
  max-width: 260px;
}

.search-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border-radius: 9999px;
  border: 1.5px solid #e5e7eb;
  background: #f9fafb;
  transition:
    border-color 0.2s,
    background 0.2s,
    border-color 0.2s;
}
.dark .search-inner {
  border-color: #374151;
  background: #111827;
}
.search-inner--focus {
  border-color: #22c55e;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.18);
}
.dark .search-inner--focus {
  background: #0a0a0a;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.22);
}

.search-icon-glyph {
  font-size: 14px;
  color: #9ca3af;
  flex-shrink: 0;
  transition: color 0.2s;
}
.search-inner--focus .search-icon-glyph {
  color: #22c55e;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
}
.dark .search-input {
  color: #f3f4f6;
}
.search-input::placeholder {
  color: #9ca3af;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  background: #f3f4f6;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
  flex-shrink: 0;
}
.dark .type-chip {
  background: #1f2937;
  color: #9ca3af;
}
.type-chip:hover {
  background: #dcfce7;
  color: #16a34a;
}
.dark .type-chip:hover {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

/* ── Action buttons ──────────────────────────────────── */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  background: transparent;
  color: #6b7280;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
}
.dark .action-btn {
  border-color: #374151;
  color: #9ca3af;
}
.action-btn:hover {
  color: #22c55e;
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.dark .action-btn:hover {
  border-color: #166534;
  background: rgba(34, 197, 94, 0.08);
  color: #22c55e;
}
.action-btn.intelligence-active {
  color: #ec4899;
  border-color: #fbcfe8;
  background: #fdf2f8;
}
.dark .action-btn.intelligence-active {
  color: #ec4899;
  border-color: #831843;
  background: rgba(236, 72, 153, 0.1);
}

/* ── User button ─────────────────────────────────────── */
.user-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.15s,
    border-color 0.15s;
}
.dark .user-btn {
  border-color: #374151;
}
.user-btn:hover {
  border-color: #22c55e;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.18);
}

.login-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 0 8px;
}
.dark .login-label {
  color: #9ca3af;
}

/* ── User menu ───────────────────────────────────────── */
.user-menu {
  min-width: 220px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #f3f4f6;
  box-shadow: none;
}
.dark .user-menu {
  background: #111827;
  border-color: #1f2937;
}

.user-menu-top {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.user-menu-top:hover {
  background: #f9fafb;
}
.dark .user-menu-top:hover {
  background: #1f2937;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dark .user-name {
  color: #f3f4f6;
}

.menu-sep {
  height: 1px;
  background: #f3f4f6;
  margin: 2px 0;
}
.dark .menu-sep {
  background: #1f2937;
}

.menu-list {
  padding: 3px 0 5px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.12s;
}
.dark .menu-row {
  color: #d1d5db;
}
.menu-action {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  font-family: inherit;
}
.menu-action:disabled {
  cursor: wait;
  opacity: 0.6;
}
.menu-row:hover {
  background: #f9fafb;
}
.dark .menu-row:hover {
  background: #1f2937;
}

.menu-row i {
  font-size: 15px;
  color: #9ca3af;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.zoom-ctrl {
  display: flex;
  align-items: center;
  gap: 3px;
}
.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-btn:hover {
  background: #dcfce7;
  color: #16a34a;
}
.zoom-val {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-val--100 {
  background: #dcfce7;
  color: #16a34a;
}
.ver-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
}
.dark .ver-chip {
  background: #1f2937;
  color: #9ca3af;
}

/* ── Suggestions ─────────────────────────────────────── */
.suggestions-box {
  background: #fff;
}
.dark .suggestions-box {
  background: #111827;
}

.suggest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.1s;
}
.dark .suggest-row {
  color: #d1d5db;
}
.suggest-row:hover,
.suggest-row--hi {
  background: #f0fdf4;
  color: #16a34a;
}
.dark .suggest-row:hover,
.dark .suggest-row--hi {
  background: rgba(34, 197, 94, 0.06);
  color: #22c55e;
}
.suggest-icon {
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}
.suggest-loading {
  display: flex;
  justify-content: center;
  padding: 12px;
}

/* ── Nav page title ──────────────────────────────────── */
.nav-page-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
  letter-spacing: -0.01em;
}
.dark .nav-page-title {
  color: #f9fafb;
}

/* ── Transitions ─────────────────────────────────────── */
.tab-slide-enter-active,
.tab-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.tab-slide-enter-from,
.tab-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.nav-title-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.nav-title-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.nav-title-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.nav-title-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
