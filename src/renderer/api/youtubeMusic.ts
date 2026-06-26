import type { ILyric, SongResult } from '@/types/music';

import { assertExternalOk, requestExternalMusic } from './externalMusicRequest';

const YOUTUBE_MUSIC_KEYS = [
  'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KLET5YdCE',
  'AIzaSyDK3fy_SQYaDcRxFUEBLyCdLpBvXGOq0-0',
  'AIzaSyC3-cjGJaCgMxKlxCvNoxhFB0jtI-O4K3A',
  'AIzaSyAO_FJ2SlqU8Q3ldr2HNN9C5JtAewpvhvA'
];

const WEB_REMIX_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20230306.01.00',
    hl: 'en',
    gl: 'US'
  }
};

const YOUTUBE_SEARCH_PARAMS = {
  songs: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ%3D%3D',
  artists: 'EgWKAQIgAWoKEAMQBBAJEAoQBQ%3D%3D',
  playlists: 'EgWKAQIoAWoKEAMQBBAJEAoQBQ%3D%3D'
};

const ANDROID_MUSIC_CONTEXT = {
  client: {
    clientName: 'ANDROID_MUSIC',
    clientVersion: '5.28.1',
    androidSdkVersion: 30
  }
};

const youtubeRequest = async <T = any>(endpoint: string, body: Record<string, any>) => {
  let lastError: unknown;

  for (const key of YOUTUBE_MUSIC_KEYS) {
    try {
      const response = await requestExternalMusic<T>(
        `https://music.youtube.com/youtubei/v1/${endpoint}?key=${key}&prettyPrint=false`,
        {
          method: 'POST',
          timeout: 15000,
          requestPrefix: `ytmusic-${endpoint}`,
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://music.youtube.com',
            Referer: 'https://music.youtube.com/'
          },
          body: JSON.stringify(body)
        }
      );
      return assertExternalOk(response, `YouTube Music ${endpoint}`);
    } catch (error) {
      lastError = error;
      console.warn(`YouTube Music ${endpoint} 当前 Key 不可用，准备尝试下一个。`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const findObjects = (value: any, predicate: (item: any) => boolean, limit = 30): any[] => {
  const results: any[] = [];
  const visit = (node: any) => {
    if (!node || results.length >= limit) return;
    if (typeof node !== 'object') return;
    if (predicate(node)) results.push(node);
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return results;
};

const getRunsText = (value: any) => {
  if (Array.isArray(value?.runs)) return value.runs.map((run: any) => run.text).join('');
  return value?.simpleText || '';
};

const getRendererText = (renderer: any, index: number) => {
  const columns = renderer?.flexColumns || [];
  const textNode = columns[index]?.musicResponsiveListItemFlexColumnRenderer?.text;
  return getRunsText(textNode);
};

const findVideoId = (renderer: any) =>
  renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
    ?.playNavigationEndpoint?.watchEndpoint?.videoId ||
  renderer?.playlistItemData?.videoId ||
  renderer?.navigationEndpoint?.watchEndpoint?.videoId;

const findBrowseId = (renderer: any) =>
  renderer?.navigationEndpoint?.browseEndpoint?.browseId ||
  renderer?.menu?.menuRenderer?.items?.find((item: any) => item?.menuNavigationItemRenderer)
    ?.menuNavigationItemRenderer?.navigationEndpoint?.browseEndpoint?.browseId;

const findPlaylistId = (renderer: any) =>
  renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
    ?.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId ||
  renderer?.menu?.menuRenderer?.items?.find(
    (item: any) => item?.menuNavigationItemRenderer?.navigationEndpoint?.watchPlaylistEndpoint
  )?.menuNavigationItemRenderer?.navigationEndpoint?.watchPlaylistEndpoint?.playlistId;

const getThumbnailUrl = (renderer: any) =>
  renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at?.(-1)?.url ||
  renderer?.thumbnail?.thumbnails?.at?.(-1)?.url ||
  '';

const stableYoutubeNumericId = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
};

const mapYoutubeSong = (renderer: any): SongResult | null => {
  const videoId = findVideoId(renderer);
  const title = getRendererText(renderer, 0) || renderer?.title?.runs?.[0]?.text;
  if (!videoId || !title) return null;
  const artist = getRendererText(renderer, 1) || 'YouTube Music';
  const album = getRendererText(renderer, 2) || 'YouTube Music';
  const thumbnail = getThumbnailUrl(renderer);

  const artistObject = {
    id: 0,
    name: artist,
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
  };
  const albumObject = {
    id: 0,
    name: album,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: thumbnail,
    companyId: 0,
    pic: 0,
    picUrl: thumbnail,
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artistObject,
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists: [artistObject],
    subType: '',
    onSale: false,
    mark: 0,
    picId_str: ''
  };

  return {
    id: videoId,
    name: title,
    picUrl: thumbnail,
    ar: [artistObject],
    artists: [artistObject],
    al: albumObject,
    album: albumObject,
    count: 0,
    source: 'ytmusic' as any,
    song: {
      id: videoId,
      name: title,
      artists: [artistObject],
      album: albumObject
    }
  };
};

const searchYoutubeMusic = async (keywords: string, limit = 10, params?: string) => {
  // 根因：文档示例里的中文 CN 请求在 2026-06-26 实测返回 INVALID_ARGUMENT。
  // WEB_REMIX + en/US 能稳定返回，查询词仍保留用户输入，作为酷我搜索失败后的补充。
  return await youtubeRequest('search', {
    context: WEB_REMIX_CONTEXT,
    query: keywords,
    ...(params ? { params } : {})
  });
};

export const searchYoutubeMusicSongs = async (keywords: string, limit = 10) => {
  const response = await searchYoutubeMusic(keywords, limit, YOUTUBE_SEARCH_PARAMS.songs);
  const renderers = findObjects(
    response,
    (item) => Boolean(item.musicResponsiveListItemRenderer),
    limit * 2
  ).map((item) => item.musicResponsiveListItemRenderer);
  const songs = renderers.map(mapYoutubeSong).filter((item): item is SongResult => Boolean(item));

  return {
    data: {
      code: 200,
      result: {
        songs: songs.slice(0, limit),
        albums: [],
        artists: [],
        mvs: [],
        playlists: [],
        djRadios: [],
        songCount: songs.length
      }
    }
  };
};

const mapYoutubeArtist = (renderer: any) => {
  const browseId = findBrowseId(renderer);
  const name = getRendererText(renderer, 0) || 'YouTube Music 艺人';
  const desc = getRendererText(renderer, 1);
  const picUrl = getThumbnailUrl(renderer);
  if (!browseId || !name) return null;

  return {
    id: stableYoutubeNumericId(browseId),
    name,
    picUrl,
    cover: picUrl,
    avatar: picUrl,
    img1v1Url: picUrl,
    desc,
    briefDesc: desc,
    musicSize: 0,
    albumSize: 0,
    mvSize: 0,
    alias: [],
    transNames: [],
    source: 'ytmusic',
    browseId,
    rawKeyword: name
  };
};

export const searchYoutubeMusicArtists = async (keywords: string, limit = 10) => {
  const response = await searchYoutubeMusic(keywords, limit, YOUTUBE_SEARCH_PARAMS.artists);
  const renderers = findObjects(
    response,
    (item) => Boolean(item.musicResponsiveListItemRenderer),
    limit * 2
  ).map((item) => item.musicResponsiveListItemRenderer);
  const artists = renderers.map(mapYoutubeArtist).filter(Boolean);

  return {
    data: {
      code: 200,
      result: {
        songs: [],
        artists: artists.slice(0, limit),
        albums: [],
        mvs: [],
        playlists: [],
        djRadios: [],
        artistCount: artists.length
      }
    }
  };
};

const mapYoutubePlaylist = (renderer: any) => {
  const browseId = findBrowseId(renderer);
  const playlistId = findPlaylistId(renderer);
  const title = getRendererText(renderer, 0) || 'YouTube Music 歌单';
  const desc = getRendererText(renderer, 1) || 'YouTube Music';
  const cover = getThumbnailUrl(renderer);
  if (!browseId && !playlistId) return null;

  return {
    id: browseId || `VL${playlistId}`,
    name: title,
    coverImgUrl: cover,
    picUrl: cover,
    playCount: 0,
    trackCount: 0,
    copywriter: desc,
    desc,
    description: desc,
    creator: {
      userId: 0,
      nickname: 'YouTube Music',
      avatarUrl: cover
    },
    source: 'ytmusic-playlist',
    browseId: browseId || `VL${playlistId}`,
    playlistId
  };
};

export const searchYoutubeMusicPlaylists = async (keywords: string, limit = 10) => {
  const response = await searchYoutubeMusic(keywords, limit, YOUTUBE_SEARCH_PARAMS.playlists);
  const renderers = findObjects(
    response,
    (item) => Boolean(item.musicResponsiveListItemRenderer),
    limit * 2
  ).map((item) => item.musicResponsiveListItemRenderer);
  const playlists = renderers.map(mapYoutubePlaylist).filter(Boolean);

  return {
    data: {
      code: 200,
      result: {
        songs: [],
        artists: [],
        albums: [],
        mvs: [],
        playlists: playlists.slice(0, limit),
        djRadios: [],
        playlistCount: playlists.length
      }
    }
  };
};

export const getYoutubeMusicPlayer = async (videoId: string) => {
  return await youtubeRequest('player', {
    context: ANDROID_MUSIC_CONTEXT,
    videoId,
    playbackContext: {
      contentPlaybackContext: {
        signatureTimestamp: 19369
      }
    }
  });
};

export const getYoutubeMusicUrl = async (videoId: string) => {
  const response = await getYoutubeMusicPlayer(videoId);
  const formats = [
    ...(response?.streamingData?.adaptiveFormats || []),
    ...(response?.streamingData?.formats || [])
  ];
  const audioFormats = formats
    .filter((item: any) => item?.url && String(item.mimeType || '').includes('audio'))
    .sort((a: any, b: any) => Number(b.bitrate || 0) - Number(a.bitrate || 0));
  const selected = audioFormats[0] || formats.find((item: any) => item?.url);
  if (!selected?.url) throw new Error('YouTube Music 未返回可播放音频地址');

  return {
    data: {
      code: 200,
      message: 'success',
      data: {
        url: selected.url,
        source: 'ytmusic',
        type: String(selected.mimeType || '').includes('mp4') ? 'm4a' : 'webm',
        bitrate: selected.bitrate || 0
      }
    }
  };
};

const parseLyricLines = (payload: any): ILyric | null => {
  const lines = findObjects(payload, (item) => Array.isArray(item.lyricLines), 1)[0]?.lyricLines;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const lrcArray = lines
    .map((line: any) => ({
      text: line.lyricLine || line.text || '',
      trText: '',
      startTime: Number(line.offsetMs || 0),
      hasWordByWord: false
    }))
    .filter((line: any) => line.text);
  if (lrcArray.length === 0) return null;

  return {
    lrcArray,
    lrcTimeArray: lrcArray.map((line) => Number(line.startTime || 0) / 1000),
    hasWordByWord: false
  };
};

export const getYoutubeMusicLyrics = async (videoId: string): Promise<ILyric | null> => {
  const response = await youtubeRequest('browse', {
    context: WEB_REMIX_CONTEXT,
    browseId: `MPLYt_${videoId}`
  });
  return parseLyricLines(response);
};

export const getYoutubeMusicNext = async (videoId: string) => {
  return await youtubeRequest('next', {
    context: WEB_REMIX_CONTEXT,
    videoId,
    playlistId: `RD${videoId}`
  });
};

export const getYoutubeMusicNextSongs = async (videoId: string, limit = 20) => {
  const response = await getYoutubeMusicNext(videoId);
  const songs = findObjects(
    response,
    (item) => Boolean(item.musicResponsiveListItemRenderer),
    limit * 2
  )
    .map((item) => mapYoutubeSong(item.musicResponsiveListItemRenderer))
    .filter((song): song is SongResult => Boolean(song))
    .filter((song) => String(song.id) !== String(videoId));

  // 根因：接口文档里的 YouTube Music next 推荐列表之前只做了底层请求封装，
  // 播放队列没有任何入口会消费它，等于用户无法真正用到这个公开能力。
  // 这里把复杂的 InnerTube 响应收敛成项目通用 SongResult[]，让播放列表只关心
  // “追加哪些可播歌曲”，避免把 YouTube 的原始结构扩散到业务层。
  return songs.slice(0, limit);
};

export const getYoutubeMusicPlaylist = async (browseId: string) => {
  return await youtubeRequest('browse', {
    context: WEB_REMIX_CONTEXT,
    browseId
  });
};

export const getYoutubeMusicArtist = async (browseId: string) => {
  return await youtubeRequest('browse', {
    context: WEB_REMIX_CONTEXT,
    browseId
  });
};

export const getYoutubeMusicPlaylistDetail = async (browseId: string, listInfo?: any) => {
  const response = await getYoutubeMusicPlaylist(browseId);
  const songs = findObjects(response, (item) => Boolean(item.musicResponsiveListItemRenderer), 120)
    .map((item) => mapYoutubeSong(item.musicResponsiveListItemRenderer))
    .filter((song): song is SongResult => Boolean(song));

  if (songs.length === 0) throw new Error('YouTube Music 歌单没有可播放歌曲');
  const cover = listInfo?.coverImgUrl || listInfo?.picUrl || songs[0]?.picUrl || '';

  return {
    data: {
      code: 200,
      playlist: {
        id: stableYoutubeNumericId(browseId),
        name: listInfo?.name || 'YouTube Music 歌单',
        coverImgUrl: cover,
        picUrl: cover,
        description: listInfo?.description || listInfo?.desc || 'YouTube Music 歌单',
        playCount: 0,
        trackCount: songs.length,
        creator: listInfo?.creator || {
          userId: 0,
          nickname: 'YouTube Music',
          avatarUrl: cover
        },
        tracks: songs,
        trackIds: songs.map((song) => ({
          id: song.id,
          v: 0,
          t: 0,
          at: 0,
          uid: 0,
          rcmdReason: ''
        })),
        subscribed: false,
        source: 'ytmusic-playlist',
        browseId
      },
      privileges: []
    }
  };
};

const parseYoutubeArtistHeader = (payload: any, browseId: string) => {
  const header =
    findObjects(
      payload,
      (item) =>
        Boolean(
          item.musicImmersiveHeaderRenderer ||
          item.musicVisualHeaderRenderer ||
          item.musicHeaderRenderer
        ),
      1
    )[0] || {};
  const renderer =
    header.musicImmersiveHeaderRenderer ||
    header.musicVisualHeaderRenderer ||
    header.musicHeaderRenderer ||
    {};
  const name = getRunsText(renderer.title) || 'YouTube Music 艺人';
  const cover =
    renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at?.(-1)?.url ||
    renderer?.thumbnail?.thumbnails?.at?.(-1)?.url ||
    '';
  const subscriberText =
    getRunsText(renderer?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText) ||
    getRunsText(renderer?.subtitle);

  return {
    id: stableYoutubeNumericId(browseId),
    name,
    cover,
    avatar: cover,
    picUrl: cover,
    briefDesc: subscriberText,
    albumSize: 0,
    musicSize: 0,
    mvSize: 0,
    transNames: [],
    alias: [],
    identities: [],
    identifyTag: [],
    rank: { rank: 0, type: 0 },
    source: 'ytmusic',
    browseId
  };
};

export const getYoutubeMusicArtistDetail = async (browseId: string) => {
  const response = await getYoutubeMusicArtist(browseId);
  const artist = parseYoutubeArtistHeader(response, browseId);
  const songs = findObjects(response, (item) => Boolean(item.musicResponsiveListItemRenderer), 80)
    .map((item) => mapYoutubeSong(item.musicResponsiveListItemRenderer))
    .filter((song): song is SongResult => Boolean(song));

  return {
    artist,
    songs
  };
};

export const extractYoutubeBrowseIds = (payload: any) =>
  findObjects(payload, (item) => Boolean(findBrowseId(item)), 20)
    .map(findBrowseId)
    .filter(Boolean);
