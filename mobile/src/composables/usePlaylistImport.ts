import { computed, onUnmounted,shallowRef } from 'vue';

import { createCancellation, isCanceled, searchTracks, type Track } from '@/services/musicApi';
import { openCollection } from '@/stores/browse';
import { createPlaylist, toast } from '@/stores/library';

export function usePlaylistImport() {
  const text = shallowRef('');
  const name = shallowRef('导入的歌单');
  const working = shallowRef(false);
  const completed = shallowRef(0);
  const results = shallowRef<{ source: string; track?: Track; selected: boolean }[]>([]);
  let cancellation: ReturnType<typeof createCancellation> | undefined;
  const selected = computed(() => results.value.filter((item) => item.track && item.selected));
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
  const stop = () => cancellation?.abort();
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
    paste,
    identify,
    toggle,
    importSelected,
    stop
  };
}
