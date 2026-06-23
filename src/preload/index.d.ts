interface CompatIpcRenderer {
  send: (channel: string, ...args: any[]) => void;
  sendSync: (channel: string, ...args: any[]) => any;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  removeListener: (channel: string, listener: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

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

interface CompatApi {
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
  unblockMusic: (id: any, data: any, enabledSources: any) => Promise<any>;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  onLyricWindowClosed: (callback: () => void) => any;
  onLyricWindowReady: (callback: () => void) => any;
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
  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) => Promise<any>;
  lxMusicHttpCancel: (requestId: string) => Promise<void>;
  scanLocalMusic: (folderPath: string) => Promise<any>;
  scanLocalMusicWithStats: (folderPath: string) => Promise<any>;
  parseLocalMusicMetadata: (filePaths: string[]) => Promise<any[]>;
}

interface CompatElectron {
  ipcRenderer: CompatIpcRenderer;
  process?: { platform: string; arch: string };
}

declare global {
  interface Window {
    electron: CompatElectron;
    api: CompatApi;
    ipcRenderer: CompatIpcRenderer;
    $message: any;
  }
}

export {};
