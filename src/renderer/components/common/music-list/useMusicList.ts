import { useStorage } from '@vueuse/core';
import { useMessage } from 'naive-ui';
import PinyinMatch from 'pinyin-match';
import { computed, shallowRef, watch } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';

export const getTrackKey = (song: SongResult) =>
  `${song.source || 'netease'}:${song.localFilePath || song.id}`;

export function useMusicList(getSongs: () => SongResult[]) {
  const player = usePlayerStore();
  const message = useMessage();
  const query = shallowRef('');
  const sort = shallowRef('original');
  const density = useStorage('musicListLayout', 'normal');
  const selecting = shallowRef(false);
  const selected = shallowRef(new Set<string>());
  const downloading = shallowRef(false);
  const shown = shallowRef(80);
  const filtered = computed(() => {
    const keyword = query.value.trim().toLocaleLowerCase();
    const list = getSongs().filter((song) => {
      if (!keyword) return true;
      const fields = [
        song.name,
        song.al?.name || song.album?.name,
        ...(song.ar || song.artists || []).map((artist) => artist.name)
      ];
      return fields.some(
        (value) =>
          value &&
          (value.toLocaleLowerCase().includes(keyword) ||
            Boolean(PinyinMatch.match(value, keyword)))
      );
    });
    if (sort.value === 'oldest') return list.reverse();
    if (sort.value === 'count') return list.sort((a, b) => (b.count || 0) - (a.count || 0));
    if (sort.value === 'title') return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    if (sort.value === 'duration')
      return list.sort((a, b) => (a.dt || a.duration || 0) - (b.dt || b.duration || 0));
    return list;
  });
  const visible = computed(() => filtered.value.slice(0, shown.value));
  const chosen = computed(() =>
    filtered.value.filter((song) => selected.value.has(getTrackKey(song)))
  );
  const allSelected = computed(
    () => filtered.value.length > 0 && chosen.value.length === filtered.value.length
  );
  const currentIndex = computed(() =>
    filtered.value.findIndex((song) => getTrackKey(song) === getTrackKey(player.playMusic))
  );

  watch([query, sort], () => {
    shown.value = 80;
    // 筛选条件改变后清空选择，避免批量操作误带入已经看不见的歌曲。
    selected.value = new Set();
  });
  watch(selecting, () => {
    selected.value = new Set();
  });

  function select(song: SongResult) {
    const next = new Set(selected.value);
    const key = getTrackKey(song);
    next.has(key) ? next.delete(key) : next.add(key);
    selected.value = next;
  }
  function selectAll() {
    selected.value = allSelected.value ? new Set() : new Set(filtered.value.map(getTrackKey));
  }
  async function play(song = filtered.value[0], restart = false) {
    if (!song) return;
    // 当前歌曲使用播放器中的已解析对象，暂停/继续不重新取流；新歌曲先建立队列再播放一次。
    const current = getTrackKey(song) === getTrackKey(player.playMusic);
    if (current && !restart) {
      await player.setPlay({ ...player.playMusic });
      return;
    }
    player.setPlayList([...filtered.value]);
    await player.setPlay({ ...song, isFirstPlay: restart });
  }
  function addToQueue(songs = chosen.value) {
    const existing = new Set(player.playList.map(getTrackKey));
    const additions = songs.filter((song) => {
      const key = getTrackKey(song);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (!additions.length) {
      message.info('所选歌曲已在播放队列中');
      return;
    }
    // 保留当前索引，加入队列不会打断正在播放的歌曲。
    player.setPlayList([...player.playList, ...additions], true);
    message.success(`已加入 ${additions.length} 首歌曲`);
    selecting.value = false;
  }
  async function downloadSelected() {
    if (downloading.value || !chosen.value.length) return;
    downloading.value = true;
    try {
      const { useDownload } = await import('@/hooks/useDownload');
      await useDownload().batchDownloadMusic([...chosen.value]);
      selecting.value = false;
    } finally {
      downloading.value = false;
    }
  }

  return {
    query,
    sort,
    density,
    selecting,
    selected,
    downloading,
    shown,
    filtered,
    visible,
    chosen,
    allSelected,
    currentIndex,
    select,
    selectAll,
    play,
    addToQueue,
    downloadSelected
  };
}
