import type { MusicSourceType, SongResult } from '@/types/music';

import { assertExternalOk, requestExternalMusic } from './externalMusicRequest';

export interface GDMusicResponse {
  url: string;
  br: number;
  size: number;
  md5: string;
  platform: string;
  gain: number;
}

export interface ParsedMusicResult {
  data: {
    data: GDMusicResponse;
    params: { id: number; type: string };
  };
}

const baseUrl = 'https://music-api.gdstudio.xyz/api.php';
const normalizeText = (value: string) => value.toLowerCase().replace(/[\s()（）\-_.·]/g, '');

const requestGD = async (params: Record<string, string>, signal: AbortSignal) => {
  const response = await requestExternalMusic<any>(`${baseUrl}?${new URLSearchParams(params)}`, {
    timeout: 5000,
    signal,
    requestPrefix: 'gdmusic',
    headers: { Referer: 'https://music-api.gdstudio.xyz/' }
  });
  return assertExternalOk(response, 'GD音乐台');
};

/** 按歌曲身份解析备用地址；取消和超时必须中止后续搜索，不能只结束外层等待。 */
export const parseFromGDMusic = async (
  id: number,
  song: SongResult,
  quality = '320',
  timeout = 12000,
  playbackSignal?: AbortSignal
): Promise<ParsedMusicResult | null> => {
  const signal = playbackSignal
    ? AbortSignal.any([playbackSignal, AbortSignal.timeout(timeout)])
    : AbortSignal.timeout(timeout);
  const artists = song.ar?.length ? song.ar : song.artists || song.song?.artists || [];
  const artistNames = artists.map((artist: { name: string }) => artist.name).filter(Boolean);
  const sourceName = normalizeText(song.name || '');
  const wrapResult = (result: any): ParsedMusicResult | null => {
    if (!result?.url || !/^https?:\/\//i.test(result.url)) return null;
    return {
      data: {
        data: {
          url: result.url,
          br: Number(result.br) * 1000 || 320000,
          size: Number(result.size) || 0,
          md5: '',
          platform: 'gdmusic',
          gain: 0
        },
        params: { id, type: 'song' }
      }
    };
  };

  try {
    signal.throwIfAborted();
    // 已确定为网易云的 ID 可直接取流，避免重新搜索和先等待无关平台超时。
    const hasNeteaseId = !song.source || song.source === 'netease';
    if (hasNeteaseId) {
      try {
        const direct = wrapResult(
          await requestGD({ types: 'url', source: 'netease', id: String(id), br: quality }, signal)
        );
        if (direct) return direct;
      } catch (error) {
        signal.throwIfAborted();
        console.warn('GD 同 ID 取流暂不可用，尝试匹配备用平台:', error);
      }
    }
    if (!sourceName || !artistNames.length) return null;
    const sources: MusicSourceType[] = hasNeteaseId ? ['joox'] : ['netease', 'joox'];
    for (const source of sources) {
      signal.throwIfAborted();
      try {
        const results = await requestGD(
          {
            types: 'search',
            source,
            name: [song.name, ...artistNames].join(' '),
            count: '5',
            pages: '1'
          },
          signal
        );
        // 不能取搜索第一项：同名翻唱、现场版可能有不同的歌手和时长。
        const matched = Array.isArray(results)
          ? results.find((item: any) => {
              const targetArtists = (
                Array.isArray(item.artist) ? item.artist : [item.artist || '']
              ).map(normalizeText);
              return (
                normalizeText(item.name || '') === sourceName &&
                artistNames.every((artist: string) =>
                  targetArtists.includes(normalizeText(artist))
                ) &&
                (!item.source || item.source === source)
              );
            })
          : undefined;
        if (!matched?.id) continue;
        const result = wrapResult(
          await requestGD({ types: 'url', source, id: String(matched.id), br: quality }, signal)
        );
        if (result) return result;
      } catch (error) {
        signal.throwIfAborted();
        console.warn(`GD ${source} 音源暂不可用:`, error);
      }
    }
  } catch (error) {
    playbackSignal?.throwIfAborted();
    console.warn('GD 音乐台暂未取得匹配的完整音频:', error);
  }
  return null;
};
