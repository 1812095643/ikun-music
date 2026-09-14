import { IData } from '@/types';
import { IAlbumNew } from '@/types/album';
import { IDayRecommend } from '@/types/day_recommend';
import { IRecommendMusic } from '@/types/music';
import { IPlayListSort } from '@/types/playlist';
import { IHotSearch, ISearchKeyword } from '@/types/search';
import { IHotSinger } from '@/types/singer';
import request from '@/utils/request';

import { getKuwoRecommendPlaylists } from './kuwo';

interface IHotSingerParams {
  offset: number;
  limit: number;
}

interface IRecommendMusicParams {
  limit: number;
}

interface PersonalizedPlaylistPayload {
  code?: number;
  result?: any[];
  [key: string]: any;
}

const HOME_DATA_CACHE_TTL = 5 * 60 * 1000;
const HOME_DATA_LIMIT = 30;

let personalizedPlaylistCache: {
  key: string;
  expiresAt: number;
  request: Promise<PersonalizedPlaylistPayload>;
} | null = null;
const normalizePersonalizedPlaylistResponse = (payload: PersonalizedPlaylistPayload) => {
  const result = Array.isArray(payload?.result) ? payload.result : [];
  return {
    data: {
      ...payload,
      result
    },
    result
  };
};

const normalizeFallbackPlaylistResponse = (payload: PersonalizedPlaylistPayload) => {
  const result = Array.isArray(payload?.result)
    ? payload.result.map((item) => ({
        ...item,
        source: item.source || 'netease'
      }))
    : [];

  return normalizePersonalizedPlaylistResponse({
    ...payload,
    result
  });
};

// 获取热门歌手，保留分页参数；首页重复请求在组件层消除。
export const getHotSinger = (params: IHotSingerParams) => {
  return request.get<IHotSinger>('/top/artists', { params });
};
// 获取搜索推荐词
export const getSearchKeyword = () => {
  return request.get<ISearchKeyword>('/search/default');
};

// 获取热门搜索
export const getHotSearch = () => {
  return request.get<IHotSearch>('/search/hot/detail');
};

// 获取歌单分类
export const getPlaylistCategory = () => {
  return request.get<IPlayListSort>('/playlist/catlist');
};

// 获取推荐音乐
export const getRecommendMusic = (params: IRecommendMusicParams) => {
  return request.get<IRecommendMusic>('/personalized/newsong', { params });
};

// 获取每日推荐
export const getDayRecommend = () => {
  return request.get<IData<IData<IDayRecommend>>>('/recommend/songs');
};

// 获取最新专辑推荐
export const getNewAlbum = () => {
  return request.get<IAlbumNew>('/album/newest');
};

// 获取轮播图
export const getBanners = (type: number = 0) => {
  return request.get<any>('/banner', { params: { type } });
};

/** 获取推荐歌单；并发首屏调用共享请求，成功结果在同一登录态内保留五分钟。 */
export const getPersonalizedPlaylist = async (limit = 30) => {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 30;
  const requestLimit = Math.max(HOME_DATA_LIMIT, normalizedLimit);
  // 根因：Hero 和歌单区同时请求不同数量的推荐，重复占用连接；统一拉取后各自切片。
  // 缓存还必须包含登录态和数量，避免切换账号或请求超过 30 条时复用不匹配的结果。
  const key = JSON.stringify([requestLimit, localStorage.getItem('token') || '']);
  if (
    !personalizedPlaylistCache ||
    personalizedPlaylistCache.key !== key ||
    personalizedPlaylistCache.expiresAt <= Date.now()
  ) {
    const pending = (async () => {
      try {
        const { data } = await getKuwoRecommendPlaylists(requestLimit);
        if (Array.isArray(data?.result) && data.result.length > 0) return data;
      } catch (error) {
        // 原先单个外站最多等待三轮 15 秒，改为 5 秒内回退，避免首页长期显示骨架。
        console.warn('推荐歌单暂时未返回，正在使用备用推荐：', error);
      }
      const { data } = await request.get<PersonalizedPlaylistPayload>('/personalized', {
        params: { limit: requestLimit }
      });
      if (!Array.isArray(data?.result) || data.result.length === 0) {
        throw new Error('暂时没有获取到推荐歌单，请稍后重试');
      }
      return data;
    })();
    personalizedPlaylistCache = { key, expiresAt: Infinity, request: pending };
    // 同时处理成功和失败分支，失败不缓存，也不产生未处理的 rejected Promise。
    void pending.then(
      () => {
        if (personalizedPlaylistCache?.request === pending) {
          personalizedPlaylistCache.expiresAt = Date.now() + HOME_DATA_CACHE_TTL;
        }
      },
      () => {
        if (personalizedPlaylistCache?.request === pending) personalizedPlaylistCache = null;
      }
    );
  }
  const payload = await personalizedPlaylistCache.request;
  return normalizeFallbackPlaylistResponse({
    ...payload,
    result: payload.result?.slice(0, normalizedLimit) || []
  });
};
// 获取私人漫游（request 拦截器已自动添加 timestamp）
export const getPersonalFM = () => {
  return request.get<any>('/personal_fm');
};

// 获取独家放送
export const getPrivateContent = () => {
  return request.get<any>('/personalized/privatecontent');
};

// 获取推荐MV
export const getPersonalizedMV = () => {
  return request.get<any>('/personalized/mv');
};

// 获取新碟上架
export const getTopAlbum = (params?: { limit?: number; offset?: number; area?: string }) => {
  return request.get<any>('/top/album', { params });
};

// 获取推荐电台
export const getPersonalizedDJ = () => {
  return request.get<any>('/personalized/djprogram');
};
