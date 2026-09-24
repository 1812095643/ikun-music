import { computed, onUnmounted, shallowRef, watch } from 'vue';

import {
  createCancellation,
  isCanceled,
  loadSharedPlaylist,
  searchTracks,
  type SharedPlaylistPreview,
  type Track
} from '@/services/musicApi';
import { openCollection } from '@/stores/browse';
import { createPlaylist, toast } from '@/stores/library';

import {
  detectPlaylistLink,
  extractPlaylistUrls,
  matchPlaylistSongs
} from '../../../src/shared/playlistImport';

export function usePlaylistImport() {
  const text = shallowRef('');
  const name = shallowRef('导入的歌单');
  const working = shallowRef(false);
  const completed = shallowRef(0);
  const results = shallowRef<{ source: string; track?: Track; selected: boolean }[]>([]);
  const sharePlaylist = shallowRef<SharedPlaylistPreview | null>(null);
  const selectedShareIndexes = shallowRef(new Set<number>());
  const shareLoading = shallowRef(false);
  const shareError = shallowRef('');
  const shareShown = shallowRef(60);
  const shown = shallowRef(60);
  let cancellation: ReturnType<typeof createCancellation> | undefined;
  let shareCancellation: ReturnType<typeof createCancellation> | undefined;
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  let shareVersion = 0;
  const selected = computed(() => results.value.filter((item) => item.track && item.selected));
  // 原生服务层没有浏览器 URL 对象，直接复用两端通用的分享链接识别器。
  const inputUrls = computed(() => extractPlaylistUrls(text.value));
  const detectedShareUrl = computed(
    () => inputUrls.value.map(detectPlaylistLink).find(Boolean)?.url || ''
  );
  const unsupportedShareUrl = computed(() => inputUrls.value.length > 0 && !detectedShareUrl.value);
  const selectedShareCount = computed(() => selectedShareIndexes.value.size);
  const allShareSelected = computed(
    () =>
      Boolean(sharePlaylist.value?.songs.length) &&
      selectedShareIndexes.value.size === sharePlaylist.value?.songs.length
  );
  const visibleShareSongs = computed(
    () => sharePlaylist.value?.songs.slice(0, shareShown.value) || []
  );
  const shareSongs = computed(() => sharePlaylist.value?.songs || []);
  const shareTitle = computed(() => sharePlaylist.value?.title || '');
  const sharePlatformLabel = computed(() =>
    sharePlaylist.value?.platform === 'qq'
      ? 'QQ音乐'
      : sharePlaylist.value?.platform === 'netease'
        ? '网易云音乐'
        : '酷我音乐'
  );
  const shareFilteredCount = computed(() => sharePlaylist.value?.filteredCount || 0);

  watch(text, () => {
    if (shareTimer) clearTimeout(shareTimer);
    cancellation?.abort();
    shareVersion++;
    shareCancellation?.abort();
    sharePlaylist.value = null;
    selectedShareIndexes.value = new Set();
    shareLoading.value = false;
    shareError.value = '';
    shareShown.value = 60;
    shown.value = 60;
    working.value = false;
    completed.value = 0;
    results.value = [];
    if (unsupportedShareUrl.value) {
      shareError.value = '暂不支持这个链接格式，请换成 QQ 音乐、网易云或酷我的公开歌单链接。';
      return;
    }
    const url = detectedShareUrl.value;
    if (!url) return;
    shareLoading.value = true;
    const version = shareVersion;
    shareTimer = setTimeout(() => void previewSharedPlaylist(url, version), 350);
  });

  async function previewSharedPlaylist(url: string, version: number) {
    shareCancellation = createCancellation();
    shareLoading.value = true;
    shareError.value = '';
    try {
      const preview = await loadSharedPlaylist(url, shareCancellation.signal);
      if (version !== shareVersion) return;
      sharePlaylist.value = preview;
      selectedShareIndexes.value = new Set(preview.songs.map((_, index) => index));
      shareShown.value = Math.min(preview.songs.length, 60);
      if (name.value === '导入的歌单') name.value = preview.title;
    } catch (error) {
      if (version !== shareVersion || isCanceled(error)) return;
      shareError.value = error instanceof Error ? error.message : '歌单暂时无法读取';
    } finally {
      if (version === shareVersion) shareLoading.value = false;
    }
  }

  function toggleShare(index: number) {
    const next = new Set(selectedShareIndexes.value);
    next.has(index) ? next.delete(index) : next.add(index);
    selectedShareIndexes.value = next;
  }

  function toggleAllShare() {
    if (!sharePlaylist.value) return;
    selectedShareIndexes.value = allShareSelected.value
      ? new Set()
      : new Set(sharePlaylist.value.songs.map((_, index) => index));
  }

  function showMoreShareSongs() {
    shareShown.value = Math.min(sharePlaylist.value?.songs.length || 0, shareShown.value + 60);
  }

  function retrySharePreview() {
    const url = detectedShareUrl.value;
    if (!url || shareLoading.value) return;
    const version = ++shareVersion;
    void previewSharedPlaylist(url, version);
  }
  async function paste() {
    try {
      const result = await uni.getClipboardData();
      text.value = result.data;
    } catch {
      toast('请长按输入框粘贴文字');
    }
  }
  async function identify() {
    if (working.value) return;
    if (unsupportedShareUrl.value) return;
    if (sharePlaylist.value) return identifySharedPlaylist();
    if (detectedShareUrl.value) return;
    const lines = [
      ...new Set(
        text.value
          .split(/\r?\n/)
          .map((line) => line.replace(/^\s*\d{1,3}[.、)）]\s*/, '').trim())
          .filter(Boolean)
      )
    ];
    if (!lines.length) return;
    const controller = createCancellation();
    cancellation = controller;
    working.value = true;
    completed.value = 0;
    results.value = lines.map((source) => ({ source, selected: false }));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, lines.length) }, async () => {
        while (next < lines.length && !controller.signal.aborted) {
          const index = next++;
          try {
            const query = lines[index].replace(/[《》]/g, '').replace(/\s+[-—–|]\s+/g, ' ');
            const found = await searchTracks(query, 0, controller.signal);
            if (controller.signal.aborted) break;
            const exact = found.songs.find((track) =>
              [
                normalize(track.title + track.artist),
                normalize(track.artist + track.title)
              ].includes(normalize(query))
            );
            const candidate = exact || found.songs[0];
            results.value = results.value.map((item, at) =>
              at === index ? { ...item, track: candidate, selected: Boolean(exact) } : item
            );
          } catch (error) {
            if (controller.signal.aborted || isCanceled(error)) break;
          }
          completed.value++;
        }
      })
    );
    if (cancellation === controller) working.value = false;
  }

  async function identifySharedPlaylist() {
    if (working.value || !sharePlaylist.value || !selectedShareIndexes.value.size) return;
    const controller = createCancellation();
    cancellation = controller;
    working.value = true;
    const sourceSongs = [...selectedShareIndexes.value]
      .sort((a, b) => a - b)
      .map((index) => sharePlaylist.value!.songs[index]);
    completed.value = 0;
    results.value = sourceSongs.map((song) => ({
      source: `${song.name} - ${song.artist}`,
      selected: false
    }));
    try {
      await matchPlaylistSongs<Track>({
        songs: sourceSongs,
        signal: controller.signal,
        search: async (query, signal) => (await searchTracks(query, 0, signal)).songs,
        describe: (track) => ({
          name: track.title,
          artist: track.artist,
          duration: track.duration * 1000
        }),
        onResult(index, result) {
          if (controller.signal.aborted) return;
          results.value = results.value.map((item, at) =>
            at === index ? { ...item, track: result.track, selected: result.exact } : item
          );
          completed.value++;
        }
      });
    } catch (error) {
      if (!isCanceled(error)) toast('匹配暂未完成，请重试或先导入已识别的歌曲');
    } finally {
      if (cancellation === controller) working.value = false;
    }
  }
  function normalize(value: string) {
    return value.toLowerCase().replace(/[\s\-_—–|《》.,，。!！?？()（）:：;；“”、·&]/g, '');
  }
  function toggle(index: number) {
    results.value = results.value.map((item, at) =>
      at === index && item.track ? { ...item, selected: !item.selected } : item
    );
  }
  function importSelected() {
    const playlist = createPlaylist(
      name.value,
      selected.value.map((item) => item.track!)
    );
    if (!playlist) {
      toast('给歌单取个名字吧');
      return;
    }
    toast(`已导入 ${selected.value.length} 首歌曲`);
    void openCollection(
      {
        id: playlist.id,
        title: playlist.title,
        cover: playlist.tracks[0]?.cover || '',
        kind: 'local'
      },
      playlist.tracks
    );
  }
  const visibleResults = computed(() => results.value.slice(0, shown.value));
  const stop = () => {
    cancellation?.abort();
    shareCancellation?.abort();
    shareVersion++;
    working.value = false;
    shareLoading.value = false;
    if (shareTimer) clearTimeout(shareTimer);
  };
  onUnmounted(stop);
  return {
    text,
    name,
    working,
    completed,
    results,
    selected,
    visibleResults,
    shown,
    detectedShareUrl,
    unsupportedShareUrl,
    sharePlaylist,
    selectedShareIndexes,
    selectedShareCount,
    allShareSelected,
    shareSongs,
    shareTitle,
    sharePlatformLabel,
    shareFilteredCount,
    visibleShareSongs,
    shareShown,
    shareLoading,
    shareError,
    paste,
    identify,
    toggle,
    toggleShare,
    toggleAllShare,
    showMoreShareSongs,
    retrySharePreview,
    importSelected,
    stop
  };
}
