import { searchKuwoSongs } from '@/api/kuwo';
import { getMusicLrc } from '@/api/music';
import { parseRawLyrics } from '@/hooks/usePlayerHooks';
import type { ILyric, LyricCandidate, LyricCandidateResult, SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import request from '@/utils/request';

type RawLyricPayload = {
  yrc?: { lyric?: string };
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
};

type KugouSearchCandidate = {
  id?: string;
  accesskey?: string;
  song?: string;
  singer?: string;
  album?: string;
  duration?: number;
  score?: number;
};

const LYRIC_SEARCH_TIMEOUT = 9000;
const MAX_CANDIDATES_PER_CHANNEL = 4;

const sourceLabelMap: Record<LyricCandidate['source'], string> = {
  embedded: '本地内嵌',
  current: '当前歌曲',
  kuwo: '酷我音乐',
  kugou: '酷狗歌词',
  netease: '网易云'
};

const getSongArtists = (song: SongResult) => {
  const artists = song.ar || song.artists || song.song?.artists || [];
  return artists.map((artist: any) => artist?.name).filter(Boolean) as string[];
};

const getArtistText = (song: SongResult) => getSongArtists(song).join(' / ');

const getDurationMs = (song: SongResult) => {
  const duration = Number(song.dt || song.duration || song.song?.duration || song.song?.dt || 0);
  return Number.isFinite(duration) ? duration : 0;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[《》<>「」『』"'“”‘’()[\]（）【】\-_.··,，。!！?？:：]/g, '');

const decodeHtmlText = (value: string) => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const hasValidLyric = (lyric: ILyric | null | undefined) =>
  Boolean(lyric?.lrcArray?.some((line) => line.text?.trim()));

const buildLyricFromPayload = (payload: RawLyricPayload | null | undefined): ILyric | null => {
  if (!payload) return null;

  const primaryLyric = payload.yrc?.lyric || payload.lrc?.lyric || '';
  const { lyrics, times } = parseRawLyrics(primaryLyric);
  if (lyrics.length === 0) return null;

  const { lyrics: translatedLyrics } = parseRawLyrics(payload.tlyric?.lyric || '');

  if (translatedLyrics.length === lyrics.length) {
    lyrics.forEach((line, index) => {
      line.trText = line.text && translatedLyrics[index] ? translatedLyrics[index].text : '';
    });
  } else if (translatedLyrics.length > 0) {
    const translatedMap = new Map<number, string>();
    translatedLyrics.forEach((line) => {
      if (line.text && typeof line.startTime === 'number') {
        translatedMap.set(line.startTime / 1000, line.text);
      }
    });

    lyrics.forEach((line, index) => {
      const currentTime = times[index];
      let matchedText = '';
      let minDiff = 2;
      for (const [time, text] of translatedMap.entries()) {
        const diff = Math.abs(time - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          matchedText = text;
        }
      }
      line.trText = matchedText;
    });
  }

  return {
    lrcTimeArray: times,
    lrcArray: lyrics,
    hasWordByWord: lyrics.some((line) => line.hasWordByWord)
  };
};

const buildLyricFromText = (content: string | null | undefined): ILyric | null =>
  buildLyricFromPayload({ lrc: { lyric: content || '' } });

const formatLrcTime = (secondsText: string) => {
  const seconds = Number(secondsText);
  if (!Number.isFinite(seconds)) return '[00:00.000]';
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `[${minutes.toString().padStart(2, '0')}:${restSeconds
    .toString()
    .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}]`;
};

const buildKuwoLrcText = (response: any) => {
  const lyricLines = response?.data?.lrclist || response?.lrclist || [];
  if (!Array.isArray(lyricLines)) return '';

  return lyricLines
    .map((line: any) => {
      const text = String(line?.lineLyric || line?.text || '').trim();
      if (!text) return '';
      return `${formatLrcTime(String(line.time || line.startTime || '0'))}${text}`;
    })
    .filter(Boolean)
    .join('\n');
};

const retryTask = async <T>(task: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`${label}第 ${attempt} 次失败，准备重试。`, error);
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const getLyricLineCount = (lyric: ILyric) =>
  lyric.lrcArray.filter((line) => line.text?.trim()).length;

const scoreSongMatch = (
  sourceSong: SongResult,
  target: { title: string; artist?: string; duration?: number },
  sourceBoost = 0
) => {
  const sourceTitle = normalizeText(sourceSong.name || '');
  const targetTitle = normalizeText(target.title || '');
  const sourceArtist = normalizeText(getArtistText(sourceSong));
  const targetArtist = normalizeText(target.artist || '');
  let score = sourceBoost;

  if (sourceTitle && targetTitle) {
    if (sourceTitle === targetTitle) score += 55;
    else if (sourceTitle.includes(targetTitle) || targetTitle.includes(sourceTitle)) score += 35;
  }

  if (sourceArtist && targetArtist) {
    if (sourceArtist === targetArtist) score += 30;
    else if (sourceArtist.includes(targetArtist) || targetArtist.includes(sourceArtist))
      score += 18;
  }

  const sourceDuration = getDurationMs(sourceSong);
  const targetDuration = Number(target.duration || 0);
  if (sourceDuration > 0 && targetDuration > 0) {
    const targetDurationMs = targetDuration < 1000 ? targetDuration * 1000 : targetDuration;
    const diffSeconds = Math.abs(sourceDuration - targetDurationMs) / 1000;
    if (diffSeconds <= 2) score += 14;
    else if (diffSeconds <= 8) score += 8;
    else if (diffSeconds <= 20) score += 3;
  }

  return score;
};

const buildCandidate = (params: {
  source: LyricCandidate['source'];
  songId: string | number;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  score: number;
  lyric: ILyric;
}) => ({
  key: `${params.source}-${params.songId}-${Math.round(params.score)}-${getLyricLineCount(params.lyric)}`,
  source: params.source,
  sourceLabel: sourceLabelMap[params.source],
  songId: params.songId,
  title: params.title,
  artist: params.artist,
  album: params.album,
  duration: params.duration,
  score: params.score + Math.min(getLyricLineCount(params.lyric), 40) / 10,
  lyric: params.lyric
});

const withTimeout = async <T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}超时`)), timeoutMs);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const readCachedRawLyric = async (id: number) => {
  if (!isElectron) return null;
  try {
    return (await window.electron.ipcRenderer.invoke(
      'get-cached-lyric',
      id
    )) as RawLyricPayload | null;
  } catch (error) {
    console.warn('读取磁盘歌词候选缓存失败:', error);
    return null;
  }
};

const fetchRawLyricById = async (id: string | number): Promise<RawLyricPayload | null> => {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;

  const cached = await readCachedRawLyric(numericId);
  if (cached) return cached;

  const { data } = await getMusicLrc(numericId);
  if (isElectron && data) {
    void window.electron.ipcRenderer
      .invoke('cache-lyric', numericId, data)
      .catch((error) => console.warn('写入歌词候选缓存失败:', error));
  }
  return data as RawLyricPayload;
};

const getLocalCandidate = (song: SongResult): LyricCandidate[] => {
  if (!hasValidLyric(song.lyric)) return [];
  return [
    buildCandidate({
      source: 'embedded',
      songId: song.id,
      title: song.name,
      artist: getArtistText(song),
      album: song.al?.name || song.album?.name,
      duration: getDurationMs(song),
      score: 105,
      lyric: song.lyric as ILyric
    })
  ];
};

const getCurrentSongCandidate = async (song: SongResult): Promise<LyricCandidate[]> => {
  // 根因：酷我歌曲 id 不是网易云 id，直接拿酷我 id 调本地后端 /lyric/new
  // 大概率返回空歌词。这里先走酷我自己的歌词接口，失败后才回退通用歌词接口，
  // 避免播放酷我音源时歌词区域长期空白。
  const lyric =
    song.source === 'kuwo'
      ? (await fetchKuwoLyricById(song.id).catch((error) => {
          console.warn('当前酷我歌曲歌词接口不可用，回退通用歌词接口。', error);
          return null;
        })) || buildLyricFromPayload(await fetchRawLyricById(song.id))
      : buildLyricFromPayload(await fetchRawLyricById(song.id));
  if (!hasValidLyric(lyric)) return [];

  return [
    buildCandidate({
      source: 'current',
      songId: song.id,
      title: song.name,
      artist: getArtistText(song),
      album: song.al?.name || song.album?.name,
      duration: getDurationMs(song),
      score: song.source === 'kuwo' ? 68 : 96,
      lyric: lyric as ILyric
    })
  ];
};

const getKuwoCandidates = async (song: SongResult): Promise<LyricCandidate[]> => {
  const keyword = [song.name, getArtistText(song)].filter(Boolean).join(' ').trim();
  if (!keyword) return [];

  const response = await searchKuwoSongs({ keywords: keyword, limit: 6, offset: 0 });
  const songs = (response.data?.result?.songs || []) as SongResult[];
  const candidates: LyricCandidate[] = [];

  for (const kuwoSong of songs.slice(0, MAX_CANDIDATES_PER_CHANNEL)) {
    try {
      const lyric =
        (await fetchKuwoLyricById(kuwoSong.id).catch((error) => {
          console.warn('酷我候选歌词接口不可用，回退通用歌词接口。', error);
          return null;
        })) || buildLyricFromPayload(await fetchRawLyricById(kuwoSong.id));
      if (!hasValidLyric(lyric)) continue;

      candidates.push(
        buildCandidate({
          source: 'kuwo',
          songId: kuwoSong.id,
          title: kuwoSong.name,
          artist: getArtistText(kuwoSong),
          album: kuwoSong.al?.name || kuwoSong.album?.name,
          duration: getDurationMs(kuwoSong),
          score: scoreSongMatch(
            song,
            {
              title: kuwoSong.name,
              artist: getArtistText(kuwoSong),
              duration: getDurationMs(kuwoSong)
            },
            22
          ),
          lyric: lyric as ILyric
        })
      );
    } catch (error) {
      console.warn('酷我歌词候选读取失败，继续尝试其它候选。', error);
    }
  }

  return candidates;
};

const requestTextOrJson = async (
  url: string,
  timeout = LYRIC_SEARCH_TIMEOUT,
  headers: Record<string, string> = {}
) => {
  const finalHeaders = {
    Accept: 'application/json,text/plain,*/*',
    Referer: 'https://lyrics.kugou.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    ...headers
  };

  if (isElectron && window.api?.lxMusicHttpRequest) {
    const response = await window.api.lxMusicHttpRequest({
      url,
      requestId: `lyric-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      options: {
        method: 'GET',
        timeout,
        headers: finalHeaders
      }
    });
    return response.body;
  }

  const response = await fetch(url, {
    headers: finalHeaders,
    signal: AbortSignal.timeout(timeout)
  });
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const fetchKuwoLyricById = async (id: string | number): Promise<ILyric | null> => {
  const rid = String(id).replace(/^MUSIC_/i, '');
  return await retryTask(async () => {
    const url = `https://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${encodeURIComponent(rid)}`;
    const response = await requestTextOrJson(url, 7000, {
      Referer: 'https://m.kuwo.cn/'
    });
    return buildLyricFromText(buildKuwoLrcText(response));
  }, '酷我歌词接口');
};

const getKugouCandidates = async (song: SongResult): Promise<LyricCandidate[]> => {
  const keyword = [getArtistText(song), song.name].filter(Boolean).join('-').trim();
  if (!keyword) return [];

  const searchUrl = new URL('https://lyrics.kugou.com/search');
  searchUrl.searchParams.set('ver', '1');
  searchUrl.searchParams.set('man', 'yes');
  searchUrl.searchParams.set('client', 'pc');
  searchUrl.searchParams.set('keyword', keyword);
  const duration = getDurationMs(song);
  if (duration > 0) searchUrl.searchParams.set('duration', String(duration));

  const searchResponse = await requestTextOrJson(searchUrl.toString());
  const info = Array.isArray(searchResponse?.candidates)
    ? (searchResponse.candidates as KugouSearchCandidate[])
    : [];
  const candidates: LyricCandidate[] = [];

  for (const item of info.slice(0, MAX_CANDIDATES_PER_CHANNEL)) {
    if (!item.id || !item.accesskey) continue;

    try {
      const downloadUrl = new URL('https://lyrics.kugou.com/download');
      downloadUrl.searchParams.set('ver', '1');
      downloadUrl.searchParams.set('client', 'pc');
      downloadUrl.searchParams.set('id', item.id);
      downloadUrl.searchParams.set('accesskey', item.accesskey);
      downloadUrl.searchParams.set('fmt', 'lrc');
      downloadUrl.searchParams.set('charset', 'utf8');
      const downloadResponse = await requestTextOrJson(downloadUrl.toString());
      const lyricText =
        typeof downloadResponse?.content === 'string'
          ? decodeHtmlText(downloadResponse.content)
          : '';
      const lyric = buildLyricFromText(lyricText);
      if (!hasValidLyric(lyric)) continue;

      candidates.push(
        buildCandidate({
          source: 'kugou',
          songId: item.id,
          title: item.song || song.name,
          artist: item.singer || getArtistText(song),
          album: item.album,
          duration: item.duration,
          score: scoreSongMatch(
            song,
            {
              title: item.song || song.name,
              artist: item.singer || '',
              duration: item.duration
            },
            16
          ),
          lyric: lyric as ILyric
        })
      );
    } catch (error) {
      console.warn('酷狗歌词候选下载失败，继续尝试其它候选。', error);
    }
  }

  return candidates;
};

const mapNeteaseSong = (rawSong: any): SongResult => {
  const artists = rawSong.ar || rawSong.artists || rawSong.song?.artists || [];
  const album = rawSong.al || rawSong.album || { id: 0, name: '', picUrl: rawSong.picUrl || '' };
  return {
    ...rawSong,
    picUrl: album.picUrl || rawSong.picUrl || '',
    ar: artists,
    artists,
    al: album,
    album,
    song: {
      ...(rawSong.song || {}),
      id: rawSong.id,
      name: rawSong.name,
      artists,
      album
    },
    source: 'netease',
    count: rawSong.count || 0,
    duration: rawSong.duration || rawSong.dt,
    dt: rawSong.dt || rawSong.duration
  };
};

const getNeteaseCandidates = async (song: SongResult): Promise<LyricCandidate[]> => {
  const keyword = [song.name, getArtistText(song)].filter(Boolean).join(' ').trim();
  if (!keyword) return [];

  const response = await request.get<any>('/cloudsearch', {
    params: { keywords: keyword, type: 1, limit: 8, offset: 0 }
  });
  const songs = response.data?.result?.songs || [];
  const candidates: LyricCandidate[] = [];

  for (const rawSong of songs.slice(0, MAX_CANDIDATES_PER_CHANNEL)) {
    const neteaseSong = mapNeteaseSong(rawSong);
    try {
      const rawLyric = await fetchRawLyricById(neteaseSong.id);
      const lyric = buildLyricFromPayload(rawLyric);
      if (!hasValidLyric(lyric)) continue;

      candidates.push(
        buildCandidate({
          source: 'netease',
          songId: neteaseSong.id,
          title: neteaseSong.name,
          artist: getArtistText(neteaseSong),
          album: neteaseSong.al?.name || neteaseSong.album?.name,
          duration: getDurationMs(neteaseSong),
          score: scoreSongMatch(
            song,
            {
              title: neteaseSong.name,
              artist: getArtistText(neteaseSong),
              duration: getDurationMs(neteaseSong)
            },
            12
          ),
          lyric: lyric as ILyric
        })
      );
    } catch (error) {
      console.warn('网易云歌词候选读取失败，继续尝试其它候选。', error);
    }
  }

  return candidates;
};

const uniqueCandidates = (candidates: LyricCandidate[]) => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const firstLine = candidate.lyric.lrcArray.find((line) => line.text?.trim())?.text || '';
    const key = `${candidate.source}-${normalizeText(candidate.title)}-${normalizeText(candidate.artist)}-${normalizeText(firstLine)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const loadLyricCandidates = async (song: SongResult): Promise<LyricCandidateResult> => {
  if (!song?.id || !song.name) {
    return { candidates: [], activeCandidate: null };
  }

  const immediateCandidates = getLocalCandidate(song);
  const tasks = [
    withTimeout(getCurrentSongCandidate(song), LYRIC_SEARCH_TIMEOUT, '当前歌曲歌词'),
    withTimeout(getKuwoCandidates(song), LYRIC_SEARCH_TIMEOUT, '酷我歌词'),
    withTimeout(getKugouCandidates(song), LYRIC_SEARCH_TIMEOUT, '酷狗歌词'),
    withTimeout(getNeteaseCandidates(song), LYRIC_SEARCH_TIMEOUT, '网易云歌词')
  ];

  const results = await Promise.allSettled(tasks);
  const remoteCandidates = results.flatMap((result) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn('歌词候选渠道不可用，已跳过。', result.reason);
    return [];
  });

  const candidates = uniqueCandidates([...immediateCandidates, ...remoteCandidates])
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const activeCandidate = candidates[0] || null;
  if (activeCandidate) activeCandidate.isBest = true;

  return { candidates, activeCandidate };
};
