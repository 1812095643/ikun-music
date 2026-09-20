<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import type { Collection } from '@/services/musicApi';
import { deviceMode, viewport, wideLayout } from '@/stores/device';

import CoverArt from './CoverArt.vue';

const props = defineProps<{ items: Collection[]; loading: boolean }>();
const emit = defineEmits<{ select: [collection: Collection] }>();
const activeIndex = shallowRef(0);
const displayCount = computed(() =>
  deviceMode.value !== 'phone' && wideLayout.value ? (viewport.value.width >= 1480 ? 3 : 2) : 1
);
const pagination = computed(() =>
  props.items.slice(0, Math.max(1, props.items.length - displayCount.value + 1))
);
const labels = ['今日精选', '换个心情', '发现好音乐'];

watch(
  () => [props.items.length, displayCount.value],
  ([length, count]) => {
    activeIndex.value = Math.min(activeIndex.value, Math.max(0, length - count));
  }
);
</script>

<template>
  <view v-if="items.length" class="featured">
    <swiper
      class="featured-swiper"
      previous-margin="20px"
      next-margin="32px"
      :current="activeIndex"
      :display-multiple-items="displayCount"
      :duration="280"
      @change="activeIndex = $event.detail.current"
    >
      <swiper-item v-for="(item, index) in items" :key="item.id" class="featured-slide">
        <button
          role="button"
          class="featured-card"
          :class="`featured-tone-${index % 3}`"
          :aria-label="`打开歌单 ${item.title}`"
          @click="emit('select', item)"
        >
          <view class="featured-copy">
            <text class="featured-label">{{ labels[index % 3] }}</text>
            <text class="featured-title line-clamp">{{ item.title }}</text>
            <view class="featured-action">
              <text>听听这张歌单</text>
              <text class="ri-arrow-right-line" />
            </view>
          </view>
          <view class="featured-artwork" aria-hidden="true">
            <view class="featured-record" />
            <view class="featured-cover"><cover-art :src="item.cover" radius="10px" large /></view>
          </view>
        </button>
      </swiper-item>
    </swiper>
    <view v-if="pagination.length > 1" class="featured-pagination">
      <button
        v-for="(item, index) in pagination"
        :key="item.id"
        role="button"
        class="featured-page"
        :class="{ selected: activeIndex === index }"
        :aria-label="`查看第 ${index + 1} 张精选歌单`"
        :aria-pressed="activeIndex === index"
        @click="activeIndex = index"
      >
        <view class="featured-page-mark" />
      </button>
    </view>
  </view>
  <view v-else-if="loading" class="featured-placeholder skeleton" aria-label="正在加载精选歌单" />
</template>

<style scoped>
.featured-swiper {
  height: 198px;
}
.featured-slide {
  padding: 4px 12px 8px 0;
}
.featured-card {
  --featured-bg: #dce8ce;
  --featured-ink: #283d27;
  --featured-muted: #5b7050;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
  padding: 20px !important;
  border-radius: 17px !important;
  background: var(--featured-bg) !important;
  color: var(--featured-ink) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  text-align: left;
  overflow: hidden;
  transition: transform 0.18s var(--qqm-ease);
}
.featured-tone-1 {
  --featured-bg: #efdfce;
  --featured-ink: #503d2a;
  --featured-muted: #796147;
}
.featured-tone-2 {
  --featured-bg: #d4e5e2;
  --featured-ink: #2d4441;
  --featured-muted: #526e69;
}
.theme-dark .featured-card {
  --featured-bg: #294035;
  --featured-ink: #e0efd9;
  --featured-muted: #acc5ae;
  box-shadow: inset 0 1px 0 rgba(235, 255, 238, 0.06);
}
.theme-dark .featured-tone-1 {
  --featured-bg: #40362e;
  --featured-ink: #f4e5d5;
  --featured-muted: #c4ad98;
}
.theme-dark .featured-tone-2 {
  --featured-bg: #263e3f;
  --featured-ink: #daede9;
  --featured-muted: #a6c5be;
}
.featured-card:active {
  transform: scale(0.985);
}
.featured-copy {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  min-width: 0;
  flex: 1;
}
.featured-label {
  font-size: calc(12px + var(--font-size-adjustment));
  letter-spacing: 1px;
  color: var(--featured-muted);
  line-height: 1.5;
}
.featured-title {
  font-size: calc(20px + var(--font-size-adjustment));
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.4px;
  margin-top: 12px;
  -webkit-line-clamp: 3;
  overflow-wrap: anywhere;
}
.featured-action {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: auto;
  padding-top: 8px;
  color: var(--featured-muted);
  font-size: calc(12px + var(--font-size-adjustment));
  white-space: nowrap;
}
.featured-action .ri-arrow-right-line {
  font-size: 15px;
}
.featured-artwork {
  width: 128px;
  height: 116px;
  position: relative;
  flex-shrink: 0;
}
.featured-record {
  position: absolute;
  right: 0;
  top: 5px;
  height: 106px;
  width: 106px;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #27322a 0 2px, #3d483d 3px, #27322a 4px 6px);
  box-shadow: 3px 6px 12px rgba(24, 38, 26, 0.12);
}
.featured-cover {
  position: relative;
  width: 116px;
  height: 116px;
  border-radius: 10px;
  box-shadow:
    0 2px 4px rgba(30, 44, 31, 0.08),
    0 9px 18px rgba(30, 44, 31, 0.15);
}
.featured-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  position: relative;
  z-index: 1;
}
.featured-page {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.featured-page-mark {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  background: var(--qqm-muted);
  opacity: 0.22;
  transition: opacity 0.18s ease;
}
.selected .featured-page-mark {
  background: var(--qqm-primary-strong);
  opacity: 1;
}
.featured-placeholder {
  height: 186px;
  border-radius: 17px;
  margin: 4px var(--page-gutter) 28px;
}
@media (max-width: 380px) {
  .featured-card {
    gap: 12px;
    padding: 18px 16px !important;
  }
  .featured-artwork {
    width: 106px;
    height: 96px;
  }
  .featured-cover {
    width: 96px;
    height: 96px;
  }
  .featured-record {
    width: 86px;
    height: 86px;
  }
  .featured-title {
    font-size: calc(19px + var(--font-size-adjustment));
  }
}
@media (max-height: 720px) {
  .featured-swiper {
    height: 162px;
  }
  .featured-card {
    padding-top: 16px !important;
    padding-bottom: 16px !important;
  }
  .featured-title {
    font-size: calc(19px + var(--font-size-adjustment));
    line-height: 1.45;
    margin-top: 8px;
    -webkit-line-clamp: 2;
  }
  .featured-artwork {
    width: 104px;
    height: 94px;
  }
  .featured-cover {
    width: 94px;
    height: 94px;
  }
  .featured-record {
    width: 84px;
    height: 84px;
  }
}
</style>
