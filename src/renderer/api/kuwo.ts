import type { SongResult } from '@/types/music';
import { isDesktopRuntime } from '@/utils';
import { type DownloadQualityKey, getKuwoDownloadQuality } from '@/utils/downloadQuality';

import { assertExternalOk, requestExternalMusic } from './externalMusicRequest';

const KUWO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const KUWO_MAX_ATTEMPTS = 3;
const KUWO_RETRY_BASE_DELAY = 700;
const KUWO_MIN_PLAYABLE_BYTES = 1024 * 1024;

interface KuwoHttpResponse<T = any> {
  statusCode: number;
  body: T;
}

interface KuwoPlaylistItem {
  id: string;
  name: string;
  img: string;
  uname?: string;
  uid?: string;
  desc?: string;
  info?: string;
  total?: string;
  listencnt?: string;
  digest?: string;
}

interface KuwoRankItem {
  bangId?: string | number;
  id?: string | number;
  name?: string;
  bangName?: string;
  pic?: string;
  img?: string;
  cover?: string;
  updateTime?: string;
  updateFrequency?: string;
  intro?: string;
  desc?: string;
  songList?: KuwoSongItem[];
  musicList?: KuwoSongItem[];
  songs?: KuwoSongItem[];
}

interface KuwoSongItem {
  id?: string;
  MUSICRID?: string;
  DC_TARGETID?: string;
  name?: string;
  NAME?: string;
  SONGNAME?: string;
  artist?: string;
  ARTIST?: string;
  artistid?: string;
  ARTISTID?: string;
  album?: string;
  ALBUM?: string;
  albumid?: string;
  ALBUMID?: string;
  albumpic?: string;
  pic?: string;
  web_albumpic_short?: string;
  duration?: string;
  DURATION?: string;
  hasmv?: string;
  MVFLAG?: string;
  mvpayinfo?: { vid?: string | number };
  payInfo?: { feeType?: { song?: string; vip?: string } };
}

interface KuwoArtistItem {
  ARTISTID?: string;
  ARTIST?: string;
  AARTIST?: string;
  DC_TARGETID?: string;
  PICPATH?: string;
  hts_PICPATH?: string;
  BASEPICPATH?: string;
  SONGNUM?: string;
  ALBUMNUM?: string;
  MVNUM?: string;
  COUNTRY?: string;
  desc?: string;
}

const buildRequestId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const waitForRetry = (attempt: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, KUWO_RETRY_BASE_DELAY * attempt);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('请求已取消', 'AbortError'));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });

const requestKuwoOnce = async <T = any>(
  url: string,
  timeout = 15000,
  signal?: AbortSignal
): Promise<T> => {
  signal?.throwIfAborted();
  if (isDesktopRuntime && window.desktop?.lxMusicHttpRequest) {
    const requestId = buildRequestId();
    const abort = () => window.desktop.lxMusicHttpCancel(requestId);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = (await window.desktop.lxMusicHttpRequest({
        url,
        requestId,
        options: {
          method: 'GET',
          timeout,
          headers: {
            Accept: 'application/json,text/plain,*/*',
            Referer: 'http://www.kuwo.cn/',
            'User-Agent': KUWO_USER_AGENT
          }
        }
      })) as KuwoHttpResponse<T>;

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`酷我接口请求失败：HTTP ${response.statusCode}`);
      }
      return response.body;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json,text/plain,*/*',
      Referer: 'http://www.kuwo.cn/',
      'User-Agent': KUWO_USER_AGENT
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`酷我接口请求失败：HTTP ${response.status}`);
  return (await response.json()) as T;
};

const requestKuwoPublic = async <T = any>(
  url: string,
  timeout = 15000,
  headers: Record<string, string> = {}
): Promise<T> => {
  const response = await requestExternalMusic<T>(url, {
    timeout,
    requestPrefix: 'kuwo-public',
    headers: {
      Referer: 'https://www.kuwo.cn/',
      ...headers
    }
  });
  return assertExternalOk(response, '酷我公开接口');
};

const requestKuwoHead = async (url: string, timeout = 8000) => {
  if (isDesktopRuntime && window.desktop?.lxMusicHttpRequest) {
    return (await window.desktop.lxMusicHttpRequest({
      url,
      requestId: buildRequestId(),
      options: {
        method: 'HEAD',
        timeout,
        headers: {
          Referer: 'http://www.kuwo.cn/',
          'User-Agent': KUWO_USER_AGENT
        }
      }
    })) as KuwoHttpResponse;
  }

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      Referer: 'http://www.kuwo.cn/',
      'User-Agent': KUWO_USER_AGENT
    },
    signal: AbortSignal.timeout(timeout)
  });

  return {
    statusCode: response.status,
    body: undefined,
    headers: Object.fromEntries(response.headers.entries())
  } as KuwoHttpResponse & { headers?: Record<string, string> };
};

const kuwoRequest = async <T = any>(
  url: string,
  timeout = 15000,
  maxAttempts = KUWO_MAX_ATTEMPTS,
  signal?: AbortSignal
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestKuwoOnce<T>(url, timeout, signal);
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`酷我接口请求第 ${attempt} 次失败，准备重试。`, error);
        await waitForRetry(attempt, signal);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeImageUrl = (url?: string) => {
  if (!url) return '';
  const trimmedUrl = url.trim();

  // 根因：酷我部分封面来自 img*.kwcdn.kuwo.cn，该 CDN 的 HTTPS 证书在桌面端校验失败，
  // 之前统一把 http 改成 https 会让这些封面直接加载失败；因此 kwcdn 保留原始 HTTP，
  // 其它可正常走 HTTPS 的酷我图片仍升级协议，兼顾可用性与安全性。
  if (trimmedUrl.startsWith('//')) return `https:${trimmedUrl}`;
  if (/^http:\/\/img\d+\.kwcdn\.kuwo\.cn/i.test(trimmedUrl)) return trimmedUrl;
  return trimmedUrl.replace(/^http:/, 'https:');
};

const normalizeKuwoArtistImage = (item: KuwoArtistItem) => {
  const pic = item.hts_PICPATH || item.PICPATH;
  if (!pic) return '';
  if (/^https?:\/\//i.test(pic)) return normalizeImageUrl(pic);

  const base = item.BASEPICPATH || 'http://img1.kuwo.cn/star/starheads/';
  return normalizeImageUrl(`${base.replace(/\/?$/, '/')}${pic.replace(/^\/+/, '')}`);
};

const normalizeKuwoAlbumImage = (song: KuwoSongItem) => {
  const rawImage = song.albumpic || song.pic || song.web_albumpic_short;
  if (!rawImage) return '';
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith('//')) {
    return normalizeImageUrl(rawImage);
  }

  return normalizeImageUrl(
    `http://img1.kwcdn.kuwo.cn/star/albumcover/${rawImage.replace(/^\/+/, '')}`
  );
};

const normalizePlaybackUrl = (url?: string) => {
  if (!url) return '';
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith('//')) return `https:${trimmedUrl}`;
  return trimmedUrl;
};

const extractKuwoPlaybackUrl = (response: any) => {
  const payload = typeof response === 'string' ? JSON.parse(response) : response;
  return normalizePlaybackUrl(payload?.data?.url || payload?.url);
};

const getNativeKuwoMusicUrl = async (rid: string, quality: string, signal?: AbortSignal) => {
  const { requestMusicService } = await import('@/services/musicService');
  signal?.throwIfAborted();
  // 安卓包 libmod_gushi.so 使用 nmobi 加密取流。网页 playUrl/anti.s 会返回提示音，
  // 不能当成同一接口；加密复用随包依赖，网络仍走可取消的原生 HTTP 通道。
  const request = await requestMusicService('/desktop/kuwo-playback-request', {
    id: rid,
    quality
  });
  signal?.throwIfAborted();
  if (request.status !== 200 || !request.body?.url) {
    throw new Error('酷我取流请求暂未就绪');
  }
  // 相同加密参数配上浏览器 UA 会被返回 type=1 的替代音频；此路必须使用原生客户端标识。
  const response = assertExternalOk(
    await requestExternalMusic<string>(request.body.url, {
      timeout: 7000,
      signal,
      requestPrefix: 'kuwo-native',
      headers: { 'User-Agent': 'okhttp/3.10.0' }
    }),
    '酷我原生取流'
  );
  // 原接口是逐行 key=value，URL 内还有等号和 $，只能拆每行第一个等号。
  const fields = Object.fromEntries(
    String(response)
      .split(/\r?\n/)
      .flatMap((line) => {
        const index = line.indexOf('=');
        return index > 0 ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
      })
  );
  if (fields.rid && fields.rid !== rid) throw new Error('酷我返回的歌曲与请求不一致');
  const url = normalizePlaybackUrl(fields.url);
  if (!/^https?:\/\//i.test(url)) throw new Error('酷我暂未返回播放地址');
  return { url, type: fields.format, bitrate: Number(fields.bitrate) * 1000 || undefined };
};

const assertPlayableKuwoUrl = async (url: string) => {
  try {
    const response = await requestKuwoHead(url, 8000);
    const contentLength = Number((response as any)?.headers?.['content-length']);
    if (
      Number.isFinite(contentLength) &&
      contentLength > 0 &&
      contentLength < KUWO_MIN_PLAYABLE_BYTES
    ) {
      throw new Error(`酷我播放地址疑似试听或错误文件，大小仅 ${contentLength} 字节`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('疑似试听或错误文件')) {
      throw error;
    }
    // HEAD/Range 校验失败不能直接否定可播性，网络/CDN 偶发拒绝探测时仍交给播放器尝试。
    console.warn('酷我播放地址大小校验失败，继续尝试播放。', error);
  }
};

const getKuwoSongId = (song: KuwoSongItem) => {
  const musicRid = song.MUSICRID?.replace(/^MUSIC_/i, '');
  return parseNumber(song.id || musicRid || song.DC_TARGETID);
};

const createArtist = (id: number, name: string) =>
  ({
    id,
    name,
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  }) as any;

const createAlbum = (id: number, name: string, picUrl: string) =>
  ({
    id,
    name,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: picUrl,
    companyId: 0,
    pic: 0,
    picUrl,
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: createArtist(0, ''),
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists: [],
    subType: '',
    onSale: false,
    mark: 0,
    picId_str: ''
  }) as any;

const splitArtists = (artistText?: string, artistId?: string) => {
  const names = (artistText || '未知歌手')
    .split(/&|、|\/|;/)
    .map((name) => name.trim())
    .filter((name): name is string => Boolean(name));
  const ids = (artistId || '').split(',');
  return names.map((name, index) => createArtist(parseNumber(ids[index], 0), name));
};

export const mapKuwoSong = (song: KuwoSongItem): SongResult => {
  const id = getKuwoSongId(song);
  // SONGNAME 包含 Live 等版本信息，NAME 往往仅保留主标题，不能丢失版本后混用歌词。
  const name = song.name || song.SONGNAME || song.NAME || '未知歌曲';
  const artists = splitArtists(song.artist || song.ARTIST, song.artistid || song.ARTISTID);
  const albumName = song.album || song.ALBUM || '酷我音乐';
  const albumId = parseNumber(song.albumid || song.ALBUMID);
  // 搜索接口当前稳定返回 web_albumpic_short（相对路径），旧字段 albumpic/pic 只在部分接口存在。
  // 未拼接相对路径时，前端会拿到空 picUrl，搜索列表因此完全不渲染封面。
  const picUrl = normalizeKuwoAlbumImage(song);
  const duration = parseNumber(song.duration || song.DURATION) * 1000;
  const mvId = parseNumber(song.mvpayinfo?.vid || 0);
  const mvFlag = parseNumber(song.hasmv || song.MVFLAG || mvId);
  const isVip = song.payInfo?.feeType?.song === '1' || song.payInfo?.feeType?.vip === '1';

  const album = createAlbum(albumId, albumName, picUrl);

  return {
    id,
    name: name.replace(/&nbsp;/g, ' '),
    picUrl,
    ar: artists,
    artists,
    al: album,
    album,
    count: 0,
    duration,
    dt: duration,
    source: 'kuwo',
    song: {
      id,
      name,
      artists,
      fee: isVip ? 1 : 0,
      mv: mvFlag
    }
  };
};

export const getKuwoMusicUrl = async (
  id: number | string,
  quality?: DownloadQualityKey | string,
  signal?: AbortSignal
) => {
  const rid = String(id).replace(/^MUSIC_/i, '');
  const qualityOption = getKuwoDownloadQuality(quality);
  if (isDesktopRuntime) {
    try {
      const result = await getNativeKuwoMusicUrl(rid, qualityOption.apiType, signal);
      return {
        data: {
          code: 200,
          message: 'success',
          data: {
            ...result,
            type: result.type || qualityOption.extension,
            source: 'kuwo',
            quality: qualityOption.key,
            qualityLabel: qualityOption.label
          }
        }
      };
    } catch (error) {
      signal?.throwIfAborted();
      console.warn('酷我原生取流暂不可用，尝试兼容接口。', error);
    }
  }
  const documentedUrl = `https://api.kuwo.cn/api/v1/www/music/playUrl?mid=${rid}&type=${qualityOption.apiType}&httpsStatus=1&plat=pc`;
  const fallbackFormat = qualityOption.extension === 'flac' ? 'flac' : 'mp3';
  const fallbackUrl = `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_${rid}&format=${fallbackFormat}&response=json`;
  let musicUrl = '';
  let lastError: unknown;

  for (let attempt = 1; attempt <= KUWO_MAX_ATTEMPTS; attempt++) {
    try {
      // 根因：用户给的逆向接口文档明确要求酷我播放地址优先走
      // /api/v1/www/music/playUrl，但该外站接口现场验证存在偶发 502。
      // 每轮先试文档接口；如果文档接口不可用，马上切到已验证可返回真实 mp3 的
      // anti.s 兼容接口，避免用户点歌后长时间无声。
      const documentedResponse = await kuwoRequest<any>(documentedUrl, 5000, 1, signal);
      musicUrl = extractKuwoPlaybackUrl(documentedResponse);
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      console.warn(`酷我文档播放地址接口第 ${attempt} 次不可用，准备切换兼容接口。`, error);
    }

    if (musicUrl) break;

    try {
      const fallbackResponse = await kuwoRequest<any>(fallbackUrl, 12000, 1, signal);
      musicUrl = extractKuwoPlaybackUrl(fallbackResponse);
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      console.warn(`酷我兼容播放地址接口第 ${attempt} 次不可用。`, error);
    }

    if (musicUrl) break;
    if (attempt < KUWO_MAX_ATTEMPTS) await waitForRetry(attempt, signal);
  }

  if (!musicUrl) {
    if (lastError) console.warn('酷我播放地址三次解析后仍不可用。', lastError);
    throw new Error(`酷我播放地址解析失败：${rid}`);
  }

  signal?.throwIfAborted();
  // 播放时由音频加载校验可用性，避免每次切歌额外串行等待一次 HEAD。
  if (!signal) await assertPlayableKuwoUrl(musicUrl);

  return {
    data: {
      code: 200,
      message: 'success',
      data: {
        url: musicUrl,
        type: qualityOption.extension,
        source: 'kuwo',
        quality: qualityOption.key,
        qualityLabel: qualityOption.label,
        bitrate: qualityOption.apiType
      }
    }
  };
};

const mapKuwoPlaylist = (item: KuwoPlaylistItem) => ({
  id: parseNumber(item.id),
  name: item.name,
  picUrl: normalizeImageUrl(item.img),
  coverImgUrl: normalizeImageUrl(item.img),
  copywriter: item.desc || item.info || item.uname || '酷我推荐歌单',
  playCount: parseNumber(item.listencnt),
  trackCount: parseNumber(item.total),
  creator: {
    userId: parseNumber(item.uid),
    nickname: item.uname || '酷我音乐',
    avatarUrl: normalizeImageUrl(item.img)
  },
  source: 'kuwo',
  digest: item.digest
});

const mapKuwoRank = (item: KuwoRankItem, index = 0) => {
  const id = parseNumber(item.bangId || item.id, index + 1);
  const name = item.name || item.bangName || `酷我榜单 ${id}`;
  const cover = normalizeImageUrl(item.pic || item.img || item.cover);

  return {
    id,
    name,
    coverImgUrl: cover,
    picUrl: cover,
    updateFrequency: item.updateFrequency || item.updateTime || '实时更新',
    description: item.intro || item.desc || '酷我音乐热门榜单',
    playCount: 0,
    trackCount: 0,
    creator: {
      userId: 0,
      nickname: '酷我音乐',
      avatarUrl: cover
    },
    source: 'kuwo-rank'
  };
};

const normalizeKuwoRankList = (payload: any) => {
  const candidates = [
    payload?.data,
    payload?.data?.data,
    payload?.data?.list,
    payload?.data?.bangMenu,
    payload?.data?.bangList,
    payload?.list,
    payload?.bangMenu,
    payload?.bangList
  ];
  const nestedList = candidates.find((item) => Array.isArray(item));
  if (nestedList) {
    return nestedList
      .flatMap((item: any) => (Array.isArray(item?.list) ? item.list : item))
      .filter(Boolean);
  }
  if (Array.isArray(payload?.data?.child)) return payload.data.child;
  return [];
};

const normalizeKuwoRankSongs = (payload: any) => {
  const candidates = [
    payload?.data?.musicList,
    payload?.data?.songList,
    payload?.data?.songs,
    payload?.musicList,
    payload?.songList,
    payload?.songs
  ];
  const list = candidates.find((item) => Array.isArray(item));
  return Array.isArray(list) ? list : [];
};

export const getKuwoRecommendPlaylists = async (limit = 30) => {
  const url = `https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=1&rn=${limit}&order=hot`;
  // 推荐歌单属于首页非关键数据。外站不可用时应快速回退本地后端，避免三轮重试拖慢首屏。
  const response = await kuwoRequest<any>(url, 5000, 1);
  const list = Array.isArray(response?.data?.data) ? response.data.data : [];
  return {
    data: {
      code: 200,
      result: list.map(mapKuwoPlaylist)
    }
  };
};

export const getKuwoPlaylistDetail = async (id: number | string, page = 0, limit = 1000) => {
  const url = `http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=${id}&pn=${page}&rn=${limit}&encode=utf-8&keyset=pl2012&identity=kuwo&vipver=MUSIC_9.1.1.2_W1&newver=1`;
  const response = await kuwoRequest<any>(url);
  const musicList = Array.isArray(response?.musiclist) ? response.musiclist : [];
  const tracks = musicList.map(mapKuwoSong);
  const cover = normalizeImageUrl(response?.pic);

  return {
    data: {
      code: response?.result === 'ok' ? 200 : 500,
      playlist: {
        id: parseNumber(response?.id || id),
        name: response?.title || '酷我歌单',
        coverImgUrl: cover,
        picUrl: cover,
        description: response?.info || '',
        playCount: parseNumber(response?.playnum),
        trackCount: parseNumber(response?.total || tracks.length, tracks.length),
        creator: {
          userId: parseNumber(response?.uid),
          nickname: response?.uname || '酷我音乐',
          avatarUrl: cover
        },
        tracks,
        trackIds: tracks.map((song) => ({
          id: song.id,
          v: 0,
          t: 0,
          at: 0,
          uid: 0,
          rcmdReason: ''
        })),
        subscribed: false,
        source: 'kuwo'
      },
      privileges: []
    }
  };
};

export const getKuwoRankList = async () => {
  const urls = [
    // 根因：接口文档里的 /api/v1/www/bang/home/bangList 现场返回 502，
    // 但这是用户要求补齐的文档接口，仍然保留为第一优先级；失败后再试
    // 酷我官网榜单菜单接口，最后由调用方回退本地后端榜单，避免排行榜空白。
    'https://api.kuwo.cn/api/v1/www/bang/home/bangList',
    `https://www.kuwo.cn/api/www/bang/bang/bangMenu?httpsStatus=1&reqId=${Date.now()}`
  ];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await requestKuwoPublic<any>(url, 8000);
      if (response?.success === false) throw new Error(response.message || '酷我榜单接口不可用');
      const list = normalizeKuwoRankList(response);
      if (list.length > 0) {
        return {
          data: {
            code: 200,
            list: list.map(mapKuwoRank)
          }
        };
      }
      throw new Error('酷我榜单接口返回为空');
    } catch (error) {
      lastError = error;
      console.warn('酷我榜单接口不可用，准备尝试下一路。', error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const getKuwoRankDetail = async (
  id: number | string,
  rankInfo?: any,
  page = 1,
  limit = 100
) => {
  const urls = [
    `https://api.kuwo.cn/api/v1/www/bang/home/playlist?bangId=${id}&pn=${page}&rn=${limit}`,
    `https://www.kuwo.cn/api/www/bang/bang/musicList?bangId=${id}&pn=${page}&rn=${limit}&httpsStatus=1&reqId=${Date.now()}`
  ];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await requestKuwoPublic<any>(url, 9000);
      if (response?.success === false) throw new Error(response.message || '酷我榜单歌曲不可用');
      const songs = normalizeKuwoRankSongs(response);
      if (songs.length === 0) throw new Error('酷我榜单歌曲返回为空');
      const tracks = songs.map(mapKuwoSong);
      const cover = normalizeImageUrl(
        response?.data?.pic || response?.data?.img || rankInfo?.coverImgUrl || rankInfo?.picUrl
      );

      return {
        data: {
          code: 200,
          playlist: {
            id: parseNumber(id),
            name: response?.data?.name || response?.data?.bangName || rankInfo?.name || '酷我榜单',
            coverImgUrl: cover,
            picUrl: cover,
            description:
              response?.data?.intro || response?.data?.desc || rankInfo?.description || '酷我榜单',
            playCount: parseNumber(response?.data?.playCount || rankInfo?.playCount),
            trackCount: parseNumber(response?.data?.num || tracks.length, tracks.length),
            creator: {
              userId: 0,
              nickname: '酷我音乐',
              avatarUrl: cover
            },
            tracks,
            trackIds: tracks.map((song) => ({
              id: song.id,
              v: 0,
              t: 0,
              at: 0,
              uid: 0,
              rcmdReason: ''
            })),
            subscribed: false,
            source: 'kuwo-rank'
          },
          privileges: []
        }
      };
    } catch (error) {
      lastError = error;
      console.warn('酷我榜单歌曲接口不可用，准备尝试下一路。', error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const searchKuwoSongs = async (
  params: {
    keywords: string;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal
) => {
  const limit = params.limit || 30;
  const page = Math.floor((params.offset || 0) / limit);
  const keyword = encodeURIComponent(params.keywords);
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${keyword}&pn=${page}&rn=${limit}&uid=0&ver=kwplayer_ar_9.2.2.0&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1`;
  const response = await kuwoRequest<any>(url, 15000, KUWO_MAX_ATTEMPTS, signal);
  const songs = Array.isArray(response?.abslist) ? response.abslist.map(mapKuwoSong) : [];

  return {
    data: {
      code: 200,
      result: {
        songs,
        albums: [],
        mvs: [],
        playlists: [],
        djRadios: [],
        songCount: parseNumber(response?.TOTAL, songs.length)
      }
    }
  };
};

const mapKuwoArtist = (artist: KuwoArtistItem) => {
  const id = parseNumber(artist.ARTISTID || artist.DC_TARGETID);
  const name = (artist.ARTIST || artist.AARTIST || '未知歌手').replace(/&nbsp;/g, ' ');
  const picUrl = normalizeKuwoArtistImage(artist);
  const musicSize = parseNumber(artist.SONGNUM);
  const albumSize = parseNumber(artist.ALBUMNUM);
  const mvSize = parseNumber(artist.MVNUM);

  return {
    id,
    name,
    picUrl,
    cover: picUrl,
    avatar: picUrl,
    img1v1Url: picUrl,
    briefDesc: artist.desc || artist.COUNTRY || '',
    musicSize,
    albumSize,
    mvSize,
    alias: artist.AARTIST ? [artist.AARTIST] : [],
    transNames: artist.AARTIST ? [artist.AARTIST] : [],
    source: 'kuwo',
    rawKeyword: name
  };
};

export const searchKuwoArtists = async (params: {
  keywords: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = params.limit || 30;
  const page = Math.floor((params.offset || 0) / limit);
  const keyword = encodeURIComponent(params.keywords);
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${keyword}&pn=${page}&rn=${limit}&uid=0&ver=kwplayer_ar_9.2.2.0&vipver=1&show_copyright_off=1&newver=1&ft=artist&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1`;
  const response = await kuwoRequest<any>(url);
  const artists = Array.isArray(response?.abslist)
    ? response.abslist.map((item: KuwoArtistItem) =>
        mapKuwoArtist({ ...item, BASEPICPATH: item.BASEPICPATH || response?.BASEPICPATH })
      )
    : [];

  return {
    data: {
      code: 200,
      result: {
        songs: [],
        artists,
        albums: [],
        mvs: [],
        playlists: [],
        djRadios: [],
        artistCount: parseNumber(response?.TOTAL, artists.length)
      }
    }
  };
};

export const getKuwoSearchSuggestions = async (keyword: string): Promise<string[]> => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return [];

  // 联想只取十条名称，不能沿用完整搜索每次 15 秒、最多三次的等待预算。
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(normalizedKeyword)}&pn=0&rn=10&ft=music&encoding=utf8&rformat=json&mobi=1`;
  const response = await kuwoRequest<any>(url, 2000, 1);
  const data = {
    result: { songs: Array.isArray(response?.abslist) ? response.abslist.map(mapKuwoSong) : [] }
  };
  const songs = (data.result.songs || []) as SongResult[];
  const names: string[] = songs
    .map((song) => song.name)
    .filter((name): name is string => Boolean(name));

  return [...new Set<string>(names)].slice(0, 10);
};
