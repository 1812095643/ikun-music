import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
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

const isTauriRuntime = Boolean((window as any).__TAURI_INTERNALS__);
const BROWSER_STORE_KEY = 'alger-music-tauri-browser-store';
const listeners = new Map<string, Set<Listener>>();
const unlisteners = new Map<string, UnlistenFn>();
let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
let storePromise: Promise<CompatStore> | null = null;
let storeCache: StoreData = {
  set: { ...(defaultSettings as Record<string, any>) },
  shortcuts: {}
};

const getAppWindow = () => {
  if (!isTauriRuntime) return null;
  if (!appWindow) appWindow = getCurrentWindow();
  return appWindow;
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

const startMusicApiService = async () => {
  if (!isTauriRuntime) return;
  await getStore();
  const result = await invoke<{ port?: number }>('start_music_api', {
    port: storeCache.set.musicApiPort || 30488
  }).catch((error) => {
    console.error('启动音乐 API 服务失败:', error);
    return null;
  });
  if (result?.port && result.port !== storeCache.set.musicApiPort) {
    await setStoreValue('set.musicApiPort', result.port);
  }
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
  await startMusicApiService();
  const response = await fetch(`http://127.0.0.1:${storeCache.set.musicApiPort}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
};

const emitLocal = (channel: string, ...args: any[]) => {
  listeners.get(channel)?.forEach((listener) => listener({ sender: null }, ...args));
};

const ensureTauriListener = async (channel: string) => {
  if (!isTauriRuntime) return;
  if (unlisteners.has(channel)) return;
  const unlisten = await listen(channel, (event) => {
    emitLocal(channel, event.payload);
  });
  unlisteners.set(channel, unlisten);
};

const send = (channel: string, ...args: any[]) => {
  const currentWindow = getAppWindow();
  switch (channel) {
    case 'minimize-window':
      void currentWindow?.minimize();
      break;
    case 'maximize-window':
      void currentWindow?.toggleMaximize();
      break;
    case 'close-window':
      void currentWindow?.close();
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
      void invoke('set_window_size', { width: args[0] ? 420 : 360, height: args[0] ? 620 : 120 });
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
            new Notification(args[0]?.title || 'AlgerMusicPlayer', { body: args[0]?.body });
        });
      }
      break;
    case 'mini-window':
    case 'mini-tray':
      emitLocal('mini-mode', true);
      break;
    case 'restore-window':
      emitLocal('mini-mode', false);
      void currentWindow?.show();
      break;
    case 'set-store-value':
      void setStoreValue(args[0], args[1]);
      break;
    case 'change-language':
      void setStoreValue('set.language', args[0]);
      emitLocal('language-changed', args[0]);
      break;
    case 'restart':
      window.location.reload();
      break;
    default:
      if (isTauriRuntime)
        void invoke('emit_to_main', { event: channel, payload: args[0] ?? null }).catch(
          () => undefined
        );
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
      const fetchOptions: RequestInit = { method: options.method || 'GET', headers };
      if (options.body) fetchOptions.body = options.body;
      else if (options.form) {
        fetchOptions.body = new URLSearchParams(options.form).toString();
        (fetchOptions.headers as Record<string, string>)['Content-Type'] =
          'application/x-www-form-urlencoded';
      }
      const response = await fetch(request.url, fetchOptions);
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
