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
  const shareShown = shallowRef(120);
  let cancellation: ReturnType<typeof createCancellation> | undefined;
  let shareCancellation: ReturnType<typeof createCancellation> | undefined;
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  let shareVersion = 0;
  const selected = computed(() => results.value.filter((item) => item.track && item.selected));
  const detectedShareUrl = computed(() => findSharedPlaylistUrl(text.value));
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

  watch(detectedShareUrl, (url) => {
    if (shareTimer) clearTimeout(shareTimer);
    cancellation?.abort();
    shareVersion++;
    shareCancellation?.abort();
    sharePlaylist.value = null;
    selectedShareIndexes.value = new Set();
    shareError.value = '';
    shareShown.value = 120;
    results.value = [];
    if (!url) return;
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
      shareShown.value = Math.min(preview.songs.length, 120);
      if (name.value === '导入的歌单') name.value = preview.title;
    } catch (error) {
      if (version !== shareVersion || isCanceled(error)) return;
      shareError.value = error instanceof Error ? error.message : '歌单暂时无法读取';
    } finally {
      if (version === shareVersion) shareLoading.value = false;
    }
  }

  function findSharedPlaylistUrl(value: string) {
    const match = value.match(/https?:\/\/[^\s]+/i);
    const candidate = (match?.[0] || '').replace(/[),，。；;]+$/g, '');
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      const path = `${url.pathname}${url.hash}`;
      if ((host === 'y.qq.com' || host.endsWith('.qq.com')) && /\/playlist\/\d+/i.test(path))
        return candidate;
      if (
        (host === 'music.163.com' || host === '163cn.tv') &&
        (url.searchParams.get('id') || /[?&]id=\d+/.test(url.hash))
      )
        return candidate;
      if (
        (host === 'kuwo.cn' || host.endsWith('.kuwo.cn')) &&
        (/\/playlist(?:_detail)?\/\d+/i.test(path) || url.searchParams.has('pid'))
      )
        return candidate;
    } catch {
      return '';
    }
    return '';
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
    shareShown.value = Math.min(sharePlaylist.value?.songs.length || 0, shareShown.value + 120);
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
    if (sharePlaylist.value) return identifySharedPlaylist();
    const lines = [
      ...new Set(
        text.value
          .split(/\r?\n/)
          .map((line) => line.replace(/^\s*\d{1,3}[.、)）]\s*/, '').trim())
          .filter(Boolean)
      )
    ];
    if (!lines.length) return;
    cancellation = createCancellation();
    working.value = true;
    completed.value = 0;
    results.value = lines.map((source) => ({ source, selected: false }));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, lines.length) }, async () => {
        while (next < lines.length && !cancellation?.signal.aborted) {
          const index = next++;
          try {
            const query = lines[index].replace(/[《》]/g, '').replace(/\s+[-—–|]\s+/g, ' ');
            const found = await searchTracks(query, 0, cancellation!.signal);
            if (cancellation!.signal.aborted) break;
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
            if (isCanceled(error)) break;
          }
          completed.value++;
        }
      })
    );
    working.value = false;
  }

  async function identifySharedPlaylist() {
    if (working.value || !sharePlaylist.value || !selectedShareIndexes.value.size) return;
    cancellation = createCancellation();
    working.value = true;
    const sourceSongs = [...selectedShareIndexes.value]
      .sort((a, b) => a - b)
      .map((index) => sharePlaylist.value!.songs[index]);
    completed.value = 0;
    results.value = sourceSongs.map((song) => ({
      source: `${song.name} - ${song.artist}`,
      selected: true
    }));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, sourceSongs.length) }, async () => {
        while (next < sourceSongs.length && !cancellation?.signal.aborted) {
          const index = next++;
          const source = sourceSongs[index];
          try {
            const found = await searchTracks(
              `${source.name} ${source.artist}`,
              0,
              cancellation!.signal
            );
            if (cancellation!.signal.aborted) break;
            const title = normalize(source.name);
            const artist = normalize(source.artist);
            const exact = found.songs.find(
              (track) =>
                normalize(track.title) === title &&
                (normalize(track.artist).includes(artist) ||
                  artist.includes(normalize(track.artist)))
            );
            const candidate = exact || found.songs[0];
            results.value = results.value.map((item, at) =>
              at === index ? { ...item, track: candidate, selected: Boolean(candidate) } : item
            );
          } catch (error) {
            if (isCanceled(error)) break;
          }
          completed.value++;
        }
      })
    );
    working.value = false;
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
  const shown = shallowRef(100);
  const visibleResults = computed(() => results.value.slice(0, shown.value));
  const stop = () => {
    cancellation?.abort();
    shareCancellation?.abort();
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
