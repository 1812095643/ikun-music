import { run, setTransport } from '@ikun/music-backend';
import AbortController from 'abort-controller';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  localUri?: string;
  fileSize?: number;
}
export interface Collection {
  id: string;
  title: string;
  cover: string;
  description?: string;
  kind?: 'playlist' | 'rank' | 'favorites' | 'history' | 'local';
  updateFrequency?: string;
}
export interface SharedPlaylistSong {
  name: string;
  artist: string;
  album: string;
  duration: number;
}
export interface SharedPlaylistPreview {
  platform: 'qq' | 'netease' | 'kuwo';
  id: string;
  title: string;
  total: number;
  filteredCount: number;
  songs: SharedPlaylistSong[];
}
export interface Artist {
  id: string;
  name: string;
  cover: string;
}
export interface LyricLine {
  time: number;
  text: string;
}
export type Quality = 'standard' | 'high' | 'lossless';
export interface StreamInfo {
  url: string;
  type: string;
  bitrate?: number;
}
export const qualities = [
  { key: 'standard' as Quality, label: '标准', description: '优先 128 kbps · 轻松聆听' },
  { key: 'high' as Quality, label: '高品质', description: '优先 320 kbps · 日常推荐' },
  { key: 'lossless' as Quality, label: '无损', description: '优先 FLAC · 保留更多细节' }
];

const requests = new Map<string, UniApp.RequestTask>();
export function createCancellation() {
  const controller = new AbortController();
  Object.defineProperty(controller.signal, 'throwIfAborted', {
    value: () => {
      if (controller.signal.aborted) {
        const error = new Error('请求已取消');
        error.name = 'AbortError';
        throw error;
      }
    }
  });
  return controller;
}
export const isCanceled = (error: unknown) => error instanceof Error && error.name === 'AbortError';

// 只注入传输层；歌曲身份、封面归一化、音质参数和默认取流仍使用桌面同一份源码。
setTransport({
  cancel(id) {
    requests.get(id)?.abort();
    requests.delete(id);
  },
  request(payload) {
    return new Promise((resolve, reject) => {
      let url = payload.url as string;
      const headers = { ...payload.options.headers } as Record<string, string>;
      // #ifdef H5
      if (import.meta.env.DEV) {
        url = `/__music?url=${encodeURIComponent(url)}`;
        headers['x-music-agent'] = headers['User-Agent'] || 'okhttp/3.10.0';
        delete headers['User-Agent'];
        delete headers.Referer;
      }
      // #endif
      const task = uni.request({
        url,
        method: payload.options.method,
        data: payload.options.body ?? payload.options.data,
        header: headers,
        timeout: payload.options.timeout || 12000,
        dataType: 'text',
        responseType: 'text',
        success(response) {
          let body: unknown = response.data;
          if (typeof body === 'string' && /^\s*[[{]/.test(body)) {
            try {
              body = JSON.parse(body);
            } catch {
              /* 非 JSON 文本交回原接口处理。 */
            }
          }
          const normalizedHeaders: Record<string, string> = {};
          Object.entries(response.header || {}).forEach(([key, value]) => {
            normalizedHeaders[key.toLowerCase()] = String(value);
          });
          resolve({ statusCode: response.statusCode, headers: normalizedHeaders, body });
        },
        fail(response) {
          const error = new Error(response.errMsg || '网络暂不可用');
          if (response.errMsg.includes('abort')) error.name = 'AbortError';
          reject(error);
        },
        complete() {
          requests.delete(payload.requestId);
        }
      });
      requests.set(payload.requestId, task);
    });
  }
});

function mapTrack(item: any): Track {
  return {
    id: String(item.id),
    title: item.name || '',
    artist: (item.ar || item.artists || [])
      .map((artist: any) => artist.name)
      .filter(Boolean)
      .join(' / '),
    album: item.al?.name || item.album?.name || '',
    cover: item.picUrl || item.al?.picUrl || '',
    duration: Number(item.dt || item.duration || 0) / 1000
  };
}
export async function loadHome(): Promise<Collection[]> {
  return (await run('home')).map((item: any) => ({
    id: String(item.id),
    title: item.name,
    cover: item.picUrl || item.coverImgUrl,
    description: item.copywriter
  }));
}
export async function searchTracks(
  query: string,
  offset = 0,
  signal?: unknown
): Promise<{ songs: Track[]; total: number }> {
  const result = await run('search', { query, offset, signal });
  return { songs: (result.songs || []).map(mapTrack), total: Number(result.songCount || 0) };
}
export async function loadCollection(id: string, kind?: Collection['kind']): Promise<Track[]> {
  const tracks: Track[] = (await run(kind === 'rank' ? 'rank' : 'playlist', { id })).tracks.map(
    mapTrack
  );
  if (kind !== 'rank') return tracks;
  // 兼容榜单不返回单曲封面；只补齐前三名，且必须匹配同一歌曲 ID，避免套用同名版本的图片。
  const leaders = await Promise.all(
    tracks.slice(0, 3).map(async (track) => {
      if (track.cover) return track;
      const cancellation = createCancellation();
      const timer = setTimeout(() => cancellation.abort(), 2200);
      try {
        const result = await searchTracks(`${track.title} ${track.artist}`, 0, cancellation.signal);
        const match = result.songs.find((song) => song.id === track.id);
        return match?.cover ? { ...track, cover: match.cover } : track;
      } catch {
        return track;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return [...leaders, ...tracks.slice(3)];
}
export async function loadSharedPlaylist(
  url: string,
  signal?: unknown
): Promise<SharedPlaylistPreview> {
  return run('playlist-link', { url, signal });
}
export async function loadRanks(): Promise<Collection[]> {
  const result = await run('ranks');
  return (result.list || []).map((item: any) => ({
    id: String(item.id),
    title: item.name,
    cover: item.picUrl || item.coverImgUrl,
    description: item.description,
    updateFrequency: item.updateFrequency,
    kind: 'rank'
  }));
}
export async function findArtist(name: string): Promise<Artist | null> {
  const result = await run('artists', { query: name });
  const item = result.find((artist: any) => artist.name === name) || result[0];
  return item
    ? { id: String(item.id), name: item.name, cover: item.picUrl || item.img1v1Url || '' }
    : null;
}
export async function resolveTrack(
  id: string,
  quality: Quality,
  signal?: unknown
): Promise<StreamInfo> {
  return run('resolve', { id, quality, signal });
}
export async function loadLyrics(track: Track): Promise<LyricLine[]> {
  return (
    await run('lyrics', {
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration: track.duration
    })
  )
    .map((line: any) => ({ time: Number(line.time), text: String(line.text || '').trim() }))
    .filter((line: LyricLine) => Number.isFinite(line.time) && line.text)
    .sort((a: LyricLine, b: LyricLine) => a.time - b.time);
}
export const previewMediaUrl = (url: string) => {
  // #ifdef H5
  if (import.meta.env.DEV && /^https?:\/\//.test(url))
    return `/__music?url=${encodeURIComponent(url)}`;
  // #endif
  return url;
};
