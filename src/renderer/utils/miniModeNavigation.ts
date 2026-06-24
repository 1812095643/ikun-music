const MINI_MODE_RETURN_ROUTE_KEY = 'currentRoute';
const MINI_MODE_PENDING_ROUTE_KEY = 'miniModePendingRoute';
const MINI_MODE_PENDING_PLAYLIST_DRAWER_SONG_ID_KEY = 'miniModePendingPlaylistDrawerSongId';
const BROWSER_MINI_MODE_KEY = 'browserMiniMode';

type RestoreMainWindowOptions = {
  beforeRestore?: () => void;
  restore?: (() => void) | null;
  playlistDrawerSongId?: number | string;
  targetRoute?: string;
};

export const rememberMiniModeReturnRoute = (fullPath: string) => {
  localStorage.removeItem(MINI_MODE_PENDING_ROUTE_KEY);
  localStorage.removeItem(MINI_MODE_PENDING_PLAYLIST_DRAWER_SONG_ID_KEY);
  localStorage.setItem(MINI_MODE_RETURN_ROUTE_KEY, fullPath);
};

export const setBrowserMiniModeFlag = (enabled: boolean) => {
  if (enabled) {
    localStorage.setItem(BROWSER_MINI_MODE_KEY, '1');
    return;
  }
  localStorage.removeItem(BROWSER_MINI_MODE_KEY);
};

export const hasBrowserMiniModeFlag = () => {
  return localStorage.getItem(BROWSER_MINI_MODE_KEY) === '1';
};

export const requestMiniModeNavigation = (targetRoute: string) => {
  localStorage.setItem(MINI_MODE_PENDING_ROUTE_KEY, targetRoute);
};

export const requestMiniModePlaylistDrawer = (songId: number | string) => {
  localStorage.setItem(MINI_MODE_PENDING_PLAYLIST_DRAWER_SONG_ID_KEY, String(songId));
};

export const restoreMainWindowFromMiniMode = ({
  beforeRestore,
  playlistDrawerSongId,
  restore,
  targetRoute
}: RestoreMainWindowOptions) => {
  beforeRestore?.();
  if (targetRoute) {
    requestMiniModeNavigation(targetRoute);
  }
  if (playlistDrawerSongId !== undefined && playlistDrawerSongId !== null) {
    requestMiniModePlaylistDrawer(playlistDrawerSongId);
  }
  restore?.();
};

export const consumeMiniModeRestoreRoute = () => {
  const pendingRoute = localStorage.getItem(MINI_MODE_PENDING_ROUTE_KEY);
  if (pendingRoute) {
    localStorage.removeItem(MINI_MODE_PENDING_ROUTE_KEY);
    localStorage.removeItem(MINI_MODE_RETURN_ROUTE_KEY);
    return pendingRoute;
  }

  const returnRoute = localStorage.getItem(MINI_MODE_RETURN_ROUTE_KEY);
  if (returnRoute) {
    localStorage.removeItem(MINI_MODE_RETURN_ROUTE_KEY);
  }
  return returnRoute;
};

export const consumeMiniModePlaylistDrawerSongId = () => {
  const pendingSongId = localStorage.getItem(MINI_MODE_PENDING_PLAYLIST_DRAWER_SONG_ID_KEY);
  if (pendingSongId) {
    localStorage.removeItem(MINI_MODE_PENDING_PLAYLIST_DRAWER_SONG_ID_KEY);
    return pendingSongId;
  }
  return null;
};
