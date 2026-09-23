import { computed, onDeactivated, onScopeDispose, ref, shallowRef, watch } from 'vue';

import { searchKuwoSongs } from '@/api/kuwo';
import {
  detectPlaylistLink,
  extractPlaylistUrls,
  parsePlaylistText,
  type ResolvedPlaylistSource,
  resolvePlaylistLink
} from '@/api/playlistSources';
import { useFavoriteStore } from '@/store/modules/favorite';
import { songSnapshot, useLocalPlaylistsStore } from '@/store/modules/localPlaylists';
import type { SongResult } from '@/types/music';

import {
  type ImportMatch,
  matchPlaylistSongs,
  type PlaylistImportSong
} from '../../../shared/playlistImport';

export function usePlaylistImport() {
  const mode = shallowRef<'link' | 'text' | 'manual'>('link');
  const input = shallowRef('');
  const name = shallowRef('');
  const destination = shallowRef<'playlist' | 'favorites'>('playlist');
  const manual = ref([{ name: '', artist: '', album: '' }]);
  const songs = shallowRef<PlaylistImportSong[]>([]);
  const matches = shallowRef<Array<ImportMatch<SongResult> | undefined>>([]);
  const selected = shallowRef(new Set<number>());
  const phase = shallowRef<'idle' | 'reading' | 'preview' | 'matching' | 'review' | 'saved'>(
    'idle'
  );
  const error = shallowRef('');
  const note = shallowRef('');
  const completed = shallowRef(0);
  const savedId = shallowRef('');
  const sourceTitle = shallowRef('');
  let version = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const local = useLocalPlaylistsStore();
  const favorite = useFavoriteStore();
  const urls = computed(() => extractPlaylistUrls(input.value));
  const detected = computed(() => urls.value.map(detectPlaylistLink));
  const platforms = computed(() =>
    [...new Set(detected.value.flatMap((link) => (link ? [link.label] : [])))].join('、')
  );
  const busy = computed(() => phase.value === 'reading' || phase.value === 'matching');
  const reviewing = computed(() => phase.value === 'review');
  const selectable = computed(() =>
    songs.value
      .map((_, index) => index)
      .filter((index) => !reviewing.value || Boolean(matches.value[index]?.track))
  );
  const allSelected = computed(
    () => selectable.value.length > 0 && selected.value.size === selectable.value.length
  );
  const chosen = computed(() => songs.value.filter((_, index) => selected.value.has(index)));
  const matchedTracks = computed(() =>
    matches.value
      .filter((item, index) => selected.value.has(index) && item?.track)
      .map((item) => item!.track!)
  );

  function stop() {
    version++;
    clearTimeout(timer);
    controller?.abort();
    if (phase.value === 'reading') {
      phase.value = 'idle';
      error.value = '读取已停止，可以点击重新读取。';
    } else if (phase.value === 'matching') {
      phase.value = 'review';
      note.value = `已停止匹配，保留已完成的 ${completed.value} 首结果。`;
    }
  }
  function reset() {
    stop();
    songs.value = [];
    matches.value = [];
    selected.value = new Set();
    phase.value = 'idle';
    error.value = '';
    note.value = '';
    completed.value = 0;
    savedId.value = '';
    sourceTitle.value = '';
  }
  watch(
    [input, mode, manual],
    () => {
      reset();
      if (mode.value === 'link' && urls.value.length) timer = setTimeout(() => void preview(), 450);
    },
    { deep: true }
  );

  async function preview() {
    if (busy.value) return;
    reset();
    const runVersion = ++version;
    controller = new AbortController();
    const signal = controller.signal;
    phase.value = 'reading';
    try {
      let values: PlaylistImportSong[];
      if (mode.value === 'link') {
        if (!urls.value.length || detected.value.some((link) => !link))
          throw new Error(
            '请粘贴 QQ 音乐、网易云或酷我的完整公开歌单链接。歌曲链接和个人主页暂不支持。'
          );
        const sources: ResolvedPlaylistSource[] = [];
        for (const link of detected.value) {
          const source = await resolvePlaylistLink(link!, signal, (loaded, total) => {
            if (version === runVersion)
              note.value = `正在读取${link!.label} · ${loaded} / ${total} 首`;
          });
          sources.push(source);
        }
        if (version !== runVersion) return;
        values = sources.flatMap((source) => source.songs);
        sourceTitle.value = sources.map((source) => source.title).join('、');
        const missing = sources.reduce((sum, source) => sum + source.filteredCount, 0);
        note.value = `读到 ${values.length} 首${missing ? `，${missing} 首平台暂未提供` : ''}。保留原歌单顺序，选择需要导入的歌曲。`;
      } else if (mode.value === 'manual') {
        values = manual.value
          .filter((song) => song.name.trim())
          .map((song, index) => ({ ...song, duration: 0, externalId: `manual-${index}` }));
      } else values = parsePlaylistText(input.value);
      if (version !== runVersion) return;
      if (!values.length) throw new Error('先粘贴歌曲列表，或填写歌曲名称。');
      songs.value = values;
      selected.value = new Set(values.map((_, index) => index));
      if (!name.value.trim()) name.value = sourceTitle.value || '导入的歌单';
      phase.value = 'preview';
    } catch (cause) {
      if (version !== runVersion) return;
      error.value = cause instanceof Error ? cause.message : '暂未读取完成，请重试。';
      note.value = '';
      phase.value = 'idle';
    }
  }
  async function matchSelected() {
    if (busy.value || !chosen.value.length) return;
    const source = [...chosen.value];
    stop();
    const runVersion = ++version;
    controller = new AbortController();
    phase.value = 'matching';
    error.value = '';
    completed.value = 0;
    songs.value = source;
    matches.value = new Array(source.length);
    selected.value = new Set();
    try {
      await matchPlaylistSongs<SongResult>({
        songs: source,
        signal: controller.signal,
        search: async (query, signal) =>
          (await searchKuwoSongs({ keywords: query, limit: 15, offset: 0 }, signal as AbortSignal))
            .data.result.songs,
        describe: (song) => ({
          name: song.name,
          artist: (song.ar || song.artists || []).map((artist) => artist.name).join(' / '),
          duration: song.dt || song.duration
        }),
        onResult(index, result) {
          if (version !== runVersion) return;
          const next = [...matches.value];
          next[index] = result;
          matches.value = next;
          if (result.exact) selected.value = new Set([...selected.value, index]);
          completed.value++;
        }
      });
      if (version !== runVersion) return;
      phase.value = 'review';
      note.value = '已自动勾选歌名、歌手及版本匹配的歌曲；其他候选请核对后手动选择。';
    } catch (cause) {
      if (version !== runVersion) return;
      phase.value = 'review';
      error.value = cause instanceof Error ? cause.message : '匹配暂未完成，请重试。';
    }
  }
  function toggle(index: number) {
    if (busy.value || !selectable.value.includes(index)) return;
    const next = new Set(selected.value);
    next.has(index) ? next.delete(index) : next.add(index);
    selected.value = next;
  }
  function toggleAll() {
    if (!busy.value) selected.value = allSelected.value ? new Set() : new Set(selectable.value);
  }
  function save() {
    if (busy.value || phase.value !== 'review' || !matchedTracks.value.length) return;
    try {
      const tracks = matchedTracks.value.map(songSnapshot);
      if (destination.value === 'favorites') favorite.importFavorites(tracks);
      else savedId.value = local.create(name.value, tracks).id;
      phase.value = 'saved';
      note.value = `已将 ${tracks.length} 首歌曲保存到${destination.value === 'favorites' ? '我喜欢' : '我的歌单'}。`;
    } catch {
      error.value = '未能保存到本机，请检查可用空间后重试。';
    }
  }
  onScopeDispose(stop);
  onDeactivated(stop);
  return {
    mode,
    input,
    name,
    destination,
    manual,
    songs,
    matches,
    selected,
    phase,
    error,
    note,
    completed,
    savedId,
    sourceTitle,
    platforms,
    busy,
    reviewing,
    allSelected,
    preview,
    matchSelected,
    toggle,
    toggleAll,
    save,
    stop
  };
}
