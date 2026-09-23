import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getSearch } from '@/api/search';
import { getTrackKey } from '@/components/common/music-list/useMusicList';
import { SEARCH_TYPE, SEARCH_TYPES } from '@/const/bar-const';
import { useSearchStore } from '@/store/modules/search';
import type { SongResult } from '@/types/music';

type SearchItem = {
  id: string | number;
  name: string;
  picUrl: string;
  type: string;
  desc: string;
  [key: string]: any;
};
type SearchResults = { songs: SongResult[]; items: SearchItem[] };

function formatSong(item: any): SongResult {
  const artists = item.ar || item.artists || item.song?.artists || [];
  const rawAlbum = item.al || item.album || item.song?.al || item.song?.album;
  const album =
    rawAlbum && typeof rawAlbum === 'object'
      ? rawAlbum
      : { id: 0, name: typeof rawAlbum === 'string' ? rawAlbum : '' };
  const picUrl =
    item.picUrl ||
    item.cover ||
    item.albumpic ||
    album.picUrl ||
    (typeof album.pic === 'string' ? album.pic : '') ||
    item.song?.picUrl ||
    item.song?.album?.picUrl ||
    '';
  return {
    ...item,
    ar: artists,
    artists,
    al: album,
    album,
    picUrl,
    song: { ...item.song, artists, name: item.name, id: item.id },
    source: item.source || 'netease'
  };
}

export function useMusicSearch() {
  const route = useRoute();
  const router = useRouter();
  const searchStore = useSearchStore();
  const keyword = computed(() => String(route.query.keyword || route.query.keywords || '').trim());
  const searchType = computed(() => Number(route.query.type || searchStore.searchType));
  const result = shallowRef<SearchResults>({ songs: [], items: [] });
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const hasMore = shallowRef(false);
  const error = shallowRef('');
  const page = shallowRef(0);
  const total = shallowRef(0);
  let version = 0;
  const pageSize = 30;

  async function load(more = false) {
    if (more && (loading.value || loadingMore.value || !hasMore.value)) return;
    if (!more) {
      version++;
      page.value = 0;
      total.value = 0;
      result.value = { songs: [], items: [] };
      hasMore.value = false;
      loading.value = Boolean(keyword.value);
      loadingMore.value = false;
    } else loadingMore.value = true;
    error.value = '';
    if (!keyword.value) return;
    const requestVersion = version;
    const type = searchType.value;
    try {
      const { data } = await getSearch({
        keywords: keyword.value,
        type,
        limit: pageSize,
        offset: page.value * pageSize
      });
      if (requestVersion !== version) return;
      if (!data?.result || (data.code && data.code !== 200)) throw new Error('没有收到搜索结果');
      const body = data.result;
      const songs = (body.songs || []).map(formatSong) as SongResult[];
      let items: SearchItem[] = [];
      if (type === SEARCH_TYPE.ARTIST)
        items = (body.artists || []).map((item: any) => ({
          ...item,
          id: item.id || item.userId || 0,
          name: item.name || item.nickname || '未知歌手',
          picUrl: item.picUrl || item.cover || item.avatar || item.img1v1Url || '',
          desc:
            item.briefDesc ||
            [
              item.musicSize ? `${item.musicSize} 首单曲` : '',
              item.albumSize ? `${item.albumSize} 张专辑` : ''
            ]
              .filter(Boolean)
              .join(' · '),
          type: 'artist',
          source: item.source || 'netease'
        }));
      else if (type === SEARCH_TYPE.ALBUM)
        items = (body.albums || []).map((item: any) => ({
          ...item,
          type: '专辑',
          picUrl: item.picUrl || item.coverImgUrl || '',
          desc: [item.artist?.name, item.company].filter(Boolean).join(' · ')
        }));
      else if (type === SEARCH_TYPE.PLAYLIST)
        items = (body.playlists || []).map((item: any) => ({
          ...item,
          picUrl: item.coverImgUrl || item.picUrl || '',
          desc: [item.trackCount ? `${item.trackCount} 首` : '', item.creator?.nickname]
            .filter(Boolean)
            .join(' · '),
          type: 'playlist'
        }));
      else if (type === SEARCH_TYPE.MV)
        items = (body.mvs || []).map((item: any) => ({
          ...item,
          picUrl: item.cover || item.picUrl || '',
          desc: (item.artists || []).map((artist: any) => artist.name).join(' / '),
          type: 'mv'
        }));
      else
        items = (body.djRadios || []).map((item: any) => ({
          ...item,
          picUrl: item.picUrl || '',
          desc: item.dj?.nickname || '',
          type: 'djRadio'
        }));
      const existing = new Set(
        type === SEARCH_TYPE.MUSIC
          ? result.value.songs.map(getTrackKey)
          : result.value.items.map((item) => `${item.source || 'netease'}:${item.id}`)
      );
      const nextSongs = songs.filter((song) => {
        const key = getTrackKey(song);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      const nextItems = items.filter((item) => {
        const key = `${item.source || 'netease'}:${item.id}`;
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      result.value = {
        songs: [...result.value.songs, ...nextSongs],
        items: [...result.value.items, ...nextItems]
      };
      const countFields: Record<number, string> = {
        1: 'songCount',
        100: 'artistCount',
        10: 'albumCount',
        1000: 'playlistCount',
        1004: 'mvCount',
        1009: 'djRadiosCount'
      };
      const reportedCount = Number(body[countFields[type]]);
      total.value = Number.isFinite(reportedCount) ? reportedCount : 0;
      const rawCount = type === SEARCH_TYPE.MUSIC ? songs.length : items.length;
      const addedCount = type === SEARCH_TYPE.MUSIC ? nextSongs.length : nextItems.length;
      hasMore.value =
        rawCount === pageSize &&
        addedCount > 0 &&
        (!total.value || (page.value + 1) * pageSize < total.value);
      page.value++;
    } catch (cause) {
      if (requestVersion !== version) return;
      console.warn('搜索结果暂未加载：', cause);
      error.value = more
        ? '后续结果暂未加载，已显示的音乐可以继续使用。'
        : '请检查网络连接后重试，或换一个关键词。';
    } finally {
      if (requestVersion === version) {
        loading.value = false;
        loadingMore.value = false;
      }
    }
  }
  function changeType(type: number) {
    if (type === searchType.value) return;
    searchStore.searchType = type;
    void router.replace({ path: '/search-result', query: { ...route.query, type } });
  }
  watch(
    () => [route.query.keyword, route.query.keywords, route.query.type],
    () => {
      if (route.name !== 'searchResult') return;
      const type = Number(route.query.type || searchStore.searchType);
      searchStore.searchType = SEARCH_TYPES.some((item) => item.key === type)
        ? type
        : SEARCH_TYPE.MUSIC;
      void load();
    },
    { immediate: true }
  );
  onScopeDispose(() => {
    version++;
  });
  return {
    keyword,
    searchType,
    result,
    loading,
    loadingMore,
    hasMore,
    error,
    total,
    load,
    changeType
  };
}
