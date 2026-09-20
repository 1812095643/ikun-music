<script setup lang="ts">
import { activeTab, switchTab } from '@/stores/browse';
const tabs = [
  { key: 'discover' as const, label: '发现', icon: 'home-5' },
  { key: 'search' as const, label: '搜索', icon: 'search' },
  { key: 'playlists' as const, label: '歌单', icon: 'play-list-2' },
  { key: 'library' as const, label: '我的', icon: 'user-3' }
];
</script>
<template>
  <view class="bottom-navigation" role="tablist" aria-label="主导航"
    ><button
      v-for="tab in tabs"
      :key="tab.key"
      class="nav-item"
      :class="{ selected: activeTab === tab.key }"
      role="tab"
      :aria-selected="activeTab === tab.key"
      @click="switchTab(tab.key)"
    >
      <view class="nav-icon"
        ><text :class="`ri-${tab.icon}-${activeTab === tab.key ? 'fill' : 'line'}`" /></view
      ><text class="nav-label">{{ tab.label }}</text>
    </button></view
  >
</template>
<style scoped>
.bottom-navigation {
  display: flex;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding: 3px 9px var(--safe-bottom);
  background: var(--qqm-surface);
  flex-shrink: 0;
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--qqm-muted) !important;
}
.nav-icon {
  font-size: 25px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.nav-label {
  font-size: calc(12px + var(--font-size-adjustment));
  line-height: 1.3;
}
.nav-item.selected {
  color: var(--qqm-text) !important;
}
.selected .nav-label {
  font-weight: 600;
}
.selected .nav-icon {
  color: var(--qqm-primary-strong);
}
</style>
