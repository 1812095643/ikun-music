<script setup lang="ts">
import { activeTab, closeCollection, secondaryPage, switchTab } from '@/stores/browse';
const tabs = [
  { key: 'discover' as const, label: '发现', icon: 'home-5' },
  { key: 'search' as const, label: '搜索', icon: 'search' },
  { key: 'playlists' as const, label: '歌单', icon: 'play-list-2' },
  { key: 'library' as const, label: '我的', icon: 'user-3' }
];
function openPage(page: 'transfer' | 'settings') {
  closeCollection();
  secondaryPage.value = page;
}
</script>
<template>
  <view class="navigation-rail" aria-label="主导航">
    <view class="rail-identity"
      ><image class="rail-brand" src="/static/brand.png" mode="aspectFit" /><text class="rail-name"
        >ikun 音乐</text
      ></view
    >
    <view class="rail-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        role="button"
        class="rail-tab"
        :class="{ selected: activeTab === tab.key && !secondaryPage }"
        :aria-label="tab.label"
        @click="switchTab(tab.key)"
      >
        <text
          :class="`ri-${tab.icon}-${activeTab === tab.key && !secondaryPage ? 'fill' : 'line'}`"
        />
        <text>{{ tab.label }}</text>
      </button>
      <button
        role="button"
        class="rail-tab"
        :class="{ selected: secondaryPage === 'transfer' }"
        @click="openPage('transfer')"
      >
        <text class="ri-share-forward-box-line" /><text>互传</text>
      </button>
    </view>
    <button
      role="button"
      class="rail-tab rail-settings"
      aria-label="显示与音乐设置"
      @click="openPage('settings')"
    >
      <text class="ri-settings-3-line" /><text>设置</text>
    </button>
  </view>
</template>
<style scoped>
.navigation-rail {
  width: var(--rail-width, 88px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 22px 12px 18px;
  background: var(--qqm-surface);
  border-right: 1px solid var(--qqm-border);
}
.rail-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  margin-bottom: 30px;
}
.rail-brand {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.rail-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
}
.rail-tabs {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rail-tab {
  width: 100%;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 12px !important;
  color: var(--qqm-muted) !important;
  font-size: calc(12px + var(--font-size-adjustment)) !important;
  transition:
    background 160ms ease,
    color 160ms ease;
}
.rail-tab > text:first-child {
  font-size: 22px;
  line-height: 1;
}
.rail-tab > text:last-child {
  line-height: 1.2;
}
.rail-tab.selected {
  background: var(--qqm-primary-soft) !important;
  color: var(--qqm-accent-text) !important;
  font-weight: 600 !important;
}
.rail-tab:active {
  background: var(--qqm-surface-muted) !important;
}
.rail-tabs > .rail-tab:last-child {
  margin-top: 15px !important;
}
.rail-settings {
  margin-top: auto !important;
}
@media (min-width: 980px) {
  .navigation-rail {
    width: var(--rail-width, 168px);
    padding: 26px 16px 20px;
  }
  .rail-identity {
    width: 100%;
    flex-direction: row;
    justify-content: center;
    gap: 10px;
    margin-bottom: 36px;
  }
  .rail-name {
    font-size: 15px;
  }
  .rail-tab {
    flex-direction: row;
    justify-content: flex-start;
    padding: 0 17px !important;
    gap: 14px;
    min-height: 46px;
    font-size: calc(15px + var(--font-size-adjustment)) !important;
  }
  .rail-tabs {
    gap: 10px;
  }
  .device-car .rail-identity {
    flex-direction: column;
    margin-bottom: 22px;
  }
  .device-car .rail-name {
    font-size: 11px;
  }
  .device-car .rail-tab {
    flex-direction: column;
    justify-content: center;
    padding: 8px 0 !important;
    gap: 5px;
    font-size: 14px !important;
  }
}
@media (max-height: 620px) {
  .navigation-rail {
    padding-top: 14px;
    padding-bottom: 10px;
  }
  .rail-identity {
    margin-bottom: 16px;
  }
  .rail-tabs {
    gap: 4px;
  }
  .rail-tab {
    min-height: 46px;
  }
  .rail-tabs > .rail-tab:last-child {
    margin-top: 8px !important;
  }
  .rail-brand {
    width: 30px;
    height: 30px;
  }
  .rail-name {
    font-size: 11px;
  }
}
</style>
