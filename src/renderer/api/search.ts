import request from '@/utils/request';

import { getKuwoSearchSuggestions, searchKuwoArtists, searchKuwoSongs } from './kuwo';
import {
  searchYoutubeMusicArtists,
  searchYoutubeMusicPlaylists,
  searchYoutubeMusicSongs
} from './youtubeMusic';

interface IParams {
  keywords: string;
  type: number;
  limit?: number;
  offset?: number;
}
// 搜索内容
export const getSearch = async (params: IParams): Promise<any> => {
  if (params.type === 1) {
    try {
      const response = await searchKuwoSongs(params);
      const songs = response.data?.result?.songs || [];
      if (songs.length > 0) return response;
      console.warn('酷我搜索返回为空，已切换到本地后端搜索。');
    } catch (error) {
      // 根因：歌曲搜索是用户播放链路的入口，必须默认优先返回酷我结果，才能让
      // 后续播放命中酷我直链接口；但酷我接口偶发超时或为空时，不能让用户完全搜不到。
      // 酷我请求层已经连续尝试三次，这里只在三次都失败后回退本地后端搜索。
      console.warn('酷我搜索三次尝试后仍不可用，已切换到本地后端搜索。', error);
    }

    const fallbackResponse = await request.get<any>('/cloudsearch', { params });
    const fallbackSongs = fallbackResponse.data?.result?.songs || [];
    if (fallbackSongs.length > 0) return fallbackResponse;

    try {
      const youtubeResponse = await searchYoutubeMusicSongs(params.keywords, params.limit || 30);
      const youtubeSongs = youtubeResponse.data?.result?.songs || [];
      if (youtubeSongs.length > 0) return youtubeResponse;
    } catch (error) {
      // 根因：YouTube Music / InnerTube 是接口文档要求补齐的公开能力，但它受
      // 网络、Key 和地区影响更大，不能覆盖酷我主搜索。这里只作为酷我和本地后端
      // 都没有结果后的补充，避免用户搜不到但也不拖慢主链路。
      console.warn('YouTube Music 搜索补充不可用，保留本地后端搜索结果。', error);
    }

    return fallbackResponse;
  }
  if (params.type === 100) {
    try {
      const response = await searchKuwoArtists(params);
      const artists = response.data?.result?.artists || [];
      if (artists.length > 0) return response;
      console.warn('酷我歌手搜索返回为空，已切换到本地后端搜索。');
    } catch (error) {
      // 根因：搜索下拉补齐“歌手”后，歌手分类也应该优先复用酷我的稳定曲库入口。
      // 酷我同一搜索接口支持 ft=artist，能直接返回 ARTISTID/ARTIST/头像/歌曲数；
      // 但外站仍可能超时或返回空，所以三次请求失败后回退本地后端，保证用户搜索不断路。
      console.warn('酷我歌手搜索三次尝试后仍不可用，已切换到本地后端搜索。', error);
    }

    const fallbackResponse = await request.get<any>('/cloudsearch', { params });
    const fallbackArtists = fallbackResponse.data?.result?.artists || [];
    if (fallbackArtists.length > 0) return fallbackResponse;

    try {
      const youtubeResponse = await searchYoutubeMusicArtists(params.keywords, params.limit || 30);
      const youtubeArtists = youtubeResponse.data?.result?.artists || [];
      if (youtubeArtists.length > 0) return youtubeResponse;
    } catch (error) {
      // 根因：接口文档里的 YouTube Music 艺人主页如果只做底层封装，用户没有入口能触发。
      // 这里仅在酷我歌手搜索和本地后端都没有结果后补 YouTube Music，点击后仍进入歌手详情页。
      console.warn('YouTube Music 歌手搜索补充不可用，保留本地后端搜索结果。', error);
    }

    return fallbackResponse;
  }
  if (params.type === 1000) {
    const fallbackResponse = await request.get<any>('/cloudsearch', { params });
    const fallbackPlaylists = fallbackResponse.data?.result?.playlists || [];
    if (fallbackPlaylists.length > 0) return fallbackResponse;

    try {
      const youtubeResponse = await searchYoutubeMusicPlaylists(
        params.keywords,
        params.limit || 30
      );
      const youtubePlaylists = youtubeResponse.data?.result?.playlists || [];
      if (youtubePlaylists.length > 0) return youtubeResponse;
    } catch (error) {
      // 根因：接口文档里的 YouTube Music 播放列表详情需要先有播放列表搜索入口，
      // 否则用户无法从界面进入 browseId 详情。这里只在本地后端无歌单结果时补位。
      console.warn('YouTube Music 歌单搜索补充不可用，保留本地后端搜索结果。', error);
    }

    return fallbackResponse;
  }
  return request.get<any>('/cloudsearch', {
    params
  });
};

/**
 * 搜索建议接口返回的数据结构
 */
interface Suggestion {
  keyword: string;
}

interface KugouSuggestionResponse {
  data: Suggestion[];
}

// 搜索建议返回的数据结构（部分字段）
interface NeteaseSuggestResult {
  result?: {
    songs?: Array<{ name: string }>;
    artists?: Array<{ name: string }>;
    albums?: Array<{ name: string }>;
  };
  code?: number;
}

/**
 * 获取搜索建议
 * @param keyword 搜索关键词
 */
export const getSearchSuggestions = async (keyword: string): Promise<string[]> => {
  const query = keyword.trim();
  if (!query) return [];
  try {
    const suggestions = await getKuwoSearchSuggestions(query);
    if (suggestions.length) return suggestions;
  } catch {
    // 输入联想不等待完整搜索的三轮重试；两秒内未返回就尝试本地建议接口。
  }
  try {
    const { data } = await request.get<NeteaseSuggestResult>('/search/suggest', {
      params: { keywords: query },
      timeout: 3000
    });
    const result = data?.result || {};
    return [
      ...new Set([
        ...(result.songs || []).map((item) => item.name),
        ...(result.artists || []).map((item) => item.name),
        ...(result.albums || []).map((item) => item.name)
      ])
    ].slice(0, 10);
  } catch {
    return [];
  }
};
