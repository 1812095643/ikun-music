<template>
  <base-song-item
    :item="item"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
    class="standard-song-item"
    ref="baseItem"
  >
    <!-- 选择框插槽 -->
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 图片插槽 -->
    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '100y100')"
        class="song-item-img"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous'
        }"
        @load="onImageLoad"
      />
    </template>

    <!-- 内容插槽 -->
    <template #content>
      <div class="song-item-content">
        <div class="song-item-content-title">
          <n-ellipsis class="text-ellipsis" line-clamp="1" :class="{ 'text-primary': isPlaying }">{{
            item.name
          }}</n-ellipsis>
        </div>
        <div class="song-item-content-name">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
            <template v-for="(artist, index) in artists" :key="index">
              <span
                class="cursor-pointer hover:text-primary"
                @click.stop="onArtistClick(artist.id)"
                >{{ artist.name }}</span
              >
              <span v-if="index < artists.length - 1"> / </span>
            </template>
          </n-ellipsis>
        </div>
      </div>
    </template>

    <!-- 操作插槽 -->
    <template #operating>
      <div class="song-item-operating">
        <div v-if="favorite" class="song-item-operating-like">
          <i
            class="iconfont icon-likefill"
            :class="{ 'like-active': isFavorite }"
            @click.stop="onToggleFavorite"
          ></i>
        </div>
        <n-tooltip v-if="isNext" trigger="hover" :z-index="9999999" :delay="400">
          <template #trigger>
            <div class="song-item-operating-next" @click.stop="onPlayNext">
              <i class="iconfont ri-skip-forward-fill"></i>
            </div>
          </template>
          {{ t('songItem.menu.playNext') }}
        </n-tooltip>
        <div
          class="song-item-operating-play bg-neutral-100 dark:bg-neutral-900"
          :class="{ 'bg-primary': isPlaying, 'is-loading': playLoading }"
          @click="onPlayMusic"
        >
          <i v-if="isPlaying && play" class="iconfont icon-stop"></i>
          <i v-else class="iconfont icon-playfill"></i>
        </div>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis, NImage, NTooltip } from 'naive-ui';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

import BaseSongItem from './BaseSongItem.vue';

const { t } = useI18n();
const playerStore = usePlayerStore();

const props = withDefaults(
  defineProps<{
    item: SongResult;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

const emit = defineEmits(['play', 'select', 'remove-song']);
const baseItem = ref<InstanceType<typeof BaseSongItem>>();

// 从playerStore和baseItem获取响应式状态
const play = computed(() => playerStore.isPlay);
const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const playLoading = computed(() => baseItem.value?.playLoading || false);
const isFavorite = computed(() => baseItem.value?.isFavorite || false);
const artists = computed(() => baseItem.value?.artists || []);

// 包装方法，避免直接访问可能为undefined的ref
const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onToggleFavorite = (event: Event) => {
  baseItem.value?.toggleFavorite(event);
};
const onPlayMusic = () => {
  baseItem.value?.playMusicEvent(props.item);
  emit('play', props.item);
};
const onPlayNext = () => {
  baseItem.value?.handlePlayNext();
};
</script>

<style lang="scss" scoped>
.standard-song-item {
  .song-item-img {
    @apply w-12 h-12 rounded-[9px] mr-4;
  }

  .song-item-content {
    @apply flex-1;

    &-title {
      @apply text-base text-neutral-900 dark:text-neutral-100;
    }

    &-name {
      @apply text-xs text-neutral-500 dark:text-neutral-400;
    }
  }

  .song-item-operating {
    @apply flex items-center rounded-lg ml-4 border border-neutral-100 bg-white dark:border-neutral-800 dark:bg-neutral-900;

    .iconfont {
      @apply text-xl;
    }

    .icon-likefill {
      @apply text-xl transition text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200;
    }

    &-like {
      @apply mr-2 cursor-pointer ml-4 transition-colors;
    }

    &-next {
      @apply mr-2 cursor-pointer transition-colors;

      .iconfont {
        @apply text-xl transition text-neutral-500 dark:text-neutral-400;
        &:hover {
          color: var(--qqm-primary, #22c55e);
        }
      }
    }

    .like-active {
      @apply text-red-500 dark:text-red-500;
    }

    &-play {
      @apply cursor-pointer rounded-[9px] w-10 h-10 flex justify-center items-center transition
             border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100;

      &:hover,
      &.bg-primary {
        background-color: var(--qqm-primary, #22c55e);
        border-color: var(--qqm-primary, #22c55e);
        color: white;
      }
    }
  }

  .song-item-select {
    @apply mr-3 cursor-pointer;
  }
}

.is-loading {
  opacity: 0.72;
}
</style>
