import { invoke } from '@tauri-apps/api/core';
import { type AxiosAdapter, AxiosError } from 'axios';

export interface MusicServiceResponse {
  status: number;
  body: any;
  cookies?: string[];
}

/** 通过 Tauri 私有管道请求音乐服务；桌面端完全不需要配置或占用 HTTP 端口。 */
export const requestMusicService = (
  path: string,
  data: Record<string, any> = {},
  method = 'POST'
) => invoke<MusicServiceResponse>('music_request', { request: { path, method, data } });

export const musicServiceAdapter: AxiosAdapter = async (config) => {
  const path = config.url || '';
  const method = (config.method || 'get').toUpperCase();
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    const result = await Promise.race([
      invoke<MusicServiceResponse>('music_request', {
        request: { path, method, params: config.params || {}, data: data || {} }
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AxiosError('音乐接口响应超时，请稍后重试', 'ECONNABORTED', config)),
          config.timeout || 15000
        );
        abort = () => reject(new AxiosError('请求已取消', 'ERR_CANCELED', config));
        if (config.signal?.aborted) abort();
        else config.signal?.addEventListener?.('abort', abort, { once: true });
      })
    ]);
    const response = {
      data: result.body,
      status: result.status,
      statusText: String(result.status),
      headers: {},
      config
    };
    if (config.validateStatus && !config.validateStatus(result.status)) {
      throw new AxiosError(
        result.body?.message || result.body?.msg || '音乐接口暂未返回，请重试',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response
      );
    }
    return response;
  } catch (error) {
    if (error instanceof AxiosError) throw error;
    throw new AxiosError(String(error), 'ERR_NETWORK', config);
  } finally {
    clearTimeout(timer);
    if (abort) config.signal?.removeEventListener?.('abort', abort);
  }
};
