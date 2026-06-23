import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import { ensureMusicApiReady } from '@/utils/tauriElectronCompat';

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
  duration?: string;
  DURATION?: string;
  hasmv?: string;
  MVFLAG?: string;
  mvpayinfo?: { vid?: string | number };
  payInfo?: { feeType?: { song?: string; vip?: string } };
}

const buildRequestId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const waitForRetry = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, KUWO_RETRY_BASE_DELAY * attempt));

const requestKuwoOnce = async <T = any>(url: string, timeout = 15000): Promise<T> => {
  if (isElectron && window.api?.lxMusicHttpRequest) {
    await ensureMusicApiReady();
    const response = (await window.api.lxMusicHttpRequest({
      url,
      requestId: buildRequestId(),
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
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json,text/plain,*/*',
      Referer: 'http://www.kuwo.cn/',
      'User-Agent': KUWO_USER_AGENT
    },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`酷我接口请求失败：HTTP ${response.status}`);
  return (await response.json()) as T;
};

const requestKuwoHead = async (url: string, timeout = 8000) => {
  if (isElectron && window.api?.lxMusicHttpRequest) {
    await ensureMusicApiReady();
    return (await window.api.lxMusicHttpRequest({
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
  maxAttempts = KUWO_MAX_ATTEMPTS
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestKuwoOnce<T>(url, timeout);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`酷我接口请求第 ${attempt} 次失败，准备重试。`, error);
        await waitForRetry(attempt);
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
  const name = song.name || song.NAME || song.SONGNAME || '未知歌曲';
  const artists = splitArtists(song.artist || song.ARTIST, song.artistid || song.ARTISTID);
  const albumName = song.album || song.ALBUM || '酷我音乐';
  const albumId = parseNumber(song.albumid || song.ALBUMID);
  const picUrl = normalizeImageUrl(song.albumpic || song.pic);
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

export const getKuwoMusicUrl = async (id: number | string) => {
  const rid = String(id).replace(/^MUSIC_/i, '');
  const documentedUrl = `https://api.kuwo.cn/api/v1/www/music/playUrl?mid=${rid}&type=320kmp3&httpsStatus=1&plat=pc`;
  const fallbackUrl = `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_${rid}&format=mp3&response=json`;
  let musicUrl = '';
  let lastError: unknown;

  for (let attempt = 1; attempt <= KUWO_MAX_ATTEMPTS; attempt++) {
    try {
      // 根因：用户给的逆向接口文档明确要求酷我播放地址优先走
      // /api/v1/www/music/playUrl，但该外站接口现场验证存在偶发 502。
      // 每轮先试文档接口；如果文档接口不可用，马上切到已验证可返回真实 mp3 的
      // anti.s 兼容接口，避免用户点歌后长时间无声。
      const documentedResponse = await kuwoRequest<any>(documentedUrl, 5000, 1);
      musicUrl = extractKuwoPlaybackUrl(documentedResponse);
    } catch (error) {
      lastError = error;
      console.warn(`酷我文档播放地址接口第 ${attempt} 次不可用，准备切换兼容接口。`, error);
    }

    if (musicUrl) break;

    try {
      const fallbackResponse = await kuwoRequest<any>(fallbackUrl, 12000, 1);
      musicUrl = extractKuwoPlaybackUrl(fallbackResponse);
    } catch (error) {
      lastError = error;
      console.warn(`酷我兼容播放地址接口第 ${attempt} 次不可用。`, error);
    }

    if (musicUrl) break;
    if (attempt < KUWO_MAX_ATTEMPTS) await waitForRetry(attempt);
  }

  if (!musicUrl) {
    if (lastError) console.warn('酷我播放地址三次解析后仍不可用。', lastError);
    throw new Error(`酷我播放地址解析失败：${rid}`);
  }

  await assertPlayableKuwoUrl(musicUrl);

  return {
    data: {
      code: 200,
      message: 'success',
      data: {
        url: musicUrl,
        type: 'mp3',
        source: 'kuwo'
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

export const getKuwoRecommendPlaylists = async (limit = 30) => {
  const url = `https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=1&rn=${limit}&order=hot`;
  const response = await kuwoRequest<any>(url);
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

export const searchKuwoSongs = async (params: {
  keywords: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = params.limit || 30;
  const page = Math.floor((params.offset || 0) / limit);
  const keyword = encodeURIComponent(params.keywords);
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${keyword}&pn=${page}&rn=${limit}&uid=0&ver=kwplayer_ar_9.2.2.0&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1`;
  const response = await kuwoRequest<any>(url);
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

export const getKuwoSearchSuggestions = async (keyword: string): Promise<string[]> => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return [];

  const { data } = await searchKuwoSongs({ keywords: normalizedKeyword, limit: 10, offset: 0 });
  const songs = (data.result.songs || []) as SongResult[];
  const names: string[] = songs
    .map((song) => song.name)
    .filter((name): name is string => Boolean(name));

  return [...new Set<string>(names)].slice(0, 10);
};
