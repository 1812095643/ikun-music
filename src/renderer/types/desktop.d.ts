import type { LocalMusicMeta } from './localMusic';

type TrayStatePayload = {
  title?: string;
  artist?: string;
  isPlaying: boolean;
  hasSong: boolean;
  volume: number;
  muted: boolean;
};
type TrayPanelCommandPayload = { action: string; value?: number };
interface DesktopBridgeEvents {
  send: (channel: string, ...args: any[]) => void;
  sendSync: (channel: string, ...args: any[]) => any;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  removeListener: (channel: string, listener: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}
interface DesktopBridge extends DesktopBridgeEvents, IDesktopAPI {
  process: { platform: string; arch: string };
}
export interface IDesktopAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  quitApp: () => void;
  dragStart: (data?: any) => void;
  miniTray: () => void;
  miniWindow: () => void;
  restore: () => void;
  hideTrayPanel: () => void;
  restart: () => void;
  resizeWindow: (width: number, height: number) => void;
  resizeMiniWindow: (showPlaylist: boolean) => void;
  openLyric: () => void;
  sendLyric: (data: any) => void;
  sendSong: (data: any) => void;
  unblockMusic: (id: any, data?: any, enabledSources?: any) => Promise<any>;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  onLyricWindowClosed: (callback: (payload?: any) => void) => any;
  onLyricWindowReady: (callback: (payload?: any) => void) => any;
  getAppUpdateState: () => Promise<any>;
  checkAppUpdate: (manual?: boolean) => Promise<any>;
  downloadAppUpdate: () => Promise<any>;
  installAppUpdate: () => Promise<boolean>;
  openAppUpdatePage: () => Promise<boolean>;
  onAppUpdateState: (callback: (state: any) => void) => any;
  removeAppUpdateListeners: () => void;
  onLanguageChanged: (callback: (locale: string) => void) => any;
  updateTrayState: (state: TrayStatePayload) => void;
  onTrayControl: (callback: (action: string) => void) => () => void;
  sendTrayPanelCommand?: (payload: TrayPanelCommandPayload) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  getSearchSuggestions: (keyword: string) => Promise<any>;
  lxMusicHttpRequest: (request: any) => Promise<any>;
  lxMusicHttpCancel: (requestId: string) => Promise<void>;
  scanLocalMusic: (folderPath: string) => Promise<any>;
  scanLocalMusicWithStats: (folderPath: string) => Promise<any>;
  parseLocalMusicMetadata: (filePaths: string[]) => Promise<LocalMusicMeta[]>;
}
declare global {
  interface Window {
    desktop: DesktopBridge;
    $message: any;
  }
}
export {};
