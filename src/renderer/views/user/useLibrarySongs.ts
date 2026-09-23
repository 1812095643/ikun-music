import { computed, shallowRef, watch } from 'vue';

import { getMusicDetail } from '@/api/music';
import { useFavoriteStore } from '@/store/modules/favorite';
import { useLocalPlaylistsStore } from '@/store/modules/localPlaylists';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import type { SongResult } from '@/types/music';
import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

export function useLibrarySongs() {
  const player = usePlayerStore();
  const history = usePlayHistoryStore();
  const favorite = useFavoriteStore();
  const local = useLocalPlaylistsStore();
  const saved = getLocalStorageItem<SongResult[]>('favoriteSongSnapshots', []);
  const details = shallowRef(
    new Map<string, SongResult>(
      (Array.isArray(saved) ? saved : [])
        .filter((song) => song?.id != null && song?.name)
        .map((song) => [String(song.id), song])
    )
  );
  const loading = shallowRef(false);
  let revision = 0;
  const available = computed(() => {
    const values = new Map(details.value);
    for (const song of [
      ...local.playlists.flatMap((list) => list.songs),
      ...favorite.importedSnapshots,
      ...player.playList,
      ...history.musicHistory
    ]) {
      if (song?.name) values.set(String(song.id), song);
    }
    if (player.playMusic?.name) values.set(String(player.playMusic.id), player.playMusic);
    return values;
  });
  const favorites = computed(() =>
    player.favoriteList
      .map((id) => available.value.get(String(id)))
      .filter((song): song is SongResult => Boolean(song))
      .reverse()
  );
  const missingCount = computed(() => player.favoriteList.length - favorites.value.length);

  async function refresh() {
    const version = ++revision;
    // 收藏与历史共用元数据，但不能共用记录的生命周期；删除历史后收藏仍保留已加载的信息。
    details.value = new Map(available.value);
    const missing = player.favoriteList.filter(
      (id) => !available.value.has(String(id)) && Number.isFinite(Number(id))
    );
    loading.value = missing.length > 0;
    try {
      // 播放历史已有完整元数据，先直接显示；只补齐缺失收藏，避免每次切页重新请求全部歌曲。
      for (let offset = 0; offset < missing.length; offset += 100) {
        const response = await getMusicDetail(missing.slice(offset, offset + 100).map(Number));
        if (version !== revision) return;
        const next = new Map(details.value);
        for (const song of (response.data?.songs || []) as SongResult[]) {
          next.set(String(song.id), { ...song, picUrl: song.picUrl || song.al?.picUrl || '' });
        }
        details.value = next;
      }
    } catch {
      // 保留已有内容和收藏 ID，通过缺失数量与重试按钮提示，不把网络问题显示成空收藏。
    } finally {
      if (version === revision) loading.value = false;
    }
  }
  watch(() => [...player.favoriteList], refresh, { immediate: true });
  watch(
    favorites,
    (songs) => {
      const next = new Map(details.value);
      let changed = false;
      for (const song of songs) {
        if (next.get(String(song.id)) !== song) {
          next.set(String(song.id), song);
          changed = true;
        }
      }
      if (changed) details.value = next;
      // 旧版本只保存 ID，清理历史后容易丢失歌名和音源身份；独立保存精简元数据，不保存临时在线地址或歌词。
      setLocalStorageItem(
        'favoriteSongSnapshots',
        songs.map((song) => ({
          id: song.id,
          name: song.name,
          picUrl: song.picUrl,
          ar: song.ar,
          al: song.al,
          source: song.source,
          duration: song.duration,
          dt: song.dt,
          count: 0,
          localFilePath: song.localFilePath,
          lyricPath: song.lyricPath,
          onlineId: song.onlineId,
          playMusicUrl: song.playMusicUrl?.startsWith('local://') ? song.playMusicUrl : undefined,
          isPodcast: song.isPodcast
        }))
      );
    },
    { immediate: true }
  );
  return { favorites, loading, missingCount, refresh };
}
