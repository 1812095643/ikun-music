import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';

const KUWO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

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

const kuwoRequest = async <T = any>(url: string, timeout = 15000): Promise<T> => {
  if (isElectron && window.api?.lxMusicHttpRequest) {
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

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url.replace(/^http:/, 'https:');
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
    .filter(Boolean);
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
  const url = `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_${rid}&format=mp3&response=json`;
  const response = await kuwoRequest<any>(url, 12000);
  const musicUrl = typeof response === 'string' ? JSON.parse(response)?.url : response?.url;

  if (!musicUrl) {
    throw new Error(`酷我播放地址解析失败：${rid}`);
  }

  return {
    data: {
      code: 200,
      message: 'success',
      data: {
        url: normalizeImageUrl(musicUrl),
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
  const url = `http://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=1&rn=${limit}&order=hot`;
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
        songCount: parseNumber(response?.TOTAL, songs.length)
      }
    }
  };
};
