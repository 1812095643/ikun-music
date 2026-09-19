import { isDesktopRuntime } from '@/utils';

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
    signal?: AbortSignal;
  } = {}
): Promise<ExternalMusicHttpResponse<T>> => {
  const method = options.method || 'GET';
  const timeout = options.timeout || 15000;
  const signal = options.signal;
  signal?.throwIfAborted();
  const headers = {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    ...(options.headers || {})
  };

  if (isDesktopRuntime && window.desktop?.lxMusicHttpRequest) {
    // 外站请求由桌面 HTTP 插件直接执行，无需等待本地 Node 服务。
    const requestId = buildRequestId(options.requestPrefix);
    const abort = () => window.desktop.lxMusicHttpCancel(requestId);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await window.desktop.lxMusicHttpRequest({
        url,
        requestId,
        options: { method, timeout, headers, body: options.body }
      });
      signal?.throwIfAborted();
      return response as ExternalMusicHttpResponse<T>;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout)
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
