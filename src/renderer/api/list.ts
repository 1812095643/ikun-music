import { IList } from '@/types/list';
import type { IListDetail } from '@/types/listDetail';
import request from '@/utils/request';

import { getKuwoPlaylistDetail, getKuwoRankDetail, getKuwoRankList } from './kuwo';
import { getYoutubeMusicPlaylistDetail } from './youtubeMusic';

interface IListByTagParams {
  tag: string;
  before: number;
  limit: number;
}

interface IListByCatParams {
  cat: string;
  offset: number;
  limit: number;
}

// 根据tag 获取歌单列表
export function getListByTag(params: IListByTagParams) {
  return request.get<IList>('/top/playlist/highquality', { params });
}

// 根据cat 获取歌单列表
export function getListByCat(params: IListByCatParams) {
  return request.get('/top/playlist', {
    params
  });
}

// 获取推荐歌单
export function getRecommendList(limit: number = 30) {
  return request.get('/personalized', { params: { limit } });
}

// 获取歌单详情
export function getListDetail(id: number | string, source?: string, listInfo?: any) {
  if (source === 'kuwo-rank') {
    return getKuwoRankDetail(id, listInfo) as unknown as Promise<{ data: IListDetail }>;
  }
  if (source === 'kuwo') {
    return getKuwoPlaylistDetail(id) as unknown as Promise<{ data: IListDetail }>;
  }
  if (source === 'ytmusic-playlist') {
    return getYoutubeMusicPlaylistDetail(String(id), listInfo) as unknown as Promise<{
      data: IListDetail;
    }>;
  }
  return request.get<IListDetail>('/playlist/detail', { params: { id } });
}

// 获取专辑内容
export function getAlbum(id: number | string) {
  return request.get('/album', { params: { id } });
}

// 获取排行榜列表
export function getToplist() {
  return request.get('/toplist');
}

export async function getToplistWithKuwo() {
  try {
    const kuwoResponse = await getKuwoRankList();
    if (Array.isArray(kuwoResponse.data?.list) && kuwoResponse.data.list.length > 0) {
      return kuwoResponse;
    }
    console.warn('酷我榜单返回为空，已切换到本地后端排行榜。');
  } catch (error) {
    // 根因：接口文档里的酷我榜单接口现场可能返回 502，官网接口又依赖
    // kw_token/csrf 校验。排行榜是首页级入口，不能因为单个外部接口波动空白，
    // 所以这里明确保留本地后端 /toplist 作为最终兜底。
    console.warn('酷我榜单接口不可用，已切换到本地后端排行榜。', error);
  }

  return getToplist();
}
