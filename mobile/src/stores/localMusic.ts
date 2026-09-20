import { shallowRef } from 'vue';

import type { Track } from '@/services/musicApi';
import { nativeDevice, nativeProblem, runNativeOperation } from '@/services/nativeDevice';

import { readStorage, toast,writeStorage } from './library';

export const localTracks = shallowRef<Track[]>(readStorage('localTracks', []));
export const localCandidates = shallowRef<Track[]>([]);
export const localBusy = shallowRef(false);
export const localError = shallowRef('');
export const localSelectionOpen = shallowRef(false);
export async function scanLocalMusic() {
  if (localBusy.value) return;
  localBusy.value = true;
  localError.value = '';
  localCandidates.value = [];
  localSelectionOpen.value = true;
  try {
    const kit = nativeDevice();
    if (!kit) throw nativeProblem();
    // #ifdef APP-PLUS
    const build: any = plus.android.importClass('android.os.Build$VERSION');
    const permission =
      Number(build.SDK_INT) >= 33
        ? 'android.permission.READ_MEDIA_AUDIO'
        : 'android.permission.READ_EXTERNAL_STORAGE';
    await new Promise<void>((resolve, reject) =>
      plus.android.requestPermissions(
        [permission],
        (result: any) => {
          if (result.granted.includes(permission)) resolve();
          else {
            toast('未授权系统音乐库，先显示互传收到的音乐，也可手动选择文件。');
            resolve();
          }
        },
        () => reject(new Error('未能取得音乐访问权限，请使用“选择文件”。'))
      )
    );
    // #endif
    const result = await runNativeOperation<{ tracks?: Track[] }>((value) => value.scanMusic());
    localCandidates.value = result.tracks || [];
  } catch (error) {
    localError.value = (error as Error).message;
  } finally {
    localBusy.value = false;
  }
}
export async function chooseLocalMusic() {
  localError.value = '';
  localSelectionOpen.value = true;
  // #ifdef APP-PLUS
  localBusy.value = true;
  try {
    const kit = nativeDevice();
    if (!kit) throw nativeProblem();
    const result = await runNativeOperation<{ tracks?: Track[] }>((value) =>
      value.chooseFiles('audio')
    );
    localCandidates.value = result.tracks || [];
  } catch (error) {
    localError.value = (error as Error).message;
  } finally {
    localBusy.value = false;
  }
  // #endif
  // #ifdef H5
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.multiple = true;
  input.onchange = async () => {
    localBusy.value = true;
    const values: Track[] = [];
    for (const file of Array.from(input.files || [])) {
      const url = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve) => {
        const media = new Audio();
        media.preload = 'metadata';
        const finish = (value: number) => {
          clearTimeout(timer);
          media.removeAttribute('src');
          media.load();
          resolve(value);
        };
        const timer = setTimeout(() => finish(0), 5000);
        media.onloadedmetadata = () => finish(Number.isFinite(media.duration) ? media.duration : 0);
        media.onerror = () => finish(0);
        media.src = url;
      });
      values.push({
        id: `local:${file.name}:${file.size}:${file.lastModified}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: '本地音乐',
        album: '',
        cover: '',
        duration,
        localUri: url,
        fileSize: file.size
      });
    }
    localCandidates.value = values;
    localBusy.value = false;
  };
  input.click();
  // #endif
}
export function importLocalTracks(tracks: Track[]) {
  const existing = new Set(localTracks.value.map((track) => track.id));
  const added = tracks.filter((track) => !existing.has(track.id));
  localTracks.value = [...added, ...localTracks.value];
  // 浏览器选择的文件只在本次会话有效，不能把 blob 地址存成可离线恢复的文件。
  writeStorage(
    'localTracks',
    localTracks.value.filter((track) => !track.localUri?.startsWith('blob:'))
  );
  localSelectionOpen.value = false;
  toast(`已添加 ${added.length} 首本地音乐`);
}
