import { cloneDeep } from 'lodash';
import { createDiscreteApi } from 'naive-ui';

import i18n from '@/../i18n/renderer';
import { getMusicLrc, getMusicUrl, getParsingMusicUrl } from '@/api/music';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { SongSourceConfigManager } from '@/services/SongSourceConfigManager';
import type { ILyric, ILyricText, IWordData, SongResult } from '@/types/music';
import { getImgUrl, isElectron } from '@/utils';
import { getImageLinearBackground } from '@/utils/linearColor';
import request from '@/utils/request';
import { parseLyrics as parseYrcLyrics } from '@/utils/yrcParser';

const { message } = createDiscreteApi(['message']);
const MIN_PLAYABLE_AUDIO_BYTES = 1024 * 1024;
const MIN_PLAYABLE_AUDIO_SECONDS = 60;
const STABLE_URL_TTL_MS = 30 * 60 * 1000;
const TEMPORARY_URL_TTL_MS = 3 * 60 * 1000;

type DiskCacheResolveResult = {
  url?: string;
  cached?: boolean;
  queued?: boolean;
};

const getSongArtistText = (songData: SongResult): string => {
  if (songData?.ar?.length) {
    return songData.ar.map((artist) => artist.name).join(' / ');
  }

  if (songData?.song?.artists?.length) {
    return songData.song.artists.map((artist) => artist.name).join(' / ');
  }

  return '';
};

const normalizeMatchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[《》<>「」『』"'“”‘’()[\]（）【】\-_.·]/g, '');

const isTemporaryPlaybackUrl = (url?: string) => {
  if (!url || !/^https?:\/\//i.test(url)) return false;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return (
      hostname.includes('kuwo.cn') ||
      hostname.includes('kwcdn.kuwo.cn') ||
      hostname.includes('migu') ||
      hostname.includes('kugou') ||
      hostname.includes('bilivideo.com') ||
      parsedUrl.searchParams.has('token') ||
      parsedUrl.searchParams.has('expires') ||
      parsedUrl.searchParams.has('expire') ||
      parsedUrl.searchParams.has('auth_key')
    );
  } catch {
    return true;
  }
};

const getPlaybackUrlTtl = (song: SongResult, url?: string) =>
  song.source === 'kuwo' || isTemporaryPlaybackUrl(url) ? TEMPORARY_URL_TTL_MS : STABLE_URL_TTL_MS;

const shouldReuseExistingPlaybackUrl = (song: SongResult) => {
  if (!song.playMusicUrl) return false;
  if (song.playMusicUrl.startsWith('local://')) return true;
  if (!song.expiredAt) return false;
  return song.expiredAt > Date.now();
};

const mapNeteaseSongResult = (song: any): SongResult => {
  const artists = song.ar || song.artists || song.song?.artists || [];
  const album = song.al || song.album || { id: 0, name: '', picUrl: song.picUrl || '' };
  return {
    ...song,
    picUrl: album.picUrl || song.picUrl || '',
    ar: artists,
    artists,
    al: album,
    album,
    song: {
      ...(song.song || {}),
      id: song.id,
      name: song.name,
      artists,
      album
    },
    source: 'netease',
    count: song.count || 0,
    duration: song.duration || song.dt,
    dt: song.dt || song.duration
  };
};

const resolveNeteaseFallbackSong = async (songData: SongResult): Promise<SongResult | null> => {
  if (songData.source !== 'kuwo') return null;

  const artistText = getSongArtistText(songData);
  const keyword = [songData.name, artistText].filter(Boolean).join(' ').trim();
  if (!keyword) return null;

  try {
    const response = await request.get<any>('/cloudsearch', {
      params: {
        keywords: keyword,
        type: 1,
        limit: 10,
        offset: 0
      }
    });
    const songs = response.data?.result?.songs || [];
    if (!Array.isArray(songs) || songs.length === 0) return null;

    const sourceName = normalizeMatchText(songData.name || '');
    const sourceArtist = normalizeMatchText(artistText);
    const matched =
      songs.find((song: any) => {
        const targetName = normalizeMatchText(song.name || '');
        const targetArtist = normalizeMatchText(
          (song.ar || song.artists || []).map((artist: any) => artist.name).join('')
        );
        return (
          (targetName.includes(sourceName) || sourceName.includes(targetName)) &&
          (!sourceArtist ||
            targetArtist.includes(sourceArtist) ||
            sourceArtist.includes(targetArtist))
        );
      }) || songs[0];

    // 根因：酷我搜索结果的 id 是酷我曲库 id，不是网易云 id。酷我直链被判定为
    // 试听/错误文件后，如果继续拿酷我 id 调 /song/url 或 GD/pyncmd 这类网易源，
    // 必然拿不到可播地址。这里用歌名 + 歌手回查本地后端，拿到网易云等价歌曲后再兜底解析。
    return mapNeteaseSongResult(matched);
  } catch (error) {
    console.warn('酷我歌曲回查网易云等价歌曲失败，继续使用原始歌曲信息兜底。', error);
    return null;
  }
};

const resolveCachedPlaybackUrl = async (
  url: string | null | undefined,
  songData: SongResult
): Promise<string | null | undefined> => {
  if (!url || !isElectron || !/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    const result = (await window.electron.ipcRenderer.invoke('resolve-cached-music-url', {
      songId: Number(songData.id),
      source: songData.source,
      url,
      title: songData.name,
      artist: getSongArtistText(songData)
    })) as DiskCacheResolveResult;

    if (result?.url) {
      return result.url;
    }
  } catch (error) {
    console.warn('解析缓存播放地址失败，回退到在线地址:', error);
  }

  return url;
};

const isPlaybackDetailPlayable = (detail: any) => {
  if (!detail?.url) return false;
  const size = Number(detail.size || 0);
  const durationSeconds = Number(detail.time || 0) / 1000;
  const hasTrialFlag = Boolean(detail.freeTrialInfo || detail.freeTrialPrivilege?.resConsumable);

  return !(
    hasTrialFlag ||
    (Number.isFinite(size) && size > 0 && size < MIN_PLAYABLE_AUDIO_BYTES) ||
    (Number.isFinite(durationSeconds) &&
      durationSeconds > 0 &&
      durationSeconds < MIN_PLAYABLE_AUDIO_SECONDS)
  );
};

const resolvePlayableUrl = async (
  detail: any,
  songData: SongResult
): Promise<string | null | undefined> => {
  if (!isPlaybackDetailPlayable(detail)) return null;
  return await resolveCachedPlaybackUrl(detail.url, songData);
};

/**
 * 获取歌曲播放URL（独立函数）
 */
export const getSongUrl = async (
  id: string | number,
  songData: SongResult,
  isDownloaded: boolean = false,
  requestId?: string
) => {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  // 动态导入 settingsStore
  const { useSettingsStore } = await import('@/store/modules/settings');
  const settingsStore = useSettingsStore();
  let skipKuwoForFallback = false;
  const runFallbackParsing = async () => {
    const previousConfig = SongSourceConfigManager.getConfig(id);
    const configuredFallbackSources = (
      previousConfig?.sources ||
      settingsStore.setData.enabledMusicSources ||
      []
    ).filter((source: string) => source !== 'kuwo');
    const baseFallbackSources =
      configuredFallbackSources.length > 0
        ? configuredFallbackSources
        : ['migu', 'kugou', 'pyncmd'];
    const fallbackSources = [
      'gdmusic',
      ...baseFallbackSources.filter((source: string) => source !== 'gdmusic')
    ];
    const neteaseFallbackSong =
      skipKuwoForFallback && songData.source === 'kuwo'
        ? await resolveNeteaseFallbackSong(songData)
        : null;
    const fallbackSongData: SongResult =
      skipKuwoForFallback && neteaseFallbackSong
        ? neteaseFallbackSong
        : skipKuwoForFallback
          ? {
              ...songData,
              source: 'netease'
            }
          : songData;
    const fallbackId = skipKuwoForFallback && neteaseFallbackSong ? neteaseFallbackSong.id : id;
    const fallbackNumericId =
      typeof fallbackId === 'string' ? parseInt(fallbackId, 10) : fallbackId;
    const previousFallbackConfig = SongSourceConfigManager.getConfig(fallbackId);
    // 根因：酷我搜索结果的 id 不是网易云 id，且网易官方接口也可能只返回 30 秒试听。
    // 如果备用解析仍按用户全局配置从酷我或单一 unblock 源开始，就会反复拿到坏 URL。
    // 这里临时把本次歌曲的备用解析顺序固定为 GD 音乐台优先，再试其它解析源；
    // 解析完成后恢复用户原来的单曲配置，避免污染手动音源设置。
    SongSourceConfigManager.setConfig(fallbackId, fallbackSources as any, 'auto');
    try {
      return await getParsingMusicUrl(fallbackNumericId, cloneDeep(fallbackSongData));
    } finally {
      if (previousFallbackConfig) {
        SongSourceConfigManager.setConfig(
          fallbackId,
          previousFallbackConfig.sources,
          previousFallbackConfig.type
        );
      } else {
        SongSourceConfigManager.clearConfig(fallbackId);
      }
    }
  };

  try {
    // 在开始处理前验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongUrl] 请求已失效: ${requestId}`);
      throw new Error('Request cancelled');
    }

    if (shouldReuseExistingPlaybackUrl(songData)) {
      if (isDownloaded) return songData.playMusicUrl;
      return await resolveCachedPlaybackUrl(songData.playMusicUrl, songData);
    }

    if (songData.source === 'kuwo') {
      try {
        const { getKuwoMusicUrl } = await import('@/api/kuwo');
        const kuwoResult = await getKuwoMusicUrl(numericId);

        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          console.log(`[getSongUrl] 酷我直链接析后请求已失效: ${requestId}`);
          throw new Error('Request cancelled');
        }

        if (kuwoResult.data?.data?.url) {
          if (isDownloaded) return kuwoResult.data.data as any;
          return await resolveCachedPlaybackUrl(kuwoResult.data.data.url, songData);
        }
      } catch (error) {
        if ((error as Error).message === 'Request cancelled') {
          throw error;
        }
        console.warn('酷我直链接析失败，继续进入备用解析流程:', error);
        skipKuwoForFallback = true;
      }
    }

    // ==================== 自定义API最优先 ====================
    const globalSources = settingsStore.setData.enabledMusicSources || [];
    const useCustomApiGlobally = globalSources.includes('custom');

    const songConfig = SongSourceConfigManager.getConfig(id);
    const useCustomApiForSong = songConfig?.sources.includes('custom' as any) ?? false;

    // 如果全局或歌曲专属设置中启用了自定义API，则最优先尝试
    if ((useCustomApiGlobally || useCustomApiForSong) && settingsStore.setData.customApiPlugin) {
      console.log(`优先级 1: 尝试使用自定义API解析歌曲 ${id}...`);
      try {
        const { parseFromCustomApi } = await import('@/api/parseFromCustomApi');
        const customResult = await parseFromCustomApi(
          numericId,
          cloneDeep(songData),
          settingsStore.setData.musicQuality || 'higher'
        );

        // 验证请求
        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          console.log(`[getSongUrl] 自定义API解析后请求已失效: ${requestId}`);
          throw new Error('Request cancelled');
        }

        if (
          customResult &&
          customResult.data &&
          customResult.data.data &&
          customResult.data.data.url
        ) {
          console.log('自定义API解析成功！');
          if (isDownloaded) return customResult.data.data as any;
          const playableUrl = await resolvePlayableUrl(customResult.data.data, songData);
          if (playableUrl) return playableUrl;
          console.warn('自定义API返回疑似试听或错误文件，继续使用默认降级流程。');
        } else {
          console.log('自定义API解析失败，将使用默认降级流程...');
          message.warning(i18n.global.t('player.reparse.customApiFailed'));
        }
      } catch (error) {
        console.error('调用自定义API时发生错误:', error);
        if ((error as Error).message === 'Request cancelled') {
          throw error;
        }
        message.error(i18n.global.t('player.reparse.customApiError'));
      }
    }

    // 如果有自定义音源设置，直接使用getParsingMusicUrl获取URL
    if (songConfig) {
      try {
        console.log(`使用自定义音源解析歌曲 ID: ${id}`);
        const res = await runFallbackParsing();
        console.log('res', res);

        // 验证请求
        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          console.log(`[getSongUrl] 自定义音源解析后请求已失效: ${requestId}`);
          throw new Error('Request cancelled');
        }

        if (res && res.data && res.data.data && res.data.data.url) {
          const playableUrl = await resolvePlayableUrl(res.data.data, songData);
          if (playableUrl) return playableUrl;
          console.warn('自定义音源返回疑似试听或错误文件，使用默认音源。');
        }
        console.warn('自定义音源解析失败，使用默认音源');
      } catch (error) {
        console.error('error', error);
        if ((error as Error).message === 'Request cancelled') {
          throw error;
        }
        console.error('自定义音源解析出错:', error);
      }
    }

    // 正常获取URL流程
    const { data } = await getMusicUrl(numericId, isDownloaded);

    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongUrl] 获取官方URL后请求已失效: ${requestId}`);
      throw new Error('Request cancelled');
    }

    if (data && data.data && data.data[0]) {
      const songDetail = data.data[0];
      const hasNoUrl = !songDetail.url;
      const isTrial = !isPlaybackDetailPlayable(songDetail);

      if (hasNoUrl || isTrial) {
        console.log(`官方URL无效 (无URL: ${hasNoUrl}, 试听: ${isTrial})，进入内置备用解析...`);
        const res = await runFallbackParsing();
        // 验证请求
        if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
          console.log(`[getSongUrl] 备用解析后请求已失效: ${requestId}`);
          throw new Error('Request cancelled');
        }
        if (isDownloaded) return res?.data?.data as any;
        const playableUrl = await resolvePlayableUrl(res?.data?.data, songData);
        return playableUrl || null;
      }

      console.log('官方API解析成功！');
      if (isDownloaded) return songDetail as any;
      return await resolveCachedPlaybackUrl(songDetail.url, songData);
    }

    console.log('官方API返回数据结构异常，进入内置备用解析...');
    const res = await runFallbackParsing();
    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongUrl] 备用解析后请求已失效: ${requestId}`);
      throw new Error('Request cancelled');
    }
    if (isDownloaded) return res?.data?.data as any;
    const playableUrl = await resolvePlayableUrl(res?.data?.data, songData);
    return playableUrl || null;
  } catch (error) {
    if ((error as Error).message === 'Request cancelled') {
      throw error;
    }
    console.error('官方API请求失败，进入内置备用解析流程:', error);
    const res = await runFallbackParsing();
    if (isDownloaded) return res?.data?.data as any;
    const playableUrl = await resolvePlayableUrl(res?.data?.data, songData);
    return playableUrl || null;
  }
};

/**
 * useSongUrl hook（兼容旧代码）
 */
export const useSongUrl = () => {
  return { getSongUrl };
};

/**
 * 使用新的yrcParser解析歌词（独立函数）
 */
export const parseRawLyrics = (lyricsString: string): { lyrics: ILyricText[]; times: number[] } => {
  if (!lyricsString || typeof lyricsString !== 'string') {
    return { lyrics: [], times: [] };
  }

  try {
    const parseResult = parseYrcLyrics(lyricsString);

    if (!parseResult.success) {
      console.error('歌词解析失败:', parseResult.error.message);
      return { lyrics: [], times: [] };
    }

    const { lyrics: parsedLyrics } = parseResult.data;
    const lyrics: ILyricText[] = [];
    const times: number[] = [];

    for (const line of parsedLyrics) {
      // 检查是否有逐字歌词
      const hasWords = line.words && line.words.length > 0;

      lyrics.push({
        text: line.fullText,
        trText: '', // 翻译文本稍后处理
        words: hasWords ? (line.words as IWordData[]) : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      // 时间数组使用秒为单位（与原有逻辑保持一致）
      times.push(line.startTime / 1000);
    }

    return { lyrics, times };
  } catch (error) {
    console.error('解析歌词时发生错误:', error);
    return { lyrics: [], times: [] };
  }
};

/**
 * 加载歌词（独立函数）
 */
export const loadLrc = async (id: string | number): Promise<ILyric> => {
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    let lyricData: any;

    if (isElectron) {
      try {
        lyricData = await window.electron.ipcRenderer.invoke('get-cached-lyric', numericId);
      } catch (error) {
        console.warn('读取磁盘歌词缓存失败:', error);
      }
    }

    if (!lyricData) {
      const { data } = await getMusicLrc(numericId);
      lyricData = data;

      if (isElectron && lyricData) {
        void window.electron.ipcRenderer
          .invoke('cache-lyric', numericId, lyricData)
          .catch((error) => console.warn('写入磁盘歌词缓存失败:', error));
      }
    }

    const data = lyricData ?? {};
    const { lyrics, times } = parseRawLyrics(data?.yrc?.lyric || data?.lrc?.lyric);

    // 检查是否有逐字歌词
    let hasWordByWord = false;
    for (const lyric of lyrics) {
      if (lyric.hasWordByWord) {
        hasWordByWord = true;
        break;
      }
    }

    if (data.tlyric && data.tlyric.lyric) {
      const { lyrics: tLyrics } = parseRawLyrics(data.tlyric.lyric);

      // 按索引顺序一一对应翻译歌词
      if (tLyrics.length === lyrics.length) {
        // 数量相同，直接按索引对应
        lyrics.forEach((item, index) => {
          item.trText = item.text && tLyrics[index] ? tLyrics[index].text : '';
        });
      } else {
        // 数量不同，构建时间戳映射并尝试匹配
        const tLyricMap = new Map<number, string>();
        tLyrics.forEach((lyric) => {
          if (lyric.text && lyric.startTime !== undefined) {
            const timeInSeconds = lyric.startTime / 1000;
            tLyricMap.set(timeInSeconds, lyric.text);
          }
        });

        // 为每句歌词查找最接近的翻译
        lyrics.forEach((item, index) => {
          if (!item.text) {
            item.trText = '';
            return;
          }

          const currentTime = times[index];
          let closestTime = -1;
          let minDiff = 2.0; // 最大允许差异2秒

          // 查找最接近的时间戳
          for (const [tTime] of tLyricMap.entries()) {
            const diff = Math.abs(tTime - currentTime);
            if (diff < minDiff) {
              minDiff = diff;
              closestTime = tTime;
            }
          }

          item.trText = closestTime !== -1 ? tLyricMap.get(closestTime) || '' : '';
        });
      }
    } else {
      // 没有翻译歌词，清空 trText
      lyrics.forEach((item) => {
        item.trText = '';
      });
    }

    return {
      lrcTimeArray: times,
      lrcArray: lyrics,
      hasWordByWord
    };
  } catch (err) {
    console.error('Error loading lyrics:', err);
    return {
      lrcTimeArray: [],
      lrcArray: [],
      hasWordByWord: false
    };
  }
};

/**
 * useLyrics hook（兼容旧代码）
 */
export const useLyrics = () => {
  return { loadLrc, parseLyrics: parseRawLyrics };
};

/**
 * 获取歌曲详情
 */
export const useSongDetail = () => {
  const { getSongUrl } = useSongUrl();

  const getSongDetail = async (playMusic: SongResult, requestId?: string) => {
    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongDetail] 请求已失效: ${requestId}`);
      throw new Error('Request cancelled');
    }

    if (playMusic.expiredAt && playMusic.expiredAt < Date.now()) {
      // 本地音乐（local:// 协议）不会过期，跳过清除
      if (!playMusic.playMusicUrl?.startsWith('local://')) {
        console.info(`歌曲已过期，重新获取: ${playMusic.name}`);
        playMusic.playMusicUrl = undefined;
      }
    }

    try {
      const playMusicUrl =
        playMusic.playMusicUrl || (await getSongUrl(playMusic.id, playMusic, false, requestId));

      // 验证请求
      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        console.log(`[getSongDetail] URL获取后请求已失效: ${requestId}`);
        throw new Error('Request cancelled');
      }

      playMusic.createdAt = Date.now();
      playMusic.expiredAt = playMusic.createdAt + getPlaybackUrlTtl(playMusic, playMusicUrl);
      const backgroundColor = playMusic.backgroundColor || '';
      const primaryColor = playMusic.primaryColor || '';

      playMusic.playLoading = false;
      return { ...playMusic, playMusicUrl, backgroundColor, primaryColor } as SongResult;
    } catch (error) {
      if ((error as Error).message === 'Request cancelled') {
        throw error;
      }
      console.error('获取音频URL失败:', error);
      playMusic.playLoading = false;
      throw error;
    }
  };

  return { getSongDetail };
};
