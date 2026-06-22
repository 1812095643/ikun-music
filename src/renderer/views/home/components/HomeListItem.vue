<template>
  <div class="home-list-card group cursor-pointer" @click="$emit('click')">
    <!-- Cover -->
    <div
      class="home-list-cover relative aspect-square overflow-hidden rounded-lg transition-colors duration-200 ease-out"
    >
      <img
        v-if="coverUrl && !imageFailed"
        :src="coverUrl"
        class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
        loading="lazy"
        alt=""
        @error="handleImageError"
      />

      <div
        v-else
        class="home-list-cover-fallback absolute inset-0 flex flex-col items-center justify-center gap-2"
      >
        <i class="ri-music-2-line text-3xl text-primary/70" />
        <span
          class="text-xs font-medium tracking-[0.18em] text-neutral-500/80 dark:text-neutral-300/70"
        >
          暂无封面
        </span>
      </div>

      <!-- Hover Overlay with Song Preview -->
      <div
        v-if="showHoverTracks"
        class="home-list-overlay absolute inset-0 flex items-end opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
      >
        <!-- Song Preview + Play Button Container -->
        <div class="flex w-full items-end justify-between gap-3 p-4">
          <!-- Song List -->
          <div class="min-w-0 flex-1 space-y-1.5 transition-opacity duration-200 ease-out">
            <div
              v-for="(track, idx) in displayTracks"
              :key="idx"
              class="flex items-center gap-2.5 text-white/95 drop-shadow-sm"
            >
              <span class="w-5 flex-shrink-0 text-center text-xs font-bold text-white/45">{{
                idx + 1
              }}</span>
              <span class="truncate text-[13px] font-semibold tracking-wide">{{ track.name }}</span>
            </div>
            <div v-if="tracks.length === 0" class="py-4 text-center text-xs text-white/50">
              {{ t('comp.homeListItem.loading') }}
            </div>
          </div>

          <!-- Play Button -->
          <button
            class="home-list-play flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] transition-all duration-200 ease-out"
            :class="{ 'is-loading': playing }"
            :disabled="playing"
            @click.stop="handlePlayClick"
          >
            <i v-if="playing" class="ri-loader-4-line text-lg" />
            <i v-else class="ri-play-fill ml-0.5 text-lg" />
          </button>
        </div>
      </div>

      <!-- Badge -->
      <div
        v-if="badge"
        class="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
        :class="badgeClass"
      >
        {{ badge }}
      </div>

      <!-- Play Count (for playlists) -->
      <div
        v-if="playCount"
        class="qqm-cover-badge absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
      >
        <i class="ri-play-fill text-[10px]" />
        <span>{{ formatNumber(playCount) }}</span>
      </div>
    </div>

    <!-- Info -->
    <div class="home-list-info mt-3 flex min-h-[70px] flex-col px-0.5">
      <div
        class="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span class="tracking-[0.16em]">精选歌单</span>
      </div>
      <h3
        class="home-list-title text-[15px] font-semibold leading-[1.38] tracking-[-0.01em] text-neutral-900 transition-colors duration-200 group-hover:text-primary dark:text-neutral-50 dark:group-hover:text-white"
      >
        {{ title }}
      </h3>
      <p
        v-if="subtitle"
        class="home-list-subtitle mt-1.5 text-[12px] font-medium leading-[1.45] text-neutral-500 transition-colors duration-200 group-hover:text-neutral-600 dark:text-neutral-400 dark:group-hover:text-neutral-300"
      >
        {{ subtitle }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatNumber, getImgUrl } from '@/utils';

interface Track {
  id: number;
  name: string;
}

const props = withDefaults(
  defineProps<{
    cover: string;
    title: string;
    subtitle?: string;
    tracks?: Track[];
    badge?: string;
    badgeType?: 'new' | 'hot' | 'recommend';
    playCount?: number;
    showHoverTracks?: boolean;
    playing?: boolean;
  }>(),
  {
    tracks: () => [],
    showHoverTracks: true,
    playing: false
  }
);

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'play'): void;
}>();

const { t } = useI18n();
const imageFailed = shallowRef(false);

const coverUrl = computed(() => getImgUrl(props.cover, '512y512'));

watch(
  () => props.cover,
  () => {
    imageFailed.value = false;
  }
);

const displayTracks = computed(() => props.tracks.slice(0, 3));

const handleImageError = () => {
  imageFailed.value = true;
};

const badgeClass = computed(() => {
  switch (props.badgeType) {
    case 'new':
      return 'bg-primary/90';
    case 'hot':
      return 'bg-primary/90';
    case 'recommend':
      return 'bg-primary/90';
    default:
      return 'bg-primary/90';
  }
});

const handlePlayClick = () => {
  if (props.playing) return;
  emit('play');
};
</script>

<style scoped>
.home-list-card {
  animation: itemFadeIn 0.5s ease-out backwards;
}

@keyframes itemFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.home-list-cover {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
  box-shadow: 0 12px 28px color-mix(in srgb, #0f172a 8%, transparent);
}

.home-list-card:hover .home-list-cover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.home-list-cover-fallback {
  background:
    radial-gradient(
      circle at 28% 18%,
      color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, transparent),
      transparent 34%
    ),
    linear-gradient(
      145deg,
      var(--qqm-surface-2, #f6f7f8),
      color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #ffffff))
    );
}

.home-list-overlay {
  /* 图片加载很多时不再逐张取色，避免主线程被 Canvas 与动态 import 占用导致按钮响应慢。 */
  background: linear-gradient(
    to top,
    rgba(10, 14, 20, 0.92) 0%,
    rgba(10, 14, 20, 0.58) 56%,
    rgba(10, 14, 20, 0.08) 100%
  );
}

.home-list-title,
.home-list-subtitle {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.home-list-title {
  -webkit-line-clamp: 2;
}

.home-list-subtitle {
  -webkit-line-clamp: 1;
}

.home-list-play {
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 68%, #fff 32%);
  background: color-mix(in srgb, var(--qqm-surface, #fff) 90%, transparent);
  color: var(--qqm-text, #1f2329);
}

.home-list-play:hover {
  color: var(--qqm-primary, #22c55e);
  transform: translateY(-1px) scale(1.04);
}

.home-list-play:disabled {
  cursor: wait;
  opacity: 0.88;
}

.home-list-play.is-loading i {
  animation: playLoadingRotate 0.9s linear infinite;
}

.qqm-cover-badge {
  border: 1px solid color-mix(in srgb, #ffffff 14%, transparent);
  background: color-mix(in srgb, #0f172a 42%, transparent);
  backdrop-filter: blur(8px) saturate(1.06);
}

@keyframes playLoadingRotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
