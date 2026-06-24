import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { Store } from '@tauri-apps/plugin-store';

import defaultSettings from '../../main/set.json';

type Listener = (...args: any[]) => void;

type StoreData = {
  set: Record<string, any>;
  shortcuts: Record<string, any>;
};

type CompatStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: Record<string, any>): Promise<void>;
  save(): Promise<void>;
};

type TrayStatePayload = {
  title?: string;
  artist?: string;
  isPlaying: boolean;
  hasSong: boolean;
  volume: number;
  muted: boolean;
};

const isTauriRuntime = Boolean((window as any).__TAURI_INTERNALS__);
const BROWSER_STORE_KEY = 'alger-music-tauri-browser-store';
const listeners = new Map<string, Set<Listener>>();
const unlisteners = new Map<string, UnlistenFn>();
let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
let currentWebviewWindow: ReturnType<typeof getCurrentWebviewWindow> | null = null;
let storePromise: Promise<CompatStore> | null = null;
let musicApiReadyPromise: Promise<number | null> | null = null;
let storeCache: StoreData = {
  set: { ...(defaultSettings as Record<string, any>) },
  shortcuts: {}
};

const getAppWindow = () => {
  if (!isTauriRuntime) return null;
  if (!appWindow) appWindow = getCurrentWindow();
  return appWindow;
};

const getCompatWebviewWindow = () => {
  if (!isTauriRuntime) return null;
  if (!currentWebviewWindow) currentWebviewWindow = getCurrentWebviewWindow();
  return currentWebviewWindow;
};

const saveBrowserStore = () => {
  localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(storeCache));
};

const createBrowserStore = () => {
  const rawStore = localStorage.getItem(BROWSER_STORE_KEY);
  const storedStore = rawStore ? JSON.parse(rawStore) : {};
  storeCache = {
    set: { ...(defaultSettings as Record<string, any>), ...(storedStore.set || {}) },
    shortcuts: storedStore.shortcuts || {}
  };
  saveBrowserStore();
  return {
    get: async <T>(key: string) => storeCache[key as keyof StoreData] as T | undefined,
    set: async (key: keyof StoreData, value: Record<string, any>) => {
      storeCache[key] = value;
      saveBrowserStore();
    },
    save: async () => saveBrowserStore()
  };
};

const getStore = async (): Promise<CompatStore> => {
  if (!storePromise) {
    if (!isTauriRuntime) {
      storePromise = Promise.resolve(createBrowserStore());
      return storePromise;
    }
    storePromise = Store.load('config.json');
    const store = await storePromise;
    const storedSet = await store.get<Record<string, any>>('set');
    const storedShortcuts = await store.get<Record<string, any>>('shortcuts');
    storeCache = {
      set: { ...(defaultSettings as Record<string, any>), ...(storedSet || {}) },
      shortcuts: storedShortcuts || {}
    };
    await store.set('set', storeCache.set);
    await store.set('shortcuts', storeCache.shortcuts);
    await store.save();
  }
  return storePromise;
};

export const ensureMusicApiReady = async () => {
  if (!isTauriRuntime) return null;
  if (musicApiReadyPromise) return musicApiReadyPromise;

  musicApiReadyPromise = (async () => {
    await getStore();
    const result = await invoke<{ port?: number }>('start_music_api', {
      port: storeCache.set.musicApiPort || 30488
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('启动音乐 API 服务失败:', message);
      throw new Error(`音乐 API 服务没有启动起来：${message}`);
    });
    if (result?.port && result.port !== storeCache.set.musicApiPort) {
      await setStoreValue('set.musicApiPort', result.port);
    }
    return result?.port || storeCache.set.musicApiPort || 30488;
  })().catch((error) => {
    musicApiReadyPromise = null;
    throw error;
  });

  return musicApiReadyPromise;
};

const getByPath = (path: string) => {
  const keys = path.split('.');
  let current: any = storeCache;
  for (const key of keys) {
    if (current == null) return '';
    current = current[key];
  }
  return current ?? '';
};

const setByPath = (path: string, value: any) => {
  const keys = path.split('.');
  let current: any = storeCache;
  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
};

const postToMusicApi = async (path: string, body: Record<string, any>) => {
  await ensureMusicApiReady();
  const url = new URL(`http://127.0.0.1:${storeCache.set.musicApiPort}${path}`);
  // 根因：内置 NCM API 在全局层面对所有路由启用了 2 分钟缓存，缓存 key 只包含
  // method + originalUrl，不包含 POST body。自定义解析接口如果固定访问同一路径，
  // 搜索后播放不同歌曲时可能拿到上一首歌的解析结果，表现为按钮进入播放态但无声。
  // 每次 POST 增加唯一参数，让扫描本地音乐、元数据解析和 unblockMusic 都按真实请求执行。
  url.searchParams.set('_tauriRequestId', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
};

const emitLocal = (channel: string, ...args: any[]) => {
  listeners.get(channel)?.forEach((listener) => listener({ sender: null }, ...args));
};

const sanitizeFilename = (filename: string) =>
  filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || `音乐_${Date.now()}`;

const getDownloadExtension = (url: string, type?: string) => {
  if (type) return type.startsWith('.') ? type : `.${type}`;
  const matched = new URL(url).pathname.match(/\.(mp3|flac|m4a|aac|ogg|wav)(?:$|\?)/i);
  return matched?.[0] || '.mp3';
};

const downloadMusicFile = async (payload: any) => {
  const { url, filename, songInfo, type } = payload || {};
  if (!url || !filename) {
    emitLocal('music-download-error', { filename, error: '下载参数不完整' });
    return;
  }

  const safeName = sanitizeFilename(filename);
  const extension = getDownloadExtension(url, type);
  const relativePath = `${safeName}${extension}`;
  try {
    emitLocal('music-download-queued', { filename: safeName, songInfo });
    const response = await (isTauriRuntime ? tauriFetch : fetch)(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (isTauriRuntime) {
      await writeFile(relativePath, buffer, { baseDir: BaseDirectory.Download });
    } else {
      const blob = new Blob([buffer]);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = relativePath;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }
    emitLocal('music-download-complete', {
      filename: safeName,
      filePath: relativePath,
      songInfo,
      status: 'completed'
    });
  } catch (error) {
    emitLocal('music-download-error', {
      filename: safeName,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const ensureTauriListener = async (channel: string) => {
  if (!isTauriRuntime) return;
  if (unlisteners.has(channel)) return;
  const windowScopedEvents = new Set([
    'tray-panel-state',
    'tray-panel-command',
    'tray-panel-opened',
    'mini-mode'
  ]);
  // 根因：托盘面板是 Tauri 动态创建的独立 WebView。旧兼容层只注册全局 listen，
  // 在窗口刚创建、主窗口立刻 emit 的时序下容易错过定向窗口事件；同时 capability
  // 只覆盖 main 窗口时，tray-panel 自己也可能没有事件权限。这里对窗口间通信改用
  // 当前 WebView 的窗口级 listen，和 Rust/WebviewWindow emit 的目标保持一致。
  const unlisten = windowScopedEvents.has(channel)
    ? await getCompatWebviewWindow()!.listen(channel, (event) => {
        emitLocal(channel, event.payload);
      })
    : await listen(channel, (event) => {
        emitLocal(channel, event.payload);
      });
  unlisteners.set(channel, unlisten);
};

const send = (channel: string, ...args: any[]) => {
  const currentWindow = getAppWindow();
  switch (channel) {
    case 'minimize-window':
      void invoke('minimize_window');
      break;
    case 'maximize-window':
      void invoke('maximize_window');
      break;
    case 'close-window':
      void invoke('close_window');
      break;
    case 'quit-app':
      void invoke('quit_app');
      break;
    case 'drag-start':
      void currentWindow?.startDragging();
      break;
    case 'resize-window':
      void invoke('set_window_size', { width: args[0], height: args[1] });
      break;
    case 'resize-mini-window':
      void invoke('resize_mini_window', { showPlaylist: Boolean(args[0]) });
      break;
    case 'set-content-zoom':
      document.documentElement.style.zoom = String(args[0] || 1);
      void setStoreValue('set.contentZoomFactor', args[0] || 1);
      break;
    case 'reset-content-zoom':
      document.documentElement.style.zoom = '1';
      void setStoreValue('set.contentZoomFactor', 1);
      break;
    case 'open-directory':
      if (args[0]) void openPath(String(args[0]));
      break;
    case 'show-notification':
      if ('Notification' in window) {
        void Notification.requestPermission().then((permission) => {
          if (permission === 'granted')
            new Notification(args[0]?.title || 'ikun音乐', { body: args[0]?.body });
        });
      }
      break;
    case 'mini-window':
      void invoke('mini_window');
      break;
    case 'mini-tray':
      void invoke('mini_tray');
      break;
    case 'restore-window':
      void invoke('restore_window');
      break;
    case 'hide-tray-panel':
      void invoke('hide_tray_panel_window');
      break;
    case 'update-tray-state':
      if (isTauriRuntime) {
        void invoke('update_tray_state', { state: args[0] }).catch((error) => {
          console.warn('更新系统托盘状态失败:', error);
        });
      }
      break;
    case 'set-store-value':
      void setStoreValue(args[0], args[1]);
      break;
    case 'download-music':
      void downloadMusicFile(args[0]);
      break;
    case 'change-language':
      void setStoreValue('set.language', args[0]);
      emitLocal('language-changed', args[0]);
      break;
    case 'restart':
      window.location.reload();
      break;
    default:
      if (isTauriRuntime) {
        const targetLabel = channel === 'tray-panel-state' ? 'tray-panel' : 'main';
        void emitTo(targetLabel, channel, args[0] ?? null).catch(() => {
          void invoke('emit_to_main', { event: channel, payload: args[0] ?? null }).catch(
            () => undefined
          );
        });
      }
      break;
  }
};

const sendSync = (channel: string, ...args: any[]) => {
  switch (channel) {
    case 'get-store-value':
      return getByPath(args[0]);
    case 'get-platform':
      return navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 'win32';
    case 'get-arch':
      return 'x64';
    default:
      return '';
  }
};

const setStoreValue = async (key: string, value: any) => {
  await getStore();
  setByPath(key, value);
  const store = await getStore();
  await store.set('set', storeCache.set);
  await store.set('shortcuts', storeCache.shortcuts);
  await store.save();
};

const invokeChannel = async (channel: string, ...args: any[]) => {
  await getStore();
  switch (channel) {
    case 'get-store-value':
      return getByPath(args[0]);
    case 'set-store-value':
      await setStoreValue(args[0], args[1]);
      return true;
    case 'get-platform':
      return sendSync('get-platform');
    case 'get-arch':
      return sendSync('get-arch');
    case 'get-content-zoom':
      return storeCache.set.contentZoomFactor || 1;
    case 'get-system-scale-factor':
      return window.devicePixelRatio || 1;
    case 'shortcuts:get-config':
      return storeCache.shortcuts || {};
    case 'shortcuts:validate':
      return { valid: true, conflicts: [] };
    case 'shortcuts:save':
      await setStoreValue('shortcuts', args[0]);
      return { success: true };
    case 'app-update:get-state':
    case 'app-update:check':
      return {
        status: 'idle',
        currentVersion: '5.1.0',
        updateInfo: null,
        error: null,
        progress: null
      };
    case 'app-update:download':
    case 'app-update:quit-and-install':
    case 'app-update:open-release-page':
      return false;
    case 'open-external':
      if (!isTauriRuntime) return window.open(String(args[0]), '_blank') !== null;
      return openUrl(String(args[0]));
    case 'select-directory': {
      if (!isTauriRuntime) return { canceled: true, filePaths: [] };
      const selected = await open({ directory: true, multiple: false });
      return { canceled: !selected, filePaths: selected ? [selected] : [] };
    }
    case 'select-file': {
      if (!isTauriRuntime) return { canceled: true, filePaths: [] };
      const selected = await open({ directory: false, multiple: false });
      return { canceled: !selected, filePaths: selected ? [selected] : [] };
    }
    case 'open-path':
      if (!isTauriRuntime) return false;
      return openPath(String(args[0]));
    case 'check-music-downloaded':
      if (!isTauriRuntime) return false;
      return exists(`${sanitizeFilename(String(args[0]))}.mp3`, {
        baseDir: BaseDirectory.Download
      });
    case 'get-system-fonts':
      return ['Microsoft YaHei UI', 'SimHei', 'SimSun', 'Arial'];
    case 'get-search-suggestions': {
      const keyword = String(args[0] || '').trim();
      if (!keyword) return [];
      const url = new URL('http://msearchcdn.kugou.com/new/app/i/search.php');
      url.searchParams.set('cmd', '302');
      url.searchParams.set('keyword', keyword);
      return fetch(url, { signal: AbortSignal.timeout(5000) })
        .then((response) => response.json())
        .catch(() => []);
    }
    case 'lx-music-http-request': {
      const request = args[0] || {};
      const options = request.options || {};
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(options.headers || {})
      };
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers,
        signal: AbortSignal.timeout(options.timeout || 15000)
      };
      if (options.body) fetchOptions.body = options.body;
      else if (options.form) {
        fetchOptions.body = new URLSearchParams(options.form).toString();
        (fetchOptions.headers as Record<string, string>)['Content-Type'] =
          'application/x-www-form-urlencoded';
      }
      const response = await (isTauriRuntime ? tauriFetch : fetch)(request.url, fetchOptions);
      const rawBody = await response.text();
      let body: any = rawBody;
      const contentType = response.headers.get('content-type') || '';
      if (
        contentType.includes('application/json') ||
        rawBody.startsWith('{') ||
        rawBody.startsWith('[')
      ) {
        try {
          body = JSON.parse(rawBody);
        } catch (error) {
          console.warn('解析音乐接口响应 JSON 失败，保留原始文本内容。', error);
        }
      }
      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body
      };
    }
    case 'lx-music-http-cancel':
      return undefined;
    case 'scan-local-music':
      return postToMusicApi('/alger-tauri/scan-local-music', { folderPath: args[0] });
    case 'scan-local-music-with-stats':
      return postToMusicApi('/alger-tauri/scan-local-music-with-stats', { folderPath: args[0] });
    case 'parse-local-music-metadata':
      return postToMusicApi('/alger-tauri/parse-local-music-metadata', {
        filePaths: args[0] || []
      });
    case 'import-custom-api-plugin': {
      if (!isTauriRuntime) return null;
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      if (!selected || Array.isArray(selected)) return null;
      const content = await readTextFile(selected);
      const pluginData = JSON.parse(content);
      if (!pluginData.name || !pluginData.apiUrl)
        throw new Error('无效的插件文件，缺少 name 或 apiUrl 字段。');
      return { name: pluginData.name, content };
    }
    case 'import-lx-music-script': {
      if (!isTauriRuntime) return null;
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'JavaScript Files', extensions: ['js'] }]
      });
      if (!selected || Array.isArray(selected)) return null;
      const content = await readTextFile(selected);
      if (
        !content.includes('globalThis.lx') &&
        !content.includes('lx.on') &&
        !content.includes('EVENT_NAMES')
      ) {
        throw new Error('无效的落雪音源脚本，未找到 globalThis.lx 相关代码。');
      }
      const name = selected.split(/[\\/]/).pop()?.replace(/\.js$/i, '') || 'lx-script';
      return { name, content };
    }
    case 'unblock-music':
      return postToMusicApi('/alger-tauri/unblock-music', {
        id: args[0],
        songData: args[1],
        enabledSources: args[2]
      });
    default:
      if (!isTauriRuntime) return null;
      return invoke(channel.replaceAll('-', '_'), args[0] ?? {}).catch(() => null);
  }
};

const on = (channel: string, listener: Listener) => {
  if (!listeners.has(channel)) listeners.set(channel, new Set());
  listeners.get(channel)!.add(listener);
  void ensureTauriListener(channel);
  return () => removeListener(channel, listener);
};

const removeListener = (channel: string, listener: Listener) => {
  listeners.get(channel)?.delete(listener);
};

const removeAllListeners = (channel: string) => {
  listeners.delete(channel);
};

const ipcRenderer = {
  send,
  sendSync,
  invoke: invokeChannel,
  on,
  removeListener,
  removeAllListeners
};

const api = {
  minimize: () => send('minimize-window'),
  maximize: () => send('maximize-window'),
  close: () => send('close-window'),
  quitApp: () => send('quit-app'),
  dragStart: () => send('drag-start'),
  miniTray: () => send('mini-tray'),
  miniWindow: () => send('mini-window'),
  restore: () => send('restore-window'),
  hideTrayPanel: () => send('hide-tray-panel'),
  restart: () => send('restart'),
  resizeWindow: (width: number, height: number) => send('resize-window', width, height),
  resizeMiniWindow: (showPlaylist: boolean) => send('resize-mini-window', showPlaylist),
  openLyric: () => send('open-lyric'),
  sendLyric: (data: any) => send('send-lyric', data),
  sendSong: (data: any) => send('update-current-song', data),
  unblockMusic: (id: any, data: any, enabledSources: any) =>
    invokeChannel('unblock-music', id, data, enabledSources),
  importCustomApiPlugin: () => invokeChannel('import-custom-api-plugin'),
  importLxMusicScript: () => invokeChannel('import-lx-music-script'),
  onLyricWindowClosed: (callback: () => void) => on('lyric-window-closed', callback),
  onLyricWindowReady: (callback: () => void) => on('lyric-window-ready', callback),
  getAppUpdateState: () => invokeChannel('app-update:get-state'),
  checkAppUpdate: (manual = false) => invokeChannel('app-update:check', { manual }),
  downloadAppUpdate: () => invokeChannel('app-update:download'),
  installAppUpdate: () => invokeChannel('app-update:quit-and-install'),
  openAppUpdatePage: () => invokeChannel('app-update:open-release-page'),
  onAppUpdateState: (callback: (state: any) => void) =>
    on('app-update:state', (_event: any, state: any) => callback(state)),
  removeAppUpdateListeners: () => removeAllListeners('app-update:state'),
  onLanguageChanged: (callback: (locale: string) => void) =>
    on('language-changed', (_event: any, locale: string) => callback(locale)),
  updateTrayState: (state: TrayStatePayload) => send('update-tray-state', state),
  sendTrayPanelCommand: (payload: { action: string; value?: number }) =>
    send('tray-panel-command', payload),
  onTrayControl: (callback: (action: string) => void) =>
    on('tray-control', (_event: any, payload: any) => {
      const action = typeof payload === 'string' ? payload : payload?.action;
      if (action) callback(action);
    }),
  invoke: invokeChannel,
  getSearchSuggestions: (keyword: string) => invokeChannel('get-search-suggestions', keyword),
  lxMusicHttpRequest: (request: any) => invokeChannel('lx-music-http-request', request),
  lxMusicHttpCancel: (requestId: string) => invokeChannel('lx-music-http-cancel', requestId),
  scanLocalMusic: (folderPath: string) => invokeChannel('scan-local-music', folderPath),
  scanLocalMusicWithStats: (folderPath: string) =>
    invokeChannel('scan-local-music-with-stats', folderPath),
  parseLocalMusicMetadata: (filePaths: string[]) =>
    invokeChannel('parse-local-music-metadata', filePaths)
};

const electron = {
  ipcRenderer,
  process: {
    platform: sendSync('get-platform'),
    arch: sendSync('get-arch')
  }
};

(window as any).electron = electron;
(window as any).api = api;
(window as any).ipcRenderer = ipcRenderer;
void getStore();
