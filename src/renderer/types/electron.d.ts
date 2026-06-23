import type { LocalMusicMeta } from './localMusic';

type TrayStatePayload = {
  title?: string;
  artist?: string;
  isPlaying: boolean;
  hasSong: boolean;
  volume: number;
  muted: boolean;
};

type TrayPanelCommandPayload = {
  action: string;
  value?: number;
};

export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  dragStart: (_data: string) => void;
  miniTray: () => void;
  miniWindow: () => void;
  restore: () => void;
  hideTrayPanel: () => void;
  restart: () => void;
  resizeWindow: (_width: number, _height: number) => void;
  resizeMiniWindow: (_showPlaylist: boolean) => void;
  openLyric: () => void;
  sendLyric: (_data: string) => void;
  sendSong: (_data: any) => void;
  unblockMusic: (_id: number) => Promise<string>;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  onLyricWindowClosed: (_callback: () => void) => void;
  onLyricWindowReady: (_callback: () => void) => void;
  onLanguageChanged: (_callback: (_locale: string) => void) => void;
  updateTrayState: (_state: TrayStatePayload) => void;
  onTrayControl: (_callback: (_action: string) => void) => () => void;
  sendTrayPanelCommand?: (_payload: TrayPanelCommandPayload) => void;
  invoke: (_channel: string, ..._args: any[]) => Promise<any>;
  getSearchSuggestions: (_keyword: string) => Promise<any>;
  lxMusicHttpRequest: (_request: any) => Promise<any>;
  lxMusicHttpCancel: (_requestId: string) => Promise<void>;
  store: {
    get: (_key: string) => Promise<any>;
    set: (_key: string, _value: any) => Promise<boolean>;
    delete: (_key: string) => Promise<boolean>;
  };
  /** 扫描指定文件夹中的本地音乐文件 */
  scanLocalMusic: (_folderPath: string) => Promise<{ files: string[]; count: number }>;
  /** 扫描指定文件夹中的本地音乐文件（包含修改时间） */
  scanLocalMusicWithStats: (
    _folderPath: string
  ) => Promise<{ files: { path: string; modifiedTime: number }[]; count: number }>;
  /** 批量解析本地音乐文件元数据 */
  parseLocalMusicMetadata: (_filePaths: string[]) => Promise<LocalMusicMeta[]>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
