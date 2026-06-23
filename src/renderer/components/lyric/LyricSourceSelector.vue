<script setup lang="ts">
import { computed } from 'vue';

import type { LyricCandidate } from '@/types/music';

const props = defineProps<{
  candidates: LyricCandidate[];
  activeKey: string;
  loading: boolean;
  errorMessage?: string;
}>();

const emit = defineEmits<{
  (e: 'select', key: string): void;
  (e: 'refresh'): void;
}>();

const skeletonRows = computed(() => Array.from({ length: 3 }, (_, index) => index));
</script>

<template>
  <div class="lyric-source-selector">
    <div class="lyric-source-header">
      <div>
        <div class="lyric-source-title">切换歌词</div>
        <div class="lyric-source-subtitle">按歌名和歌手从多个渠道匹配</div>
      </div>
      <button class="lyric-source-refresh" :disabled="loading" @click="emit('refresh')">
        <i class="ri-refresh-line" :class="{ spinning: loading }"></i>
      </button>
    </div>

    <div v-if="loading && candidates.length === 0" class="lyric-source-skeleton">
      <div v-for="row in skeletonRows" :key="row" class="skeleton-row">
        <div class="skeleton-title"></div>
        <div class="skeleton-meta"></div>
      </div>
    </div>

    <div v-else-if="candidates.length > 0" class="lyric-source-list">
      <button
        v-for="candidate in candidates"
        :key="candidate.key"
        class="lyric-source-item"
        :class="{ active: candidate.key === activeKey }"
        @click="emit('select', candidate.key)"
      >
        <div class="lyric-source-main">
          <div class="lyric-source-name">
            <span class="lyric-source-badge">{{ candidate.sourceLabel }}</span>
            <span class="lyric-source-song">{{ candidate.title }}</span>
          </div>
          <div class="lyric-source-artist">{{ candidate.artist || '未知歌手' }}</div>
        </div>
        <div class="lyric-source-state">
          <span v-if="candidate.isBest" class="best-tag">推荐</span>
          <i v-if="candidate.key === activeKey" class="ri-check-line"></i>
        </div>
      </button>
    </div>

    <div v-else class="lyric-source-empty">
      <i class="ri-file-list-3-line"></i>
      <span>{{ errorMessage || '暂时没有匹配到歌词' }}</span>
      <button class="lyric-source-retry" @click="emit('refresh')">重新搜索</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lyric-source-selector {
  width: 320px;
  max-width: calc(100vw - 32px);
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, #0f172a 88%, var(--qqm-primary, #22c55e) 3%);
  color: color-mix(in srgb, #ffffff 92%, transparent);
  backdrop-filter: blur(16px) saturate(1.08);
  padding: 12px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.26);
}

.lyric-source-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 10px;
}

.lyric-source-title {
  font-size: 15px;
  font-weight: 650;
}

.lyric-source-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: color-mix(in srgb, #ffffff 58%, transparent);
}

.lyric-source-refresh,
.lyric-source-retry {
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 10%, transparent);
  color: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.lyric-source-refresh {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyric-source-refresh:hover,
.lyric-source-retry:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, transparent);
  transform: translateY(-1px);
}

.lyric-source-refresh:disabled {
  cursor: default;
  opacity: 0.7;
  transform: none;
}

.spinning {
  animation: lyric-spin 1s linear infinite;
}

.lyric-source-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.lyric-source-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
  border: 1px solid color-mix(in srgb, #ffffff 9%, transparent);
  border-radius: 12px;
  padding: 10px;
  background: color-mix(in srgb, #ffffff 6%, transparent);
  color: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.lyric-source-item:hover,
.lyric-source-item.active {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 52%, transparent);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 12%, transparent);
}

.lyric-source-main {
  min-width: 0;
}

.lyric-source-name {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.lyric-source-badge {
  flex: 0 0 auto;
  border-radius: 7px;
  padding: 2px 6px;
  font-size: 11px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 20%, transparent);
  color: color-mix(in srgb, #ffffff 88%, transparent);
}

.lyric-source-song,
.lyric-source-artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyric-source-song {
  font-size: 13px;
  font-weight: 650;
}

.lyric-source-artist {
  margin-top: 5px;
  font-size: 12px;
  color: color-mix(in srgb, #ffffff 62%, transparent);
}

.lyric-source-state {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  color: var(--qqm-primary, #22c55e);
}

.best-tag {
  border-radius: 999px;
  padding: 2px 6px;
  font-size: 11px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, transparent);
}

.lyric-source-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  border-radius: 12px;
  padding: 12px;
  background: color-mix(in srgb, #ffffff 6%, transparent);
}

.skeleton-title,
.skeleton-meta {
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, #ffffff 10%, transparent),
    color-mix(in srgb, #ffffff 22%, transparent),
    color-mix(in srgb, #ffffff 10%, transparent)
  );
  background-size: 220% 100%;
  animation: lyric-skeleton 1.15s ease-in-out infinite;
}

.skeleton-title {
  width: 72%;
  height: 14px;
}

.skeleton-meta {
  width: 46%;
  height: 10px;
  margin-top: 10px;
}

.lyric-source-empty {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: color-mix(in srgb, #ffffff 68%, transparent);
  font-size: 13px;
  text-align: center;
}

.lyric-source-empty i {
  font-size: 26px;
  opacity: 0.8;
}

.lyric-source-retry {
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 12px;
}

@keyframes lyric-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes lyric-skeleton {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
