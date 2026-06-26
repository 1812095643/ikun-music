import { isElectron } from '@/utils';
import { ensureMusicApiReady } from '@/utils/tauriElectronCompat';

export interface ExternalMusicHttpResponse<T = any> {
  statusCode: number;
  headers?: Record<string, string | string[]>;
  body: T;
}

const buildRequestId = (prefix = 'external-music') =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const requestExternalMusic = async <T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'HEAD';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    requestPrefix?: string;
  } = {}
): Promise<ExternalMusicHttpResponse<T>> => {
  const method = options.method || 'GET';
  const timeout = options.timeout || 15000;
  const headers = {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    ...(options.headers || {})
  };

  if (isElectron && window.api?.lxMusicHttpRequest) {
    await ensureMusicApiReady();
    return (await window.api.lxMusicHttpRequest({
      url,
      requestId: buildRequestId(options.requestPrefix),
      options: {
        method,
        timeout,
        headers,
        body: options.body
      }
    })) as ExternalMusicHttpResponse<T>;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body,
    signal: AbortSignal.timeout(timeout)
  });
  const rawBody = method === 'HEAD' ? '' : await response.text();
  let body: any = rawBody;
  const contentType = response.headers.get('content-type') || '';
  if (
    contentType.includes('application/json') ||
    rawBody.startsWith('{') ||
    rawBody.startsWith('[')
  ) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: body as T
  };
};

export const assertExternalOk = <T>(response: ExternalMusicHttpResponse<T>, label: string) => {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${label}请求失败：HTTP ${response.statusCode}`);
  }
  return response.body;
};
