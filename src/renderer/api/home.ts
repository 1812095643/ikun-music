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

// 获取热门歌手
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

// 获取推荐歌单
export const getPersonalizedPlaylist = async (limit: number = 30) => {
  try {
    const kuwoResponse = await getKuwoRecommendPlaylists(limit);
    if (Array.isArray(kuwoResponse.data?.result) && kuwoResponse.data.result.length > 0) {
      return normalizePersonalizedPlaylistResponse(kuwoResponse.data);
    }
    console.warn('酷我推荐歌单返回为空，已切换到本地后端推荐歌单。');
  } catch (error) {
    // 根因：首页歌单之前只依赖酷我推荐歌单接口，酷我外站偶发超时或返回空数组时，
    // 首页会直接进入空态，用户看到的就是“后端启动了但歌单区域没有内容”。酷我请求层
    // 已经连续尝试三次；三次都不行才回退到本地后端 /personalized，既保证酷我优先，
    // 又避免首页因为单个外部音源波动而空白。
    console.warn('酷我推荐歌单三次尝试后仍不可用，已切换到本地后端推荐歌单。', error);
  }

  const fallbackResponse = await request.get<PersonalizedPlaylistPayload>('/personalized', {
    params: { limit }
  });
  return normalizeFallbackPlaylistResponse(fallbackResponse.data);
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
