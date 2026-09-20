import { computed, shallowRef } from 'vue';

import type { Collection,Quality, Track } from '@/services/musicApi';

export interface LocalPlaylist {
  id: string;
  title: string;
  tracks: Track[];
}
export interface DownloadRecord {
  id: string;
  track: Track;
  quality: Quality;
  path: string;
  state: 'queued' | 'downloading' | 'completed' | 'paused' | 'error';
  progress: number;
  taskId?: string;
  format?: string;
}
export const readStorage = <T>(key: string, fallback: T): T => {
  try {
    return uni.getStorageSync(`ikun:${key}`) || fallback;
  } catch {
    return fallback;
  }
};
export const writeStorage = (key: string, value: unknown) => {
  try {
    uni.setStorageSync(`ikun:${key}`, value);
  } catch {
    toast('本机空间不足，暂时无法保存，请清理一些空间。');
  }
};
export const toastMessage = shallowRef('');
let toastTimer: ReturnType<typeof setTimeout>;
export function toast(message: string) {
  clearTimeout(toastTimer);
  toastMessage.value = message;
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 3500);
}

export const favorites = shallowRef<Track[]>(readStorage('favorites', []));
export const history = shallowRef<Track[]>(readStorage('history', []));
export const playlists = shallowRef<LocalPlaylist[]>(readStorage('playlists', []));
export const downloadRecords = shallowRef<DownloadRecord[]>(readStorage('downloads', []));
export const homeCache = shallowRef<Collection[]>(readStorage('home', []));
export const favoriteIds = computed(() => new Set(favorites.value.map((song) => song.id)));
export const theme = shallowRef<'light' | 'dark'>(readStorage('theme', 'light'));
export const lyricFontSize = shallowRef<number>(readStorage('lyricFontSize', 26));
export const recentSearches = shallowRef<string[]>(readStorage('recentSearches', []));
export function rememberSearch(query: string) {
  recentSearches.value = [query, ...recentSearches.value.filter((item) => item !== query)].slice(
    0,
    8
  );
  writeStorage('recentSearches', recentSearches.value);
}
export function clearSearchHistory() {
  recentSearches.value = [];
  writeStorage('recentSearches', []);
}
export function setLyricFontSize(size: number) {
  lyricFontSize.value = size;
  writeStorage('lyricFontSize', size);
}
export function setTheme(value: 'light' | 'dark') {
  theme.value = value;
  writeStorage('theme', value);
}
export function renamePlaylist(id: string, title: string) {
  const name = title.trim().slice(0, 40);
  if (!name) return;
  playlists.value = playlists.value.map((list) =>
    list.id === id ? { ...list, title: name } : list
  );
  writeStorage('playlists', playlists.value);
}
export function removeFromPlaylist(id: string, songId: string) {
  playlists.value = playlists.value.map((list) =>
    list.id === id ? { ...list, tracks: list.tracks.filter((song) => song.id !== songId) } : list
  );
  writeStorage('playlists', playlists.value);
}

export function toggleFavorite(track: Track) {
  const liked = favoriteIds.value.has(track.id);
  favorites.value = liked
    ? favorites.value.filter((song) => song.id !== track.id)
    : [track, ...favorites.value];
  writeStorage('favorites', favorites.value);
  toast(liked ? '已从我喜欢中移除' : '已加入我喜欢');
}
export function recordPlayed(track: Track) {
  history.value = [track, ...history.value.filter((song) => song.id !== track.id)].slice(0, 100);
  writeStorage('history', history.value);
}
export function createPlaylist(title: string, tracks: Track[] = []) {
  const name = title.trim().slice(0, 40);
  if (!name) return;
  const item = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: name,
    tracks: [...new Map(tracks.map((track) => [track.id, track])).values()]
  };
  playlists.value = [item, ...playlists.value];
  writeStorage('playlists', playlists.value);
  return item;
}
export function addToPlaylist(id: string, song: Track) {
  const item = playlists.value.find((list) => list.id === id);
  if (!item || item.tracks.some((track) => track.id === song.id)) {
    toast('这首歌已经在歌单里了');
    return;
  }
  playlists.value = playlists.value.map((list) =>
    list.id === id ? { ...list, tracks: [...list.tracks, song] } : list
  );
  writeStorage('playlists', playlists.value);
  toast(`已加入「${item.title}」`);
}
export function removePlaylist(id: string) {
  playlists.value = playlists.value.filter((list) => list.id !== id);
  writeStorage('playlists', playlists.value);
}
export function updateDownload(id: string, change: Partial<DownloadRecord>) {
  downloadRecords.value = downloadRecords.value.map((record) =>
    record.id === id ? { ...record, ...change } : record
  );
  if (change.state || change.path || change.taskId)
    writeStorage('downloads', downloadRecords.value);
}
export function changeTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  writeStorage('theme', theme.value);
}
