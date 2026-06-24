import { isElectron } from '@/utils';
import request from '@/utils/request';

import { getKuwoSearchSuggestions, searchKuwoArtists, searchKuwoSongs } from './kuwo';

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

    return request.get<any>('/cloudsearch', { params });
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

    return request.get<any>('/cloudsearch', { params });
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
export const getSearchSuggestions = async (keyword: string) => {
  console.log('[API] getSearchSuggestions: 开始执行');

  if (!keyword || !keyword.trim()) {
    return Promise.resolve([]);
  }

  console.log(`[API] getSearchSuggestions: 准备请求，关键词: "${keyword}"`);

  try {
    const kuwoSuggestions = await getKuwoSearchSuggestions(keyword);
    if (kuwoSuggestions.length > 0) {
      console.log('[API] getSearchSuggestions: 酷我建议解析成功:', kuwoSuggestions);
      return kuwoSuggestions;
    }

    let responseData: KugouSuggestionResponse;
    if (isElectron) {
      console.log('[API] Running in desktop compatibility layer, using IPC proxy fallback.');
      responseData = await window.api.getSearchSuggestions(keyword);
    } else {
      // 非桌面环境下，使用网易云兜底接口
      const res = await request.get<NeteaseSuggestResult>('/search/suggest', {
        params: { keywords: keyword }
      });

      const result = res?.data?.result || {};
      const names: string[] = [];
      if (Array.isArray(result.songs)) names.push(...result.songs.map((s) => s.name));
      if (Array.isArray(result.artists)) names.push(...result.artists.map((a) => a.name));
      if (Array.isArray(result.albums)) names.push(...result.albums.map((al) => al.name));

      // 去重并截取前10个
      const unique = Array.from(new Set(names)).slice(0, 10);
      console.log('[API] getSearchSuggestions: 解析成功:', unique);
      return unique;
    }

    if (responseData && Array.isArray(responseData.data)) {
      const suggestions = responseData.data.map((item) => item.keyword).slice(0, 10);
      console.log('[API] getSearchSuggestions: 成功解析建议:', suggestions);
      return suggestions;
    }

    console.warn('[API] getSearchSuggestions: 响应数据格式不正确，返回空数组。');
    return [];
  } catch (error) {
    console.error('[API] getSearchSuggestions: 请求失败，错误信息:', error);
    return [];
  }
};
