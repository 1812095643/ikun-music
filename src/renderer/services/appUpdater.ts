import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

import config from '../../../package.json';
import {
  APP_UPDATE_RELEASE_URL,
  APP_UPDATE_STATUS,
  type AppUpdateState,
  createDefaultAppUpdateState
} from '../../shared/appUpdate';

type AvailableUpdate = { version: string; notes: string; size?: number };
let state = createDefaultAppUpdateState(config.version);
let checking: Promise<AppUpdateState> | null = null;
let busy = false;
let progressListener: Promise<unknown> | null = null;
const listeners = new Set<(state: AppUpdateState) => void>();
const publish = (patch: Partial<AppUpdateState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener({ ...state }));
};
export const getAppUpdateState = async () => ({ ...state });
export const onAppUpdateState = (listener: (state: AppUpdateState) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const removeAppUpdateListeners = () => listeners.clear();

export const checkAppUpdate = async (manual = false) => {
  if (busy || state.status === APP_UPDATE_STATUS.downloaded) return state;
  if (checking) return checking;
  checking = (async () => {
    publish({ supported: true, status: APP_UPDATE_STATUS.checking, errorMessage: null });
    try {
      const update = await invoke<AvailableUpdate | null>('check_app_update');
      publish({
        status: update ? APP_UPDATE_STATUS.available : APP_UPDATE_STATUS.notAvailable,
        availableVersion: update?.version || null,
        releaseNotes: update?.notes || '',
        totalBytes: update?.size || 0,
        downloadProgress: 0,
        downloadedBytes: 0,
        checkedAt: Date.now(),
        releasePageUrl: APP_UPDATE_RELEASE_URL
      });
    } catch (error) {
      publish({
        status: manual ? APP_UPDATE_STATUS.error : APP_UPDATE_STATUS.idle,
        errorMessage: String(error),
        checkedAt: Date.now()
      });
    } finally {
      checking = null;
    }
    return state;
  })();
  return checking;
};

export const downloadAppUpdate = async () => {
  if (busy || !state.availableVersion) return state;
  busy = true;
  try {
    if (!progressListener) {
      progressListener = listen<{ stage: string; downloaded: number; total?: number }>(
        'app-update-progress',
        ({ payload }) => {
          if (payload.stage !== 'downloading') return;
          const total = payload.total || state.totalBytes;
          publish({
            downloadedBytes: payload.downloaded,
            totalBytes: total,
            downloadProgress: total > 0 ? Math.min(99, (payload.downloaded / total) * 100) : 0
          });
        }
      ).catch((error) => {
        progressListener = null;
        throw error;
      });
    }
    await progressListener;
    publish({ status: APP_UPDATE_STATUS.downloading, errorMessage: null });
    await invoke('download_app_update', { version: state.availableVersion });
    // 官方插件验证签名与 SHA-256 都完成后，才允许界面进入可安装状态。
    publish({ status: APP_UPDATE_STATUS.downloaded, downloadProgress: 100 });
  } catch (error) {
    publish({ status: APP_UPDATE_STATUS.error, errorMessage: String(error) });
  } finally {
    busy = false;
  }
  return state;
};

export const installAppUpdate = async () => {
  if (busy || state.status !== APP_UPDATE_STATUS.downloaded) return false;
  busy = true;
  try {
    await invoke('install_app_update', { version: state.availableVersion });
    return true;
  } catch (error) {
    publish({ status: APP_UPDATE_STATUS.error, errorMessage: String(error) });
    return false;
  } finally {
    busy = false;
  }
};
export const openAppUpdatePage = async () => {
  await openUrl(APP_UPDATE_RELEASE_URL);
  return true;
};
