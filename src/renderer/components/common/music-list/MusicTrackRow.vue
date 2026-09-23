<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import SongDownloadButton from '@/components/common/SongDownloadButton.vue';
import BaseSongItem from '@/components/common/songItemCom/BaseSongItem.vue';
import { useFavoriteStore } from '@/store/modules/favorite';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { getImgUrl, isDesktopRuntime, secondToMinute } from '@/utils';

import { getTrackKey } from './useMusicList';

const props = defineProps<{
  song: SongResult;
  index: number;
  selecting?: boolean;
  selected?: boolean;
  history?: boolean;
  canRemove?: boolean;
  compact?: boolean;
  local?: boolean;
}>();
const emit = defineEmits<{
  play: [song: SongResult];
  select: [song: SongResult];
  remove: [song: SongResult];
}>();
const base = shallowRef<InstanceType<typeof BaseSongItem>>();
const favorite = useFavoriteStore();
const player = usePlayerStore();
const router = useRouter();
const failed = shallowRef(false);
const cover = computed(() => getImgUrl(props.song.picUrl || props.song.al?.picUrl, '100y100'));
const artist = computed(
  () =>
    (props.song.ar || props.song.artists || []).map((item) => item.name).join(' / ') || '未知歌手'
);
const album = computed(() => props.song.al?.name || props.song.album?.name || '—');
const playing = computed(() => getTrackKey(player.playMusic) === getTrackKey(props.song));
const loading = computed(() => playing.value && player.playMusic.playLoading);
const playLabel = computed(
  () =>
    `${loading.value ? '取消加载' : playing.value && player.isPlay ? '暂停' : '播放'} ${props.song.name}`
);
const artists = computed(() => props.song.ar || props.song.artists || []);
watch(cover, () => {
  failed.value = false;
});
function toggleFavorite() {
  if (favorite.isFavorite(props.song.id)) void favorite.removeFromFavorite(props.song.id);
  else void favorite.addToFavorite(props.song.id);
}
function openArtist(id: number, name: string) {
  if (props.local || (props.song.source && props.song.source !== 'netease')) {
    void router.push({
      name: 'artistDetail',
      params: { id: id || 0 },
      query: {
        keyword: name,
        source: props.song.source === 'kuwo' ? 'kuwo-artist-search' : 'artist-search'
      }
    });
  } else if (id) {
    void router.push({ name: 'artistDetail', params: { id } });
  }
}
function requestPlay(event?: MouseEvent) {
  if (event instanceof MouseEvent && event.detail > 1) return;
  if (props.selecting) emit('select', props.song);
  else emit('play', props.song);
}
</script>

<template>
  <base-song-item
    ref="base"
    :item="song"
    is-next
    class="library-song-row music-track-row music-track-columns"
    :class="{ 'is-current': playing, 'is-selected': selected, 'is-compact': compact }"
    :data-track-key="getTrackKey(song)"
    :aria-current="playing ? 'true' : undefined"
    :can-remove="canRemove"
    @play="requestPlay()"
    @remove-song="emit('remove', song)"
  >
    <template #index>
      <div class="song-position">
        <input
          v-if="selecting"
          type="checkbox"
          :checked="selected"
          :aria-label="`选择 ${song.name}`"
          @change="emit('select', song)"
        />
        <template v-else
          ><span class="song-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <button
            class="position-play"
            :aria-label="playLabel"
            :title="playLabel"
            @click.stop="requestPlay"
            @dblclick.stop
          >
            <i
              aria-hidden="true"
              :class="
                loading
                  ? 'ri-loader-4-line track-spinner'
                  : playing && player.isPlay
                    ? 'ri-pause-fill'
                    : 'ri-play-fill'
              "
            /></button
        ></template>
      </div>
    </template>
    <template #content>
      <div class="library-song-name">
        <button
          class="song-cover"
          :aria-label="selecting ? `选择 ${song.name}` : playLabel"
          @click.stop="requestPlay"
          @dblclick.stop
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
          <button class="song-title" :title="song.name" @click.stop="requestPlay" @dblclick.stop>
            {{ song.name }}</button
          ><span class="mobile-artist">{{ artist }}</span>
        </div>
      </div>
      <span class="song-artist music-track-artist" :title="artist">
        <template v-for="(item, artistIndex) in artists" :key="`${item.id}-${artistIndex}`">
          <span v-if="artistIndex"> / </span
          ><button @click.stop="openArtist(item.id, item.name)" @dblclick.stop>
            {{ item.name }}
          </button>
        </template>
        <template v-if="!artists.length">未知歌手</template>
      </span>
      <span class="song-album music-track-album" :title="album">{{ album }}</span>
      <span class="song-duration">{{
        song.dt || song.duration ? secondToMinute((song.dt || song.duration || 0) / 1000) : '—'
      }}</span>
    </template>
    <template #operating>
      <div class="library-song-actions" @dblclick.stop>
        <button
          :class="{ liked: favorite.isFavorite(song.id) }"
          :aria-pressed="favorite.isFavorite(song.id)"
          :title="favorite.isFavorite(song.id) ? '取消收藏' : '收藏'"
          :aria-label="`${favorite.isFavorite(song.id) ? '取消收藏' : '收藏'} ${song.name}`"
          @click.stop="toggleFavorite"
        >
          <i
            aria-hidden="true"
            :class="favorite.isFavorite(song.id) ? 'ri-heart-fill' : 'ri-heart-line'"
          />
        </button>
        <song-download-button
          v-if="isDesktopRuntime && !local"
          :item="song"
          size="small"
          :title="`下载 ${song.name}`"
        />
        <button
          v-if="history"
          title="移除播放记录"
          :aria-label="`移除播放记录 ${song.name}`"
          @click.stop="emit('remove', song)"
        >
          <i aria-hidden="true" class="ri-delete-bin-6-line" />
        </button>
        <button
          v-else
          title="下一首播放"
          :aria-label="`下一首播放 ${song.name}`"
          @click.stop="base?.handlePlayNext()"
        >
          <i aria-hidden="true" class="ri-play-list-add-line" />
        </button>
        <button
          v-if="isDesktopRuntime"
          title="更多操作"
          :aria-label="`${song.name} 的更多操作`"
          @click.stop="base?.handleMenuClick($event)"
        >
          <i aria-hidden="true" class="ri-more-line" />
        </button>
      </div>
    </template>
  </base-song-item>
</template>

<style scoped>
.library-song-row {
  display: grid;
  padding: 9px 12px !important;
  min-height: 64px;
  border-radius: 8px;
  color: var(--qqm-text);
}
.library-song-row.is-compact {
  min-height: 50px;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
.is-compact .song-cover {
  width: 34px;
  height: 34px;
  border-radius: 5px;
}
.is-compact .song-title {
  font-size: 13px;
}
.song-artist button:hover {
  color: var(--qqm-primary-strong);
}
.library-song-actions :deep(.song-download-button) {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  transform: none;
}
.track-spinner {
  display: inline-block;
  animation: track-spin 1s linear infinite;
}
@keyframes track-spin {
  to {
    transform: rotate(360deg);
  }
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
@container music-tracks (max-width: 900px) {
  .song-album {
    display: none;
  }
}
@container music-tracks (max-width: 630px) {
  .song-artist {
    display: none;
  }
  .mobile-artist {
    display: block;
    color: var(--qqm-muted);
    font-size: 11px;
    margin-top: 3px;
  }
  .library-song-actions > :not(:first-child):not(:last-child) {
    display: none;
  }
  .library-song-actions > * {
    opacity: 1;
  }
}
@media (hover: none) {
  .library-song-actions > :not(:first-child) {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .track-spinner {
    animation: none;
  }
}
</style>
