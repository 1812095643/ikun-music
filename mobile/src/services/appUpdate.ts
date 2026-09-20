import { shallowRef } from 'vue';

import { readStorage, writeStorage } from '@/stores/library';

import { version } from '../../package.json';
import { findMobileUpdate, MOBILE_RELEASE_API, type MobileRelease } from './mobileRelease';
import { nativeDevice } from './nativeDevice';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'latest'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'error';
export const updateStatus = shallowRef<UpdateStatus>('idle');
export const updateInfo = shallowRef<MobileRelease | null>(null);
export const updateVisible = shallowRef(false);
export const updateProgress = shallowRef(0);
export const updateMessage = shallowRef('');
let checking: Promise<void> | undefined;
let downloadTask: PlusDownloaderDownload | undefined;
let downloadGeneration = 0;
let waitingForPermission = false;
let scheduled: ReturnType<typeof setTimeout> | undefined;
let promptedVersion = '';
let localPath = '';
let appVisible = true;
let installOnReturn = false;

export function supportsAppUpdate() {
  // #ifdef APP-PLUS
  return plus.os.name === 'Android';
  // #endif
  // #ifndef APP-PLUS
  return false;
  // #endif
}

const busy = () => ['downloading', 'verifying'].includes(updateStatus.value);

export function checkForAppUpdate(manual = false): Promise<void> {
  if (!supportsAppUpdate()) return Promise.resolve();
  if (manual) updateVisible.value = true;
  if (checking) return checking;
  if (busy() || updateStatus.value === 'ready') return Promise.resolve();
  if (!manual && Date.now() - readStorage('updateCheckedAt', 0) < 6 * 60 * 60 * 1000)
    return Promise.resolve();
  updateStatus.value = 'checking';
  updateMessage.value = '';
  checking = new Promise<void>((resolve) => {
    uni.request({
      url: MOBILE_RELEASE_API,
      header: { Accept: 'application/vnd.github+json' },
      timeout: 15000,
      success(response) {
        try {
          if (response.statusCode !== 200)
            throw new Error('暂时无法连接更新服务，请稍后重试或打开发行页面。');
          const payload =
            typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          const release = findMobileUpdate(payload, version);
          updateInfo.value = release;
          updateStatus.value = release ? 'available' : 'latest';
          writeStorage('updateCheckedAt', Date.now());
          if (release && promptedVersion !== release.version) {
            promptedVersion = release.version;
            updateVisible.value = true;
          }
        } catch (error) {
          fail(error);
        }
      },
      fail() {
        fail(new Error('暂时连不上 GitHub，请检查网络后重试，也可打开发行页面下载。'));
      },
      complete() {
        resolve();
      }
    });
  }).finally(() => {
    checking = undefined;
  });
  return checking;
}

function fail(error: unknown) {
  updateStatus.value = 'error';
  updateMessage.value = error instanceof Error ? error.message : '更新暂时未完成，请稍后重试。';
}

export function scheduleAppUpdateCheck() {
  if (!supportsAppUpdate()) return;
  appVisible = true;
  if (waitingForPermission) {
    waitingForPermission = false;
    try {
      if (canInstallPackages()) void installDownloadedUpdate();
    } catch (error) {
      fail(error);
    }
  } else if (installOnReturn) {
    installOnReturn = false;
    void installDownloadedUpdate();
  }
  clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    void checkForAppUpdate();
  }, 3500);
}

export function pauseAppUpdateCheck() {
  appVisible = false;
  clearTimeout(scheduled);
}

function canInstallPackages() {
  const activity = plus.android.runtimeMainActivity();
  const manager = plus.android.invoke(activity, 'getPackageManager');
  return Boolean(plus.android.invoke(manager, 'canRequestPackageInstalls'));
}

async function verifyDownloadedUpdate(info: MobileRelease, path: string) {
  if (!nativeDevice()) throw new Error('当前安装包缺少更新校验组件，请从发行页面下载新版。');
  const registration = uni.requireNativePlugin('Ikun-DeviceKit');
  if (!registration?.verifyUpdate) throw new Error('请从发行页面安装支持应用内更新的新版。');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('安装包校验超时，请重新尝试安装。')), 30000);
    registration.verifyUpdate(
      JSON.stringify({
        path: plus.io.convertLocalFileSystemURL(path),
        size: info.size,
        sha256: info.sha256,
        version: info.version
      }),
      (payload: string) => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(payload);
          if (!result.ok) throw new Error(result.message || '安装包校验未通过，请重新下载。');
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

function removeUpdateFile(path: string) {
  if (!/^_doc\/updates\/ikun-music-\d+\.\d+\.\d+\.apk$/.test(path)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    plus.io.resolveLocalFileSystemURL(
      path,
      (entry) =>
        entry.remove(
          () => resolve(),
          () => resolve()
        ),
      () => resolve()
    );
  });
}

function hasCompleteUpdate(path: string, size: number) {
  return new Promise<boolean>((resolve) => {
    plus.io.resolveLocalFileSystemURL(
      path,
      (entry) => {
        entry.getMetadata(
          (metadata) => resolve(metadata.size === size),
          () => resolve(false),
          false
        );
      },
      () => resolve(false)
    );
  });
}

export async function downloadAppUpdate() {
  const info = updateInfo.value;
  if (!info || busy() || !supportsAppUpdate()) return;
  if (updateStatus.value === 'ready' && localPath) {
    await installDownloadedUpdate();
    return;
  }
  const generation = ++downloadGeneration;
  updateVisible.value = true;
  updateStatus.value = 'downloading';
  updateProgress.value = 0;
  updateMessage.value = '';
  try {
    const cached = readStorage<{ version: string; path: string } | null>('updateDownload', null);
    if (cached && cached.version !== info.version) await removeUpdateFile(cached.path);
    const destination = `_doc/updates/ikun-music-${info.version}.apk`;
    if (await hasCompleteUpdate(destination, info.size)) {
      updateStatus.value = 'verifying';
      try {
        await verifyDownloadedUpdate(info, destination);
        if (generation !== downloadGeneration) return;
        localPath = destination;
        writeStorage('updateDownload', { version: info.version, path: destination });
        updateProgress.value = 100;
        updateStatus.value = 'ready';
        if (appVisible) await installDownloadedUpdate(true);
        else installOnReturn = true;
        return;
      } catch {
        // 已下载文件仍须校验；损坏或不匹配时重新下载，不能直接交给系统安装。
        updateStatus.value = 'downloading';
      }
    }
    await removeUpdateFile(destination);
    if (generation !== downloadGeneration) return;
    localPath = '';
    const task = plus.downloader.createDownload(
      info.url,
      { filename: destination, timeout: 30, retry: 1 },
      async (completed, status) => {
        if (generation !== downloadGeneration) return;
        downloadTask = undefined;
        if (status !== 200 || completed.downloadedSize !== info.size || !completed.filename) {
          fail(new Error('更新包没有下载完整，请检查网络后重新下载。'));
          return;
        }
        localPath = completed.filename;
        updateStatus.value = 'verifying';
        try {
          await verifyDownloadedUpdate(info, localPath);
          if (generation !== downloadGeneration) return;
          writeStorage('updateDownload', { version: info.version, path: localPath });
          updateProgress.value = 100;
          updateStatus.value = 'ready';
          if (appVisible) await installDownloadedUpdate(true);
          else installOnReturn = true;
        } catch (error) {
          fail(error);
        }
      }
    );
    downloadTask = task;
    task.addEventListener('statechanged', (progress) => {
      if (generation === downloadGeneration)
        updateProgress.value = Math.min(
          99,
          Math.floor(((progress.downloadedSize || 0) / info.size) * 100)
        );
    });
    task.start();
  } catch (error) {
    if (generation === downloadGeneration) fail(error);
  }
}

export function cancelAppUpdateDownload() {
  downloadGeneration++;
  installOnReturn = false;
  downloadTask?.abort();
  downloadTask = undefined;
  updateStatus.value = updateInfo.value ? 'available' : 'idle';
  updateProgress.value = 0;
  updateMessage.value = '';
}

export async function installDownloadedUpdate(verified = false) {
  if (!updateInfo.value || !localPath) return;
  try {
    if (!verified) {
      updateStatus.value = 'verifying';
      await verifyDownloadedUpdate(updateInfo.value, localPath);
    }
    updateStatus.value = 'ready';
    if (!canInstallPackages()) {
      updateMessage.value = '请允许安装来自 ikun音乐的应用，返回后继续安装。';
      waitingForPermission = true;
      const activity = plus.android.runtimeMainActivity();
      const uri = plus.android.invoke(
        'android.net.Uri',
        'parse',
        `package:${plus.android.invoke(activity, 'getPackageName')}`
      );
      const intent = plus.android.newObject(
        'android.content.Intent',
        'android.settings.MANAGE_UNKNOWN_APP_SOURCES'
      );
      plus.android.invoke(intent, 'setData', uri);
      plus.android.invoke(activity, 'startActivity', intent);
      return;
    }
    // APK 安装不会触发成功回调，交给系统确认；用户取消后仍可点“继续安装”。
    updateMessage.value = '安装包已就绪，请在系统安装页面确认更新。';
    plus.runtime.install(localPath, {}, undefined, (error) => {
      updateStatus.value = 'ready';
      updateMessage.value = error.message || '安装包已就绪。如未出现系统确认页面，请点击继续安装。';
    });
  } catch (error) {
    waitingForPermission = false;
    fail(error);
  }
}

export function dismissAppUpdate() {
  updateVisible.value = false;
}

export function openAppUpdateRelease() {
  const url = updateInfo.value?.pageUrl || 'https://github.com/1812095643/ikun-music/releases';
  // #ifdef APP-PLUS
  plus.runtime.openURL(url);
  // #endif
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer');
  // #endif
}
