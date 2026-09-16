import { onScopeDispose, watch } from 'vue';

import { saveLocalSongLyric } from '@/services/localLyricService';
import { loadLyricCandidates } from '@/services/lyricCandidateService';
import { useLyricStore } from '@/store/modules/lyric';
import { usePlayerStore } from '@/store/modules/player';

export function useLyricSelection() {
  const playerStore = usePlayerStore();
  const lyricStore = useLyricStore();
  let controller: AbortController | undefined;
  const songKey = () => `${playerStore.playMusic.source}:${playerStore.playMusic.id}`;
  watch(songKey, () => controller?.abort(), { flush: 'sync' });
  onScopeDispose(() => controller?.abort());

  const selectLyric = async (key: string) => {
    const song = { ...playerStore.playMusic };
    const candidate = lyricStore.selectCandidate(key);
    if (!candidate) return;
    controller?.abort();
    const version = lyricStore.beginRequest();
    lyricStore.setLoading(false);
    playerStore.playMusic = { ...song, lyric: candidate.lyric };
    try {
      await saveLocalSongLyric(song, candidate.lyric);
    } catch (error) {
      if (version === lyricStore.requestVersion)
        lyricStore.setErrorMessage(`歌词已切换，但暂未保存到文件：${String(error)}`);
    }
  };

  const searchLyrics = async (query?: { name: string; artist: string }) => {
    if (!playerStore.playMusic.id) return;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const version = lyricStore.beginRequest();
    const identity = songKey();
    const song = { ...playerStore.playMusic };
    const searchSong = query
      ? {
          ...song,
          id: `query:${song.id}`,
          onlineId: undefined,
          localFilePath: undefined,
          playMusicUrl: undefined,
          lyric: undefined,
          name: query.name.trim() || song.name,
          ar: query.artist.trim() ? ([{ name: query.artist.trim() }] as typeof song.ar) : song.ar
        }
      : song;
    lyricStore.setLoading(true);
    lyricStore.setErrorMessage('');
    try {
      const result = await loadLyricCandidates(searchSong, { signal });
      if (identity !== songKey() || version !== lyricStore.requestVersion || signal.aborted) return;
      // 搜索只更新候选列表，用户选择后才替换本地歌词，避免搜索结果自动覆盖已校正的版本。
      const previous = lyricStore.activeCandidate;
      if (previous && !result.candidates.some((item) => item.key === previous.key))
        result.candidates.unshift(previous);
      lyricStore.setCandidateResult({ ...result, activeCandidate: previous || null });
    } catch {
      if (identity === songKey() && version === lyricStore.requestVersion && !signal.aborted) {
        lyricStore.setErrorMessage('歌词搜索暂未完成，请检查网络后重试');
      }
    } finally {
      if (version === lyricStore.requestVersion) lyricStore.setLoading(false);
    }
  };
  return { selectLyric, searchLyrics };
}
