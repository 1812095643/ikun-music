import { shallowRef } from 'vue';

import {
  type Artist,
  type Collection,
  createCancellation,
  findArtist,
  isCanceled,
  loadCollection,
  loadHome,
  loadRanks,
  searchTracks,
  type Track} from '@/services/musicApi';

import { homeCache, readStorage,rememberSearch, writeStorage } from './library';

export const activeTab = shallowRef<'discover' | 'search' | 'playlists' | 'library'>('discover');
export const secondaryPage = shallowRef<
  'settings' | 'downloads' | 'transfer' | 'local' | 'import' | null
>(null);
export const discoverCategory = shallowRef<'recommend' | 'ranks' | 'artists'>('recommend');
export const rankings = shallowRef<Collection[]>(readStorage('rankings', []));
export const ranksLoading = shallowRef(false);
export const ranksError = shallowRef('');
export const spotlightSongs = shallowRef<Track[]>(readStorage('spotlightSongs', []));
export const artists = shallowRef<Artist[]>(readStorage('artists', []));
export const artistsLoading = shallowRef(false);
export const artistsError = shallowRef('');
export async function refreshRanks() {
  if (ranksLoading.value) return;
  ranksLoading.value = true;
  ranksError.value = '';
  try {
    rankings.value = await loadRanks();
    writeStorage('rankings', rankings.value);
  } catch {
    ranksError.value = '排行榜暂未更新，可以稍后重试。';
  } finally {
    ranksLoading.value = false;
  }
}
export async function refreshArtists() {
  if (artistsLoading.value) return;
  artistsLoading.value = true;
  artistsError.value = '';
  const result = await Promise.allSettled(
    ['孙燕姿', '周杰伦', '陈奕迅', '林俊杰', '王菲', '许嵩'].map(findArtist)
  );
  const values = result.flatMap((item) =>
    item.status === 'fulfilled' && item.value ? [item.value] : []
  );
  if (values.length) {
    artists.value = values;
    writeStorage('artists', values);
  } else artistsError.value = '歌手图片暂未加载好，仍可直接搜索歌手。';
  artistsLoading.value = false;
}
export function showCategory(category: typeof discoverCategory.value) {
  activeTab.value = 'discover';
  discoverCategory.value = category;
  closeCollection();
  secondaryPage.value = null;
  if (category === 'ranks' && !rankings.value.length) void refreshRanks();
  if (category === 'artists' && !artists.value.length) void refreshArtists();
}
export function enterSearch() {
  activeTab.value = 'search';
  closeCollection();
  secondaryPage.value = null;
}
export const homeLoading = shallowRef(false);
export const homeError = shallowRef('');
export const searchQuery = shallowRef('');
export const submittedQuery = shallowRef('');
export const searchResults = shallowRef<Track[]>([]);
export const searchLoading = shallowRef(false);
export const searchError = shallowRef('');
export const searchTotal = shallowRef(0);
export const searched = shallowRef(false);
export const selectedCollection = shallowRef<Collection | null>(null);
export const collectionSongs = shallowRef<Track[]>([]);
export const collectionLoading = shallowRef(false);
export const collectionError = shallowRef('');
let searchVersion = 0;
let searchOffset = 0;
let collectionVersion = 0;
let searchCancellation: ReturnType<typeof createCancellation> | undefined;

export async function refreshHome() {
  if (homeLoading.value) return;
  homeLoading.value = true;
  homeError.value = '';
  try {
    const result = await loadHome();
    if (!result.length) throw new Error();
    homeCache.value = result;
    writeStorage('home', result);
    void loadCollection(result[0].id)
      .then((songs) => {
        spotlightSongs.value = songs.slice(0, 12);
        writeStorage('spotlightSongs', spotlightSongs.value);
      })
      .catch(() => {});
  } catch {
    homeError.value = '推荐暂时没有加载好，试试搜索喜欢的歌。';
  } finally {
    homeLoading.value = false;
  }
}
export async function search(query = searchQuery.value, append = false) {
  if (query.trim() !== submittedQuery.value) append = false;
  if (append && (searchLoading.value || searchResults.value.length >= searchTotal.value)) return;
  const normalized = query.trim();
  if (!normalized) return;
  activeTab.value = 'search';
  secondaryPage.value = null;
  selectedCollection.value = null;
  searchQuery.value = normalized;
  submittedQuery.value = normalized;
  searchCancellation?.abort();
  const cancellation = createCancellation();
  searchCancellation = cancellation;
  const version = ++searchVersion;
  searchLoading.value = true;
  searchError.value = '';
  searched.value = true;
  if (!append) {
    searchResults.value = [];
    searchOffset = 0;
  }
  if (!append) rememberSearch(normalized);
  try {
    const result = await searchTracks(normalized, searchOffset, cancellation.signal);
    if (version !== searchVersion) return;
    searchOffset += result.songs.length;
    const all = append ? [...searchResults.value, ...result.songs] : result.songs;
    searchResults.value = [...new Map(all.map((song) => [song.id, song])).values()];
    searchTotal.value = result.songs.length ? result.total : searchResults.value.length;
  } catch (error) {
    if (!isCanceled(error) && version === searchVersion)
      searchError.value = '搜索暂时没完成，检查网络后再试一次。';
  } finally {
    if (version === searchVersion) searchLoading.value = false;
  }
}
export async function openCollection(collection: Collection, localTracks?: Track[]) {
  secondaryPage.value = null;
  const version = ++collectionVersion;
  selectedCollection.value = collection;
  collectionSongs.value = localTracks || [];
  collectionError.value = '';
  collectionLoading.value = localTracks === undefined;
  if (localTracks !== undefined) return;
  try {
    const songs = await loadCollection(collection.id, collection.kind);
    if (version === collectionVersion) collectionSongs.value = songs;
  } catch {
    if (version === collectionVersion)
      collectionError.value = '歌单暂时没有加载好，点这里重新加载。';
  } finally {
    if (version === collectionVersion) collectionLoading.value = false;
  }
}
export function closeCollection() {
  collectionVersion++;
  selectedCollection.value = null;
  collectionSongs.value = [];
  collectionLoading.value = false;
}
export function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab;
  secondaryPage.value = null;
  closeCollection();
}
export function clearSearch() {
  searchCancellation?.abort();
  searchVersion++;
  searchQuery.value = '';
  submittedQuery.value = '';
  searchOffset = 0;
  searched.value = false;
  searchResults.value = [];
  searchTotal.value = 0;
  searchLoading.value = false;
  searchError.value = '';
}
