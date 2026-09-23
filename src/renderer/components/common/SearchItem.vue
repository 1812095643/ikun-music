<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { IMvItem } from '@/types/mv';
import { getImgUrl } from '@/utils';

const MvPlayer = defineAsyncComponent(() => import('@/components/MvPlayer.vue'));

const props = defineProps<{
  item: {
    id: string | number;
    picUrl: string;
    name: string;
    desc: string;
    type: string;
    [key: string]: any;
  };
}>();

const showPop = ref(false);
const imageFailed = ref(false);
const cover = computed(() =>
  getImgUrl(props.item.picUrl, props.item.type === 'mv' ? '400y225' : '400y400')
);
watch(cover, () => {
  imageFailed.value = false;
});

const playerStore = usePlayerStore();
const router = useRouter();
const playHistoryStore = usePlayHistoryStore();

const getCurrentMv = () => {
  return {
    id: props.item.id,
    name: props.item.name,
    cover: props.item.picUrl,
    artistName: props.item.desc
  } as unknown as IMvItem;
};

const handleClick = async () => {
  if (props.item.type === '专辑') {
    navigateToMusicList(router, {
      id: props.item.id,
      type: 'album',
      name: props.item.name,
      listInfo: {
        ...props.item,
        coverImgUrl: props.item.picUrl
      },
      canRemove: false
    });
  } else if (props.item.type === 'playlist') {
    navigateToMusicList(router, {
      id: props.item.id,
      type: 'playlist',
      name: props.item.name,
      // 根因：YouTube Music 歌单搜索返回的是 browseId，不是网易云歌单 ID。
      // 详情页需要 source/browseId 才能走 InnerTube browse 接口，否则会误请求本地后端。
      listInfo: {
        ...props.item,
        coverImgUrl: props.item.coverImgUrl || props.item.picUrl,
        picUrl: props.item.picUrl || props.item.coverImgUrl
      },
      canRemove: false
    });
  } else if (props.item.type === 'mv') {
    handleShowMv();
  } else if (props.item.type === 'djRadio') {
    playHistoryStore.addPodcastRadio({
      id: Number(props.item.id),
      name: props.item.name,
      picUrl: props.item.picUrl,
      dj: props.item.dj,
      type: 'djRadio'
    });
    router.push({
      name: 'podcastRadio',
      params: { id: props.item.id }
    });
  } else if (props.item.type === 'artist') {
    router.push({
      name: 'artistDetail',
      params: { id: props.item.id },
      query: {
        keyword: props.item.name,
        source:
          props.item.source === 'kuwo'
            ? 'kuwo-artist-search'
            : props.item.source === 'ytmusic'
              ? 'ytmusic-artist-search'
              : 'artist-search',
        browseId: props.item.browseId
      }
    });
  }
};

const handleShowMv = async () => {
  playerStore.handlePause();
  showPop.value = true;
};
</script>

<template>
  <article
    class="search-item music-collection-card"
    :class="{ 'is-artist': item.type === 'artist' }"
  >
    <button class="search-item-open" :aria-label="`打开 ${item.name}`" @click="handleClick">
      <span class="search-item-cover" :class="{ 'is-video': item.type === 'mv' }">
        <img
          v-if="cover && !imageFailed"
          :src="cover"
          alt=""
          loading="lazy"
          @error="imageFailed = true"
        />
        <i
          v-else
          :class="item.type === 'artist' ? 'ri-user-voice-line' : 'ri-disc-line'"
          aria-hidden="true"
        />
        <span class="search-item-go"
          ><i
            aria-hidden="true"
            :class="item.type === 'mv' ? 'ri-play-fill' : 'ri-arrow-right-line'"
        /></span>
        <span v-if="item.size" class="search-item-size">{{ item.size }} 首</span>
      </span>
      <strong :title="item.name">{{ item.name }}</strong>
      <span class="search-item-description" :title="item.desc">{{ item.desc }}</span>
    </button>
    <mv-player
      v-if="item.type === 'mv'"
      v-model:show="showPop"
      :current-mv="getCurrentMv()"
      no-list
    />
  </article>
</template>

<style scoped>
.search-item {
  min-width: 0;
}
.search-item-open {
  width: 100%;
  text-align: left;
}
.search-item-cover {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 10px;
  background: var(--qqm-surface-muted);
  color: var(--qqm-muted);
}
.search-item-cover.is-video {
  aspect-ratio: 16 / 9;
}
.is-artist .search-item-cover {
  border-radius: 50%;
}
.search-item-cover > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 220ms ease;
}
.search-item-cover > i {
  font-size: 42px;
  opacity: 0.5;
}
.search-item-go {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: var(--qqm-primary);
  color: #093c25;
  border-radius: 50%;
  font-size: 19px;
  opacity: 0;
  transform: translateY(5px);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.search-item-open:hover .search-item-go,
.search-item-open:focus-visible .search-item-go {
  opacity: 1;
  transform: translateY(0);
}
.search-item-open:hover .search-item-cover > img {
  transform: scale(1.035);
}
.search-item-open strong {
  display: block;
  margin: 12px 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--qqm-text);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
}
.search-item-open:hover strong {
  color: var(--qqm-primary-strong);
}
.search-item-description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.6;
}
.search-item-size {
  position: absolute;
  top: 9px;
  right: 9px;
  padding: 2px 7px;
  border-radius: 5px;
  color: white;
  background: rgb(0 0 0 / 40%);
  font-size: 10px;
}
.search-item-open:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 5px;
  border-radius: 10px;
}
@media (prefers-reduced-motion: reduce) {
  .search-item-go,
  .search-item-cover > img {
    transition: none;
    transform: none;
  }
}
</style>
