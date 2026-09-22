<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import SongDownloadButton from '@/components/common/SongDownloadButton.vue';
import BaseSongItem from '@/components/common/songItemCom/BaseSongItem.vue';
import { useFavoriteStore } from '@/store/modules/favorite';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl, isDesktopRuntime, secondToMinute } from '@/utils';

const props = defineProps<{
  song: SongResult;
  index: number;
  selecting?: boolean;
  selected?: boolean;
  history?: boolean;
}>();
const emit = defineEmits<{
  play: [song: SongResult];
  select: [id: string | number];
  remove: [song: SongResult];
}>();
const base = shallowRef<InstanceType<typeof BaseSongItem>>();
const favorite = useFavoriteStore();
const player = usePlayerStore();
const failed = shallowRef(false);
const cover = computed(() => getImgUrl(props.song.picUrl || props.song.al?.picUrl, '100y100'));
const artist = computed(
  () =>
    (props.song.ar || props.song.artists || []).map((item) => item.name).join(' / ') || '未知歌手'
);
const album = computed(() => props.song.al?.name || props.song.album?.name || '—');
const playing = computed(() => String(player.playMusic?.id) === String(props.song.id));
watch(cover, () => {
  failed.value = false;
});
function toggleFavorite() {
  if (favorite.isFavorite(props.song.id)) void favorite.removeFromFavorite(props.song.id);
  else void favorite.addToFavorite(props.song.id);
}
</script>

<template>
  <base-song-item
    ref="base"
    :item="song"
    is-next
    class="library-song-row library-columns"
    :class="{ 'is-current': playing, 'is-selected': selected }"
    @play="emit('play', song)"
  >
    <template #index>
      <div class="song-position">
        <input
          v-if="selecting"
          type="checkbox"
          :checked="selected"
          :aria-label="`选择 ${song.name}`"
          @change="emit('select', song.id)"
        />
        <template v-else
          ><span class="song-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <button
            class="position-play"
            :aria-label="`${playing && player.isPlay ? '暂停' : '播放'} ${song.name}`"
            @click.stop="emit('play', song)"
          >
            <i :class="playing && player.isPlay ? 'ri-pause-fill' : 'ri-play-fill'" /></button
        ></template>
      </div>
    </template>
    <template #content>
      <div class="library-song-name">
        <button
          class="song-cover"
          :aria-label="`播放 ${song.name}`"
          @click.stop="emit('play', song)"
        >
          <img
            v-if="cover && !failed"
            :src="cover"
            alt=""
            loading="lazy"
            @error="failed = true"
          /><i v-else class="ri-music-2-line" aria-hidden="true" />
        </button>
        <div class="song-label">
          <button class="song-title" :title="song.name" @click.stop="emit('play', song)">
            {{ song.name }}</button
          ><span class="mobile-artist">{{ artist }}</span>
        </div>
      </div>
      <span class="song-artist" :title="artist">{{ artist }}</span>
      <span class="song-album" :title="album">{{ album }}</span>
      <span class="song-duration">{{
        song.dt || song.duration ? secondToMinute((song.dt || song.duration || 0) / 1000) : '—'
      }}</span>
    </template>
    <template #operating>
      <div class="library-song-actions">
        <button
          :class="{ liked: favorite.isFavorite(song.id) }"
          :aria-label="`${favorite.isFavorite(song.id) ? '取消收藏' : '收藏'} ${song.name}`"
          @click.stop="toggleFavorite"
        >
          <i :class="favorite.isFavorite(song.id) ? 'ri-heart-fill' : 'ri-heart-line'" />
        </button>
        <song-download-button v-if="isDesktopRuntime" :item="song" size="small" />
        <button
          v-if="history"
          :aria-label="`移除播放记录 ${song.name}`"
          @click.stop="emit('remove', song)"
        >
          <i class="ri-delete-bin-6-line" />
        </button>
        <button v-else :aria-label="`下一首播放 ${song.name}`" @click.stop="base?.handlePlayNext()">
          <i class="ri-play-list-add-line" />
        </button>
        <button
          v-if="isDesktopRuntime"
          :aria-label="`${song.name} 的更多操作`"
          @click.stop="base?.handleMenuClick($event)"
        >
          <i class="ri-more-line" />
        </button>
      </div>
    </template>
  </base-song-item>
</template>

<style scoped>
.library-song-row {
  padding: 9px 12px !important;
  min-height: 64px;
  border-radius: 8px;
  color: var(--qqm-text);
}
.library-song-row::before {
  display: none;
}
.library-song-row:hover,
.library-song-row:focus-within {
  background: var(--qqm-surface-muted);
}
.library-song-row.is-current {
  color: var(--qqm-primary-strong);
}
.library-song-row.is-selected {
  background: var(--qqm-primary-soft);
}
.song-position {
  position: relative;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--qqm-muted);
}
.song-position input {
  accent-color: var(--qqm-primary-strong);
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.position-play {
  position: absolute;
  inset: -9px 0;
  background: transparent;
  opacity: 0;
  font-size: 21px;
  color: var(--qqm-primary-strong);
}
.library-song-row:hover .position-play,
.library-song-row:focus-within .position-play,
.is-current .position-play {
  opacity: 1;
}
.library-song-row:hover .song-number,
.library-song-row:focus-within .song-number,
.is-current .song-number {
  opacity: 0;
}
.library-song-name {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}
.song-cover {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--qqm-surface-muted);
  display: grid;
  place-items: center;
  color: var(--qqm-muted);
  font-size: 21px;
}
.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.song-label {
  min-width: 0;
}
.song-title {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 14px;
  font-weight: 500;
}
.song-title:hover {
  color: var(--qqm-primary-strong);
}
.song-artist,
.song-album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--qqm-muted);
  font-size: 12px;
}
.song-duration {
  color: var(--qqm-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.library-song-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 5px;
}
.library-song-actions > button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  color: var(--qqm-muted);
  font-size: 17px;
  border-radius: 6px;
}
.library-song-actions > button:hover {
  background: var(--qqm-primary-soft);
  color: var(--qqm-primary-strong);
}
.library-song-actions .liked {
  color: #e66a7b;
}
.library-song-actions > :not(:first-child) {
  opacity: 0;
}
.library-song-row:hover .library-song-actions > *,
.library-song-row:focus-within .library-song-actions > * {
  opacity: 1;
}
.mobile-artist {
  display: none;
}
@media (max-width: 1000px) {
  .song-album {
    display: none;
  }
}
@media (max-width: 720px) {
  .song-artist {
    display: none;
  }
  .mobile-artist {
    display: block;
    color: var(--qqm-muted);
    font-size: 11px;
    margin-top: 3px;
  }
  .library-song-actions > :not(:first-child) {
    display: none;
  }
}
@media (hover: none) {
  .library-song-actions > :not(:first-child) {
    opacity: 1;
  }
}
</style>
