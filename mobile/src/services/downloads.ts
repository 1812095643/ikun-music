import {
  type DownloadRecord,
  downloadRecords,
  toast,
  updateDownload,
  writeStorage
} from '@/stores/library';

import { loadLyrics, previewMediaUrl, type Quality, resolveTrack, type Track } from './musicApi';

interface DownloadJob {
  task?: any;
  stopped: boolean;
  cancel?: () => void;
}
const activeTasks = new Map<string, DownloadJob>();
let pumping = false;
const normalizeFilename = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);

export function startDownload(track: Track, quality: Quality) {
  if (track.localUri) {
    toast('这首歌已经在本地音乐中');
    return;
  }
  const id = `${track.id}:${quality}`;
  const existing = downloadRecords.value.find((record) => record.id === id);
  if (existing && ['completed', 'queued', 'downloading'].includes(existing.state)) {
    toast(existing.state === 'completed' ? '这首歌已经下载好了' : '这首歌已在下载队列中');
    return;
  }
  const record: DownloadRecord = { id, track, quality, path: '', progress: 0, state: 'queued' };
  downloadRecords.value = [record, ...downloadRecords.value.filter((record) => record.id !== id)];
  writeStorage('downloads', downloadRecords.value);
  toast('已加入下载队列');
  void pumpDownloads();
}
async function pumpDownloads() {
  if (pumping) return;
  pumping = true;
  try {
    while (activeTasks.size < 3) {
      const next = downloadRecords.value.find((record) => record.state === 'queued');
      if (!next) break;
      const job: DownloadJob = { stopped: false };
      activeTasks.set(next.id, job);
      updateDownload(next.id, { state: 'downloading' });
      void download(next, job);
    }
  } finally {
    pumping = false;
  }
}

async function download(record: DownloadRecord, job: DownloadJob) {
  try {
    const stream = await resolveTrack(record.track.id, record.quality);
    if (job.stopped || activeTasks.get(record.id) !== job) return;
    const extension = /^(mp3|flac|aac|m4a|ogg|wav)$/i.test(stream.type)
      ? stream.type.toLowerCase()
      : 'mp3';
    const fileName = `${normalizeFilename(`${record.track.artist} - ${record.track.title}`)}.${extension}`;
    updateDownload(record.id, { format: extension });
    // #ifdef APP-PLUS
    await new Promise<void>((resolve, reject) => {
      job.cancel = () => reject(new Error('下载已暂停'));
      const task = plus.downloader.createDownload(
        stream.url,
        {
          filename: `_doc/music/${record.track.id}-${record.quality}/${fileName}`,
          timeout: 25,
          retry: 1
        },
        (completed: any, status: number) => {
          if (job.stopped || activeTasks.get(record.id) !== job) {
            resolve();
            return;
          }
          if (status >= 200 && status < 300 && completed.downloadedSize > 0) {
            updateDownload(record.id, {
              state: 'completed',
              path: completed.filename,
              progress: 100
            });
            void saveSidecar(completed.filename, record.track);
            resolve();
          } else reject(new Error('下载暂时中断'));
        }
      );
      task.setRequestHeader('User-Agent', 'okhttp/3.10.0');
      task.addEventListener('statechanged', (value: any) => {
        if (!job.stopped && activeTasks.get(record.id) === job && value.totalSize > 0)
          updateDownload(record.id, {
            progress: Math.min(99, Math.round((value.downloadedSize / value.totalSize) * 100))
          });
      });
      job.task = task;
      updateDownload(record.id, { taskId: task.id });
      task.start();
    });
    // #endif
    // #ifdef H5
    const result = await new Promise<UniApp.DownloadSuccessData>((resolve, reject) => {
      job.cancel = () => reject(new Error('下载已暂停'));
      const task = uni.downloadFile({
        url: previewMediaUrl(stream.url),
        success: resolve,
        fail: reject
      });
      job.task = task;
      task.onProgressUpdate((value) => {
        if (!job.stopped && activeTasks.get(record.id) === job)
          updateDownload(record.id, { progress: value.progress });
      });
    });
    if (job.stopped || activeTasks.get(record.id) !== job) return;
    if (result.statusCode !== 200) throw new Error();
    const anchor = document.createElement('a');
    anchor.href = result.tempFilePath;
    anchor.download = fileName;
    anchor.click();
    updateDownload(record.id, { state: 'completed', progress: 100, path: result.tempFilePath });
    toast('已交给浏览器保存；浏览器缓存关闭后可能失效。');
    // #endif
  } catch {
    if (!job.stopped && activeTasks.get(record.id) === job) {
      updateDownload(record.id, { state: 'error' });
      toast('这首歌下载暂时中断，可以在「我的」里重试。');
    }
  } finally {
    if (activeTasks.get(record.id) === job) activeTasks.delete(record.id);
    void pumpDownloads();
  }
}

export function pauseDownload(id: string) {
  const job = activeTasks.get(id);
  if (job) {
    job.stopped = true;
    job.task?.abort?.();
    job.cancel?.();
  }
  activeTasks.delete(id);
  updateDownload(id, { state: 'paused' });
  void pumpDownloads();
}
export function retryDownload(record: DownloadRecord) {
  startDownload(record.track, record.quality);
}
export function restoreDownloads() {
  downloadRecords.value = downloadRecords.value.map((record) =>
    ['downloading', 'queued'].includes(record.state)
      ? { ...record, state: 'paused' as const }
      : record
  );
  // #ifdef H5
  downloadRecords.value = downloadRecords.value.map((record) =>
    record.path.startsWith('blob:') ? { ...record, path: '', state: 'error' as const } : record
  );
  // #endif
  writeStorage('downloads', downloadRecords.value);
}

async function saveSidecar(path: string, track: Track) {
  // #ifdef APP-PLUS
  try {
    const lyrics = await loadLyrics(track);
    if (!lyrics.length) return;
    const content = lyrics
      .map((line) => {
        const minutes = Math.floor(line.time / 60)
          .toString()
          .padStart(2, '0');
        const seconds = (line.time % 60).toFixed(3).padStart(6, '0');
        return `[${minutes}:${seconds}]${line.text}`;
      })
      .join('\n');
    const separator = path.lastIndexOf('/');
    if (separator < 0) throw new Error('无法定位音乐保存目录');
    // 直接解析下载路径的目录，避免部分 Android 基座的 getParent 返回上一级目录。
    const directory = path.slice(0, separator + 1);
    const filename = path.slice(separator + 1).replace(/\.[^.]+$/, '.lrc');
    await new Promise<void>((resolve, reject) =>
      plus.io.resolveLocalFileSystemURL(
        directory,
        (parent: any) =>
          parent.getFile(
            filename,
            { create: true },
            (lyric: any) =>
              lyric.createWriter((writer: any) => {
                writer.onwriteend = () => resolve();
                writer.onerror = reject;
                writer.write(content);
              }, reject),
            reject
          ),
        reject
      )
    );
  } catch {
    toast('歌曲已保存，歌词暂未下载完成。');
  }
  // #endif
}
