<script setup lang="ts">
defineProps<{ title?: string; discovery?: boolean; back?: boolean; settings?: boolean }>();
const emit = defineEmits<{ back: []; search: []; settings: [] }>();
</script>
<template>
  <view class="app-header" :class="{ discovery }"
    ><template v-if="discovery"
      ><button
        role="button"
        class="header-search"
        aria-label="搜索歌曲、歌手"
        @click="emit('search')"
      >
        <image src="/static/brand.png" mode="aspectFill" /><text>搜索歌曲、歌手</text
        ><text class="ri-search-line" /></button
      ><button
        role="button"
        class="button-icon header-brand"
        aria-label="打开音乐设置"
        @click="emit('settings')"
      >
        <text class="ri-settings-3-line" /></button></template
    ><template v-else
      ><button
        v-if="back"
        role="button"
        class="button-icon header-back"
        aria-label="返回"
        @click="emit('back')"
      >
        <text class="ri-arrow-left-line" /></button
      ><text class="header-title" :class="{ centered: back }">{{ title }}</text
      ><button
        v-if="settings"
        role="button"
        class="button-icon"
        aria-label="设置"
        @click="emit('settings')"
      >
        <text class="ri-menu-3-line" /></button
      ><button
        v-else-if="!back"
        role="button"
        class="button-icon"
        aria-label="搜索音乐"
        @click="emit('search')"
      >
        <text class="ri-search-line" /></button
      ><view v-else class="header-balance" /></template
  ></view>
</template>
<style scoped>
.app-header {
  height: 62px;
  padding: 5px 14px 5px var(--page-gutter);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.header-title {
  font-size: calc(26px + var(--font-size-adjustment));
  font-weight: 650;
  letter-spacing: -0.5px;
  flex: 1;
}
.header-title.centered {
  text-align: center;
  font-size: calc(18px + var(--font-size-adjustment));
  font-weight: 600;
}
.header-back {
  margin-left: -9px !important;
}
.header-balance {
  width: 44px;
}
.header-search {
  flex: 1;
  min-width: 0;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 24px !important;
  background: rgba(111, 143, 126, 0.075) !important;
  padding: 0 13px 0 7px !important;
  text-align: left;
}
.header-search image {
  width: 27px;
  height: 27px;
  border-radius: 50%;
}
.header-search > text:first-of-type {
  flex: 1;
  color: var(--qqm-muted);
  font-size: calc(14px + var(--font-size-adjustment));
}
.header-search .ri-search-line {
  font-size: 20px;
}
.header-brand {
  font-size: 24px !important;
  color: var(--qqm-text) !important;
}
.header-search:active {
  background: var(--qqm-primary-soft) !important;
}
.discovery {
  height: 62px;
}
</style>
