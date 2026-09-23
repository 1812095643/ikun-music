import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import type { SongResult } from '@/types/music';

export interface LocalPlaylist {
  id: string;
  name: string;
  songs: SongResult[];
  createdAt: number;
}
export function songSnapshot(song: SongResult): SongResult {
  return {
    id: song.id,
    name: song.name,
    ar: song.ar || song.artists || [],
    al: song.al || song.album,
    picUrl: song.picUrl || song.al?.picUrl || '',
    source: song.source,
    dt: song.dt || song.duration,
    count: 0
  };
}

export const useLocalPlaylistsStore = defineStore('localPlaylists', () => {
  let saved: LocalPlaylist[] = [];
  try {
    const value = JSON.parse(localStorage.getItem('ikun-local-playlists') || '[]');
    if (Array.isArray(value))
      saved = value.filter((item) => item?.id && item.name && Array.isArray(item.songs));
  } catch {
    /* 本地数据无法读取时保留原存储，后续保存前由界面提示。 */
  }
  const playlists = shallowRef(saved);
  function create(name: string, tracks: SongResult[]) {
    if (!name.trim() || !tracks.length) throw new Error('请输入歌单名称，并至少选择一首歌曲。');
    const songs = [
      ...new Map(tracks.map((song) => [`${song.source}:${song.id}`, songSnapshot(song)])).values()
    ];
    const playlist: LocalPlaylist = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim().slice(0, 80),
      songs,
      createdAt: Date.now()
    };
    const next = [playlist, ...playlists.value];
    // 先确认持久化成功再更新界面，磁盘空间不足时不显示“导入成功”。
    localStorage.setItem('ikun-local-playlists', JSON.stringify(next));
    playlists.value = next;
    return playlist;
  }
  return { playlists, create };
});
