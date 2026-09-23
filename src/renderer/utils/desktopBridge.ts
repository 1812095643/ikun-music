import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { Store } from '@tauri-apps/plugin-store';

import {
  checkAppUpdate,
  downloadAppUpdate,
  getAppUpdateState,
  installAppUpdate,
  onAppUpdateState,
  openAppUpdatePage,
  removeAppUpdateListeners
} from '@/services/appUpdater';
import { requestMusicService } from '@/services/musicService';
import type { LocalMusicMeta } from '@/types/localMusic';

import config from '../../../package.json';
import defaultSettings from '../../shared/defaultSettings.json';
import { getShortcutConflicts, normalizeShortcutsConfig } from '../../shared/shortcuts';
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
const listenerRegistrations = new Map<string, Promise<void>>();
const externalRequests = new Map<string, AbortController>();
let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
let currentWebviewWindow: ReturnType<typeof getCurrentWebviewWindow> | null = null;
let storePromise: Promise<CompatStore> | null = null;

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

/**
 * 返回鼠标相对当前桌面窗口的逻辑坐标，浏览器预览返回 null。
 * 根因：开启原生鼠标穿透后，DOM 不再收到 mouseenter，不能靠该事件唤回解锁按钮。
 * 使用 Tauri 官方坐标接口，并换算 DPI；支持 Windows 缩放及位于主屏左侧的负坐标屏幕。
 */
export const getDesktopLyricPointer = async () => {
  const currentWindow = getAppWindow();
  if (!currentWindow) return null;
  const [cursor, position, scale] = await Promise.all([
    cursorPosition(),
    currentWindow.innerPosition(),
    currentWindow.scaleFactor()
  ]);
  return { x: (cursor.x - position.x) / scale, y: (cursor.y - position.y) / scale };
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
    storePromise = (async () => {
      const store = await Store.load('config.json');
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
      return store;
    })().catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
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

const postToMusicApi = async (path: string, data: Record<string, any>) => {
  const result = await requestMusicService(path, data);
  if (result.status >= 400) throw new Error(result.body?.message || '音乐服务暂时不可用，请重试');
  return result.body;
};

const downloadTasks = new Map<string, any>();
const emitLocal = (channel: string, ...args: any[]) => {
  const data = args[0];
  if (channel.startsWith('music-download-') && data?.downloadKey) {
    if (channel === 'music-download-complete' && data.success)
      downloadTasks.delete(data.downloadKey);
    else
      downloadTasks.set(data.downloadKey, {
        progress: 0,
        loaded: 0,
        total: 0,
        path: '',
        status: 'downloading',
        ...downloadTasks.get(data.downloadKey),
        ...data,
        ...(channel === 'music-download-progress' ? { stage: data.stage || 'downloading' } : {}),
        ...(channel === 'music-download-error' ? { status: 'error' } : {})
      });
  }
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
const normalizeFilePath = (path: string) =>
  pathSeparator === '\\' ? path.replace(/\//g, '\\') : path;

const joinPath = (...parts: string[]) =>
  parts
    .filter(Boolean)
    .map(normalizeFilePath)
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
  if (storeCache.set.downloadPath) return normalizeFilePath(storeCache.set.downloadPath);
  if (!isTauriRuntime) return '';
  const downloadsPath = await invoke<string>('get_downloads_path');
  await setStoreValue('set.downloadPath', downloadsPath);
  return downloadsPath;
};

const getDownloadRecordStore = () => {
  const records = storeCache.downloadedSongs;
  return records && typeof records === 'object'
    ? Object.fromEntries(
        Object.entries(records).map(([path, record]) => [normalizeFilePath(path), record])
      )
    : {};
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

const getUniqueFilePath = async (
  directory: string,
  filename: string,
  extension: string,
  reserve = false
) => {
  let counter = 0;
  while (true) {
    const suffix = counter === 0 ? '' : ` (${counter})`;
    const filePath = joinPath(directory, `${filename}${suffix}${extension}`);
    const existsOnDisk = isTauriRuntime
      ? await invoke<boolean>('local_file_exists', { path: filePath })
      : false;
    if (!existsOnDisk && !reservedDownloadPaths.has(filePath)) {
      if (reserve) reservedDownloadPaths.add(filePath);
      return filePath;
    }
    counter += 1;
  }
};

const readLocalLyrics = (filePaths: string[], includeContent: boolean) =>
  invoke<
    Array<{ filePath: string; lyricPath: string; lyrics: string | null; modifiedTime: number }>
  >('read_local_lyrics', { filePaths, includeContent });

const parseLocalMetadata = async (filePaths: string[]): Promise<LocalMusicMeta[]> => {
  if (!filePaths.length) return [];
  const [metas, lyrics] = await Promise.all([
    postToMusicApi('/desktop/parse-local-music-metadata', { filePaths }),
    readLocalLyrics(filePaths, true)
  ]);
  const lyricMap = new Map(lyrics.map((item) => [item.filePath, item]));
  const records = getDownloadRecordStore();
  return metas.map((meta: LocalMusicMeta) => {
    const record = records[meta.filePath];
    const sidecar = lyricMap.get(meta.filePath);
    return {
      ...meta,
      title: record?.name || meta.title,
      artist: record?.ar?.map((artist: any) => artist.name).join(' / ') || meta.artist,
      album: record?.al?.name || meta.album,
      cover: meta.cover || record?.picUrl || null,
      duration: meta.duration || record?.dt || record?.duration || 0,
      lyrics: sidecar?.lyrics || meta.lyrics,
      lyricPath: sidecar?.lyrics ? sidecar.lyricPath : undefined,
      modifiedTime: Math.max(meta.modifiedTime, sidecar?.modifiedTime || 0),
      onlineId: record?.onlineId || record?.id,
      source: record?.source
    };
  });
};

const downloadedMetadataCache = new Map<string, LocalMusicMeta>();
const scanLocalStats = async (folderPath: string) => {
  const result = await postToMusicApi('/desktop/scan-local-music-with-stats', { folderPath });
  const lyrics = await readLocalLyrics(
    result.files.map((file: any) => file.path),
    false
  );
  const modified = new Map(lyrics.map((item) => [item.filePath, item.modifiedTime]));
  return {
    ...result,
    files: result.files.map((file: any) => ({
      ...file,
      modifiedTime: Math.max(file.modifiedTime, modified.get(file.path) || 0)
    }))
  };
};

const getDownloadedMusic = async () => {
  const directory = await ensureDefaultDownloadPath();
  const { files } = await scanLocalStats(directory);
  const changed = files.filter(
    (file: any) => downloadedMetadataCache.get(file.path)?.modifiedTime !== file.modifiedTime
  );
  for (let offset = 0; offset < changed.length; offset += 40) {
    const entries = await parseLocalMetadata(
      changed.slice(offset, offset + 40).map((file: any) => file.path)
    );
    entries.forEach((entry) => downloadedMetadataCache.set(entry.filePath, entry));
  }
  const paths = new Set(files.map((file: any) => file.path));
  const records = getDownloadRecordStore();
  for (const path of downloadedMetadataCache.keys()) {
    if (!paths.has(path)) downloadedMetadataCache.delete(path);
  }
  return files
    .map((file: any) => {
      const meta = downloadedMetadataCache.get(file.path)!;
      return {
        ...meta,
        id: `local:${meta.filePath}`,
        path: meta.filePath,
        name: meta.title,
        filename: meta.filePath.split(/[\\/]/).pop() || meta.title,
        size: meta.fileSize,
        picUrl: meta.cover || '',
        ar: [{ name: meta.artist }],
        al: { name: meta.album, picUrl: meta.cover || '' },
        downloadTime: records[meta.filePath]?.downloadTime || meta.modifiedTime
      };
    })
    .sort((a: any, b: any) => b.downloadTime - a.downloadTime);
};

const reservedDownloadPaths = new Set<string>();
let downloadRecordWrite: Promise<void> = Promise.resolve();

const downloadMusicFile = async (payload: any) => {
  const { url, filename, songInfo, type, quality, downloadKey } = payload || {};
  if (!url || !filename) {
    emitLocal('music-download-error', { filename, error: '下载参数不完整' });
    return;
  }

  const nameFormat = storeCache.set.downloadNameFormat || '{songName} - {artistName}';
  const safeName = sanitizeFilename(
    nameFormat
      .replace(/\{songName\}/g, songInfo?.name || filename)
      .replace(
        /\{artistName\}/g,
        (songInfo?.ar || songInfo?.song?.artists || [])
          .map((artist: any) => artist.name)
          .join(', ') || '未知歌手'
      )
      .replace(/\{albumName\}/g, songInfo?.al?.name || '未知专辑')
  );
  const extension = getDownloadExtension(url, type);
  let filePath = '';
  try {
    emitLocal('music-download-queued', { filename: safeName, songInfo, quality, downloadKey });
    const downloadPath = await ensureDefaultDownloadPath();
    filePath = downloadPath
      ? await getUniqueFilePath(downloadPath, safeName, extension, true)
      : `${safeName}${extension}`;
    reservedDownloadPaths.add(filePath);
    await ensureTauriListener('music-download-progress');
    const size = await invoke<number>('download_music_file', {
      request: { url, path: filePath, filename: safeName, songInfo, quality, downloadKey }
    });

    emitLocal('music-download-progress', {
      filename: safeName,
      downloadKey,
      path: filePath,
      loaded: size,
      total: size,
      progress: 99,
      stage: 'lyrics'
    });
    let lyricWarning = '';
    let lyricPath: string | undefined;
    if (storeCache.set.downloadSaveLyric !== false) {
      try {
        const { loadLyricCandidates } = await import('@/services/lyricCandidateService');
        const { lyricToLrc } = await import('@/services/localLyricService');
        const lyric = songInfo?.lyric?.lrcArray?.length
          ? songInfo.lyric
          : (await loadLyricCandidates(songInfo)).activeCandidate?.lyric;
        const content = lyricToLrc(lyric);
        if (content) {
          lyricPath = `${getFileStem(filePath)}.lrc`;
          await invoke('write_local_text_file', { request: { path: lyricPath, content } });
        } else lyricWarning = '音乐已保存，暂未匹配到歌词，可在播放页重新搜索';
      } catch {
        lyricWarning = '音乐已保存，歌词暂未保存成功，可在播放页重新搜索';
      }
    }

    const downloadedSong = {
      id: songInfo?.id || 0,
      source: songInfo?.source,
      picUrl: songInfo?.picUrl || songInfo?.al?.picUrl || '',
      dt: songInfo?.dt || songInfo?.duration || 0,
      name: songInfo?.name || safeName,
      filename: safeName,
      path: filePath,
      size,
      lyricPath,
      type: extension.replace(/^\./, ''),
      downloadTime: Date.now(),
      downloadQuality: songInfo?.downloadQuality || quality || 'default',
      downloadQualityLabel: songInfo?.downloadQualityLabel || '',
      ar: songInfo?.ar || songInfo?.song?.artists || [{ name: '本地音乐' }],
      al: songInfo?.al || songInfo?.song?.album || { name: songInfo?.name || safeName }
    };

    if (isTauriRuntime) {
      const write = downloadRecordWrite
        .catch(() => undefined)
        .then(async () => {
          await setDownloadRecordStore({ ...getDownloadRecordStore(), [filePath]: downloadedSong });
          await setDownloadHistoryStore([downloadedSong, ...(storeCache.downloadHistory || [])]);
        });
      downloadRecordWrite = write;
      await write;
      downloadedMetadataCache.delete(filePath);
    }

    emitLocal('music-download-complete', {
      success: true,
      filename: safeName,
      path: filePath,
      filePath,
      size,
      lyricWarning,
      songInfo: downloadedSong,
      quality,
      downloadKey,
      status: 'completed'
    });
    emitLocal('music-library-changed', { path: filePath });
    return { success: true, path: filePath, lyricWarning };
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
    return { success: false, error: errorMessage };
  } finally {
    reservedDownloadPaths.delete(filePath);
  }
};

const registerTauriListener = async (channel: string) => {
  if (!isTauriRuntime) return;
  if (unlisteners.has(channel)) return;
  const windowScopedEvents = new Set([
    'tray-panel-state',
    'tray-panel-spectrum',
    'tray-panel-closed',
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

const ensureTauriListener = (channel: string): Promise<void> => {
  if (!isTauriRuntime || unlisteners.has(channel)) return Promise.resolve();
  const existing = listenerRegistrations.get(channel);
  if (existing) return existing;
  const pending = registerTauriListener(channel).finally(() =>
    listenerRegistrations.delete(channel)
  );
  listenerRegistrations.set(channel, pending);
  return pending;
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
        // 根因：on() 立即返回，但原生监听注册需要异步 IPC。之前立即发送 ready，
        // 主窗口可能在监听生效前回传整首歌词，暂停状态又没有下一次完整同步。
        // 等歌词接收器确认就绪后再握手；并发注册复用同一 Promise，避免重复监听。
        void ensureTauriListener('receive-lyric')
          .then(() => emitTo(MAIN_WINDOW_LABEL, 'lyric-window-ready', payload))
          .catch((error) => console.error('桌面歌词同步尚未就绪，请关闭后重试：', error));
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
    case 'disable-shortcuts':
      void import('./appShortcuts').then((module) => module.setAppShortcutsSuspended(true));
      break;
    case 'enable-shortcuts':
      void import('./appShortcuts').then((module) => module.setAppShortcutsSuspended(false));
      break;
    case 'restart':
      window.location.reload();
      break;
    default:
      if (isTauriRuntime) {
        const targetLabel = ['tray-panel-state', 'tray-panel-spectrum'].includes(channel)
          ? TRAY_PANEL_WINDOW_LABEL
          : MAIN_WINDOW_LABEL;
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
  const previousDirectory = storeCache.set.downloadPath;
  setByPath(key, value);
  const store = await getStore();
  await store.set('set', storeCache.set);
  await store.set('shortcuts', storeCache.shortcuts);
  await store.save();
  if (
    (key === 'set.downloadPath' || key === 'set') &&
    previousDirectory !== storeCache.set.downloadPath
  ) {
    emitLocal('music-library-changed', { directory: storeCache.set.downloadPath });
  }
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
    case 'shortcuts:validate': {
      const conflicts = getShortcutConflicts(normalizeShortcutsConfig(args[0]));
      return { valid: conflicts.length === 0, conflicts };
    }
    case 'shortcuts:save':
      await setStoreValue('shortcuts', normalizeShortcutsConfig(args[0]));
      emitLocal('update-app-shortcuts', args[0]);
      return { success: true };
    case 'app-update:get-state':
      return getAppUpdateState();
    case 'app-update:check':
      return checkAppUpdate(Boolean(args[0]?.manual));
    case 'app-update:download':
      return downloadAppUpdate();
    case 'app-update:quit-and-install':
      return installAppUpdate();
    case 'app-update:open-release-page':
      return openAppUpdatePage();
    case 'get-downloads-path':
      return ensureDefaultDownloadPath();
    case 'download-music':
      return downloadMusicFile(args[0]);
    case 'queue-download-task':
      emitLocal('music-download-queued', {
        ...args[0],
        stage: 'resolving',
        status: 'downloading',
        progress: 0,
        loaded: 0,
        total: 0,
        error: undefined
      });
      return true;
    case 'fail-download-task':
      emitLocal('music-download-error', args[0]);
      return true;
    case 'get-download-tasks':
      return Array.from(downloadTasks.values());
    case 'get-downloaded-music': {
      if (!isTauriRuntime) return [];
      return getDownloadedMusic();
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
      downloadedMetadataCache.delete(targetPath);
      emitLocal('music-library-changed', { path: targetPath });
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
    case 'read-local-music-lyric': {
      if (!isTauriRuntime) return null;
      return (await readLocalLyrics([String(args[0])], true))[0];
    }
    case 'save-local-music-lyric': {
      const { filePath, lrcContent } = args[0] || {};
      if (!isTauriRuntime || !filePath || !lrcContent) return { success: false };
      if (!(await invoke<boolean>('local_file_exists', { path: filePath }))) {
        throw new Error('音乐文件已移动，请重新扫描目录后再保存歌词');
      }
      const path = `${getFileStem(filePath)}.lrc`;
      await invoke('write_local_text_file', { request: { path, content: String(lrcContent) } });
      downloadedMetadataCache.delete(filePath);
      emitLocal('music-library-changed', { path: filePath });
      return { success: true, path };
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
      const controller = new AbortController();
      const requestId = String(request.requestId || '');
      if (requestId) externalRequests.set(requestId, controller);
      // 根因：旧 HTTP 插件在收到响应头后可能一直等待正文，AbortSignal 本身不能
      // 保证调用 Promise 一定结束。把取响应和读正文一起纳入超时竞争，保证首页
      // 在五秒预算后能回退备用歌单；同时让音源脚本的取消操作真正中止原生请求。
      const timer = setTimeout(() => controller.abort(), options.timeout || 15000);
      const cancelled = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(new Error('音乐接口等待时间较长或请求已取消，请重试')),
          { once: true }
        );
      });
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(options.headers || {})
      };
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers,
        signal: controller.signal
      };
      if (options.body) fetchOptions.body = options.body;
      else if (options.form) {
        fetchOptions.body = new URLSearchParams(options.form).toString();
        (fetchOptions.headers as Record<string, string>)['Content-Type'] =
          'application/x-www-form-urlencoded';
      }
      try {
        return await Promise.race([
          (async () => {
            const response = await (isTauriRuntime ? tauriFetch : fetch)(request.url, fetchOptions);
            const rawBody = fetchOptions.method === 'HEAD' ? '' : await response.text();
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
          })(),
          cancelled
        ]);
      } finally {
        clearTimeout(timer);
        if (externalRequests.get(requestId) === controller) externalRequests.delete(requestId);
      }
    }
    case 'lx-music-http-cancel':
      externalRequests.get(String(args[0]))?.abort();
      return undefined;
    case 'scan-local-music':
      return postToMusicApi('/desktop/scan-local-music', { folderPath: args[0] });
    case 'scan-local-music-with-stats':
      return scanLocalStats(args[0]);
    case 'parse-local-music-metadata':
      return parseLocalMetadata(args[0] || []);
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
      return postToMusicApi('/desktop/unblock-music', {
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
  void ensureTauriListener(channel).catch((error) => {
    console.error(`桌面事件 ${channel} 注册未完成：`, error);
  });
  return () => removeListener(channel, listener);
};

const removeListener = (channel: string, listener: Listener) => {
  listeners.get(channel)?.delete(listener);
};

const removeAllListeners = (channel: string) => {
  listeners.delete(channel);
};

const desktopBridge = {
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
  onAppUpdateState,
  removeAppUpdateListeners,
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

const desktop = {
  ...desktopBridge,
  ...api,
  process: {
    platform: sendSync('get-platform'),
    arch: sendSync('get-arch')
  }
};

(window as any).desktop = desktop;
export const initializeDesktopSettings = () => getStore();
