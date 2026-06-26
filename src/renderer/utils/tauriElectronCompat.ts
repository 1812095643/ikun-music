import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { Store } from '@tauri-apps/plugin-store';

import defaultSettings from '../../main/set.json';
import {
  consumeMiniModeRestoreRoute,
  rememberMiniModeReturnRoute,
  setBrowserMiniModeFlag
} from './miniModeNavigation';

type Listener = (...args: any[]) => void;

type StoreData = {
  set: Record<string, any>;
  shortcuts: Record<string, any>;
  downloadedSongs: Record<string, any>;
  downloadHistory: any[];
};

type CompatStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
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
const BROWSER_LYRIC_RETURN_ROUTE_KEY = 'alger-music-browser-lyric-return-route';
const MAIN_WINDOW_LABEL = 'main';
const TRAY_PANEL_WINDOW_LABEL = 'tray-panel';
const LYRIC_WINDOW_LABEL = 'lyric-window';
const listeners = new Map<string, Set<Listener>>();
const unlisteners = new Map<string, UnlistenFn>();
let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
let currentWebviewWindow: ReturnType<typeof getCurrentWebviewWindow> | null = null;
let storePromise: Promise<CompatStore> | null = null;
let musicApiReadyPromise: Promise<number | null> | null = null;
let storeCache: StoreData = {
  set: { ...(defaultSettings as Record<string, any>) },
  shortcuts: {},
  downloadedSongs: {},
  downloadHistory: []
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
    shortcuts: storedStore.shortcuts || {},
    downloadedSongs: storedStore.downloadedSongs || {},
    downloadHistory: storedStore.downloadHistory || []
  };
  saveBrowserStore();
  return {
    get: async <T>(key: string) => storeCache[key as keyof StoreData] as T | undefined,
    set: async (key: keyof StoreData, value: any) => {
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
    const storedDownloadedSongs = await store.get<Record<string, any>>('downloadedSongs');
    const storedDownloadHistory = await store.get<any[]>('downloadHistory');
    storeCache = {
      set: { ...(defaultSettings as Record<string, any>), ...(storedSet || {}) },
      shortcuts: storedShortcuts || {},
      downloadedSongs: storedDownloadedSongs || {},
      downloadHistory: storedDownloadHistory || []
    };
    await store.set('set', storeCache.set);
    await store.set('shortcuts', storeCache.shortcuts);
    await store.set('downloadedSongs' as any, storeCache.downloadedSongs);
    await store.set('downloadHistory' as any, storeCache.downloadHistory);
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

const hasLocalListeners = (channel: string) => {
  return (listeners.get(channel)?.size || 0) > 0;
};

const getBrowserHashRoute = () => window.location.hash.replace(/^#/, '') || '/';

const navigateBrowserHashRoute = (route: string) => {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  const targetHash = `#${normalizedRoute}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = normalizedRoute;
  }
};

const openBrowserLyricRoute = () => {
  const currentRoute = getBrowserHashRoute();
  if (!currentRoute.includes('/lyric')) {
    localStorage.setItem(BROWSER_LYRIC_RETURN_ROUTE_KEY, currentRoute);
  }
  navigateBrowserHashRoute('/lyric');
};

const closeBrowserLyricRoute = () => {
  const returnRoute = localStorage.getItem(BROWSER_LYRIC_RETURN_ROUTE_KEY) || '/';
  localStorage.removeItem(BROWSER_LYRIC_RETURN_ROUTE_KEY);
  navigateBrowserHashRoute(returnRoute);
};

const sanitizeFilename = (filename: string) =>
  filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || `音乐_${Date.now()}`;

const pathSeparator = navigator.platform.toLowerCase().includes('win') ? '\\' : '/';

const joinPath = (...parts: string[]) =>
  parts
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.replace(/[\\/]+$/g, '')
        : part.replace(/^[\\/]+/g, '').replace(/[\\/]+$/g, '')
    )
    .join(pathSeparator);

const getFileStem = (filePath: string) => filePath.replace(/\.[^/.\\]+$/g, '');

const getDownloadExtension = (url: string, type?: string) => {
  if (type) return type.startsWith('.') ? type : `.${type}`;
  const matched = new URL(url).pathname.match(/\.(mp3|flac|m4a|aac|ogg|wav)(?:$|\?)/i);
  return matched?.[0] || '.mp3';
};

const ensureDefaultDownloadPath = async () => {
  await getStore();
  if (storeCache.set.downloadPath) return storeCache.set.downloadPath;
  if (!isTauriRuntime) return '';
  const downloadsPath = await invoke<string>('get_downloads_path');
  await setStoreValue('set.downloadPath', downloadsPath);
  return downloadsPath;
};

const getDownloadRecordStore = () => {
  const records = storeCache.downloadedSongs;
  return records && typeof records === 'object' ? records : {};
};

const setDownloadRecordStore = async (records: Record<string, any>) => {
  await getStore();
  storeCache.downloadedSongs = records;
  const store = await getStore();
  await store.set('downloadedSongs' as any, records);
  await store.save();
};

const setDownloadHistoryStore = async (history: any[]) => {
  await getStore();
  storeCache.downloadHistory = history;
  const store = await getStore();
  await store.set('downloadHistory' as any, history);
  await store.save();
};

const getUniqueFilePath = async (directory: string, filename: string, extension: string) => {
  let counter = 0;
  while (true) {
    const suffix = counter === 0 ? '' : ` (${counter})`;
    const filePath = joinPath(directory, `${filename}${suffix}${extension}`);
    const existsOnDisk = isTauriRuntime
      ? await invoke<boolean>('local_file_exists', { path: filePath })
      : false;
    if (!existsOnDisk) return filePath;
    counter += 1;
  }
};

const downloadMusicFile = async (payload: any) => {
  const { url, filename, songInfo, type, quality, downloadKey } = payload || {};
  if (!url || !filename) {
    emitLocal('music-download-error', { filename, error: '下载参数不完整' });
    return;
  }

  const safeName = sanitizeFilename(filename);
  const extension = getDownloadExtension(url, type);
  try {
    emitLocal('music-download-queued', { filename: safeName, songInfo, quality, downloadKey });
    const downloadPath = await ensureDefaultDownloadPath();
    const filePath = downloadPath
      ? await getUniqueFilePath(downloadPath, safeName, extension)
      : `${safeName}${extension}`;

    const response = await (isTauriRuntime ? tauriFetch : fetch)(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = new Uint8Array(await response.arrayBuffer());

    emitLocal('music-download-progress', {
      filename: safeName,
      progress: 100,
      loaded: buffer.byteLength,
      total: buffer.byteLength,
      path: filePath,
      status: 'completed',
      songInfo,
      quality,
      downloadKey
    });

    if (isTauriRuntime) {
      // 根因：旧 Tauri 兼容层直接写 BaseDirectory.Download，完全绕开用户在设置里选择的
      // downloadPath；并且前端 fs 插件对任意绝对路径有 scope 限制，用户选择 D 盘目录时会
      // 写入失败或写到系统下载目录。这里把“已授权的下载目录绝对路径写入”收口到 Rust
      // 命令，由 Rust 创建目录并落盘，前端只负责下载 URL 与事件协议。
      await invoke('write_local_file', { request: { path: filePath, bytes: Array.from(buffer) } });
    } else {
      const blob = new Blob([buffer]);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filePath;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }

    const downloadedSong = {
      ...(songInfo || {}),
      id: songInfo?.id || 0,
      name: songInfo?.name || safeName,
      filename: safeName,
      path: filePath,
      size: buffer.byteLength,
      type: extension.replace(/^\./, ''),
      downloadTime: Date.now(),
      downloadQuality: songInfo?.downloadQuality || quality || 'default',
      downloadQualityLabel: songInfo?.downloadQualityLabel || '',
      ar: songInfo?.ar || songInfo?.song?.artists || [{ name: '本地音乐' }],
      al: songInfo?.al || songInfo?.song?.album || { name: songInfo?.name || safeName }
    };

    if (isTauriRuntime) {
      const records = { ...getDownloadRecordStore(), [filePath]: downloadedSong };
      await setDownloadRecordStore(records);
      await setDownloadHistoryStore([downloadedSong, ...(storeCache.downloadHistory || [])]);
    }

    emitLocal('music-download-complete', {
      success: true,
      filename: safeName,
      path: filePath,
      filePath,
      size: buffer.byteLength,
      songInfo: downloadedSong,
      quality,
      downloadKey,
      status: 'completed'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emitLocal('music-download-error', {
      filename: safeName,
      quality,
      downloadKey,
      error: errorMessage
    });
    emitLocal('music-download-complete', {
      success: false,
      filename: safeName,
      quality,
      downloadKey,
      error: errorMessage,
      status: 'error'
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
    'mini-mode',
    'receive-lyric',
    'lyric-window-ready',
    'lyric-window-closed',
    'lyric-control-back'
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
      if (isTauriRuntime) {
        void invoke('minimize_window');
      }
      break;
    case 'maximize-window':
      if (isTauriRuntime) {
        void invoke('maximize_window');
      }
      break;
    case 'close-window':
      if (isTauriRuntime) {
        void invoke('close_window');
      }
      break;
    case 'quit-app':
      if (isTauriRuntime) {
        void invoke('quit_app');
      }
      break;
    case 'drag-start':
      void currentWindow?.startDragging();
      break;
    case 'resize-window':
      if (isTauriRuntime) {
        void invoke('set_window_size', { width: args[0], height: args[1] });
      }
      break;
    case 'resize-mini-window':
      if (isTauriRuntime) {
        void invoke('resize_mini_window', { showPlaylist: Boolean(args[0]) });
      }
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
      if (isTauriRuntime) {
        void invoke('mini_window');
      } else {
        const currentRoute = getBrowserHashRoute();
        if (!currentRoute.includes('/mini')) {
          rememberMiniModeReturnRoute(currentRoute);
        }
        setBrowserMiniModeFlag(true);
        if (hasLocalListeners('mini-mode')) {
          emitLocal('mini-mode', true);
        } else {
          navigateBrowserHashRoute('/mini');
        }
      }
      break;
    case 'mini-tray':
      if (isTauriRuntime) {
        void invoke('mini_tray');
      }
      break;
    case 'restore-window':
      if (isTauriRuntime) {
        void invoke('restore_window');
      } else {
        setBrowserMiniModeFlag(false);
        if (hasLocalListeners('mini-mode')) {
          emitLocal('mini-mode', false);
        } else {
          const restoreRoute = consumeMiniModeRestoreRoute() || '/';
          navigateBrowserHashRoute(restoreRoute);
        }
      }
      break;
    case 'open-lyric':
      if (isTauriRuntime) {
        void invoke('open_lyric_window').catch((error) => {
          // 根因：打包态创建桌面歌词窗口失败时，旧逻辑用 void invoke 静默吞错；
          // 主窗口已经把 isLyricWindowOpen 置为 true，用户再次点击反而会走关闭分支，
          // 表现为“桌面歌词打不开”。失败时主动发 closed 事件，让前端状态回滚，
          // 同时保留错误日志，后续现场排查能看到 Rust 返回的具体原因。
          console.error('打开桌面歌词窗口失败:', error);
          emitLocal('lyric-window-closed', { closedAt: Date.now(), error: String(error) });
        });
      } else {
        openBrowserLyricRoute();
      }
      break;
    case 'send-lyric':
      if (isTauriRuntime) {
        const payload = args[0] ?? null;
        void emitTo(LYRIC_WINDOW_LABEL, 'receive-lyric', payload).catch(() => {
          void invoke('emit_to_main', { event: 'receive-lyric', payload }).catch(() => undefined);
        });
      } else {
        emitLocal('receive-lyric', args[0] ?? null);
      }
      break;
    case 'lyric-ready':
      if (isTauriRuntime) {
        const payload = args[0] ?? null;
        void emitTo(MAIN_WINDOW_LABEL, 'lyric-window-ready', payload).catch(() => {
          void invoke('emit_to_main', { event: 'lyric-window-ready', payload }).catch(
            () => undefined
          );
        });
      } else {
        emitLocal('lyric-window-ready', args[0] ?? { readyAt: Date.now() });
      }
      break;
    case 'close-lyric':
      if (isTauriRuntime) {
        void invoke('close_lyric_window');
      } else {
        emitLocal('lyric-control-back', 'close');
        emitLocal('lyric-window-closed', { closedAt: Date.now() });
        closeBrowserLyricRoute();
      }
      break;
    case 'set-ignore-mouse':
      if (isTauriRuntime) {
        void invoke('set_lyric_ignore_mouse', { ignore: Boolean(args[0]) });
      }
      break;
    case 'lyric-drag-start':
      if (isTauriRuntime) {
        void invoke('start_lyric_drag');
      }
      break;
    case 'lyric-drag-move':
      {
        const payload = args[0] || {};
        const deltaX =
          typeof payload === 'object' ? Number(payload.deltaX ?? 0) : Number(args[0] ?? 0);
        const deltaY =
          typeof payload === 'object' ? Number(payload.deltaY ?? 0) : Number(args[1] ?? 0);
        if (isTauriRuntime) {
          void invoke('move_lyric_window', {
            deltaX,
            deltaY
          });
        }
      }
      break;
    case 'lyric-drag-end':
      if (isTauriRuntime) {
        void invoke('end_lyric_drag');
      }
      break;
    case 'control-back':
      if (isTauriRuntime) {
        const payload = args[0] ?? null;
        void emitTo(MAIN_WINDOW_LABEL, 'lyric-control-back', payload).catch(() => {
          void invoke('emit_to_main', { event: 'lyric-control-back', payload }).catch(
            () => undefined
          );
        });
      } else {
        emitLocal('lyric-control-back', args[0] ?? null);
      }
      break;
    case 'hide-tray-panel':
      if (isTauriRuntime) {
        void invoke('hide_tray_panel_window');
      }
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
    case 'clear-downloads-history':
      void setDownloadHistoryStore([]);
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
        const targetLabel =
          channel === 'tray-panel-state' ? TRAY_PANEL_WINDOW_LABEL : MAIN_WINDOW_LABEL;
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
    case 'get-downloads-path':
      return ensureDefaultDownloadPath();
    case 'get-downloaded-music': {
      if (!isTauriRuntime) return [];
      const records = getDownloadRecordStore();
      const entries = await Promise.all(
        Object.entries(records).map(async ([path, info]) => {
          const existsOnDisk = await invoke<boolean>('local_file_exists', { path });
          return existsOnDisk ? info : null;
        })
      );
      const validSongs = entries
        .filter(Boolean)
        .sort((a: any, b: any) => (b.downloadTime || 0) - (a.downloadTime || 0));
      const validRecords = validSongs.reduce<Record<string, any>>((acc, item: any) => {
        if (item?.path) acc[item.path] = item;
        return acc;
      }, {});
      await setDownloadRecordStore(validRecords);
      return validSongs;
    }
    case 'delete-downloaded-music': {
      const targetPath = String(args[0] || '');
      if (!targetPath) return false;
      const deleted = isTauriRuntime
        ? await invoke<boolean>('delete_local_file', { path: targetPath })
        : false;
      const records = { ...getDownloadRecordStore() };
      delete records[targetPath];
      await setDownloadRecordStore(records);
      await setDownloadHistoryStore(
        (storeCache.downloadHistory || []).filter((item: any) => item?.path !== targetPath)
      );
      return deleted;
    }
    case 'clear-downloaded-music':
      await setDownloadRecordStore({});
      return true;
    case 'check-file-exists':
      if (!isTauriRuntime) return false;
      return invoke<boolean>('local_file_exists', { path: String(args[0] || '') });
    case 'save-lyric-file': {
      if (!isTauriRuntime) return { success: false, error: '当前运行环境不支持保存歌词文件' };
      const payload = args[0] || {};
      const safeName = sanitizeFilename(String(payload.filename || '歌词'));
      const downloadPath = await ensureDefaultDownloadPath();
      const filePath = await getUniqueFilePath(downloadPath, safeName, '.lrc');
      try {
        await invoke('write_local_text_file', {
          request: { path: filePath, content: String(payload.lrcContent || '') }
        });
        return { success: true, path: filePath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
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
      {
        const filename = sanitizeFilename(String(args[0] || ''));
        const records = getDownloadRecordStore();
        return Object.values(records).some(
          (item: any) => getFileStem(item?.filename || '') === filename
        );
      }
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
  onLyricWindowClosed: (callback: (payload?: any) => void) =>
    on('lyric-window-closed', (_event: any, payload: any) => callback(payload)),
  onLyricWindowReady: (callback: (payload?: any) => void) =>
    on('lyric-window-ready', (_event: any, payload: any) => callback(payload)),
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
