import { cloneDeep } from 'lodash';
import { useMessage } from 'naive-ui';
import { ref } from 'vue';

import { getKuwoMusicUrl } from '@/api/kuwo';
import { lyricToLrc, saveLocalSongLyric } from '@/services/localLyricService';
import { loadLyricCandidates } from '@/services/lyricCandidateService';
import { getSongUrl } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isDesktopRuntime } from '@/utils';
import { getDefaultDownloadQuality, getKuwoDownloadQuality } from '@/utils/downloadQuality';

type DownloadResult = { success: boolean; path?: string; error?: string; lyricWarning?: string };
const pendingDownloads = new Map<string, Promise<DownloadResult>>();
const downloadQueue: Array<() => void> = [];
let runningDownloads = 0;

// 解析地址、下载文件、保存歌词共用并发额度，批量操作不会一次发出整张歌单的请求。
const pumpDownloads = () => {
  while (runningDownloads < 3 && downloadQueue.length) downloadQueue.shift()!();
};

const queueDownload = (song: SongResult, quality?: string): Promise<DownloadResult> => {
  const selectedQuality =
    song.source === 'kuwo' ? getKuwoDownloadQuality(quality) : getDefaultDownloadQuality();
  const key = `${song.source || 'netease'}:${song.id}:${selectedQuality.key}`;
  const existing = pendingDownloads.get(key);
  if (existing) return existing;
  const artist = (song.ar || song.artists || song.song?.artists || [])
    .map((item: any) => item.name)
    .join(', ');
  const filename = `${song.name} - ${artist}`;
  const queued = window.desktop.invoke('queue-download-task', {
    downloadKey: key,
    filename,
    songInfo: { id: song.id, name: song.name, picUrl: song.picUrl, ar: song.ar }
  });
  const task = new Promise<DownloadResult>((resolve) => {
    downloadQueue.push(() => {
      runningDownloads++;
      void (async () => {
        try {
          await queued;
          const songInfo = cloneDeep(song);
          const result =
            song.source === 'kuwo'
              ? (await getKuwoMusicUrl(song.id, selectedQuality.key)).data.data
              : await getSongUrl(song.id, songInfo, true);
          const detail = typeof result === 'string' ? { url: result } : result;
          if (!detail?.url) throw new Error('暂时没有取得下载地址，请稍后重试');
          return (await window.desktop.invoke('download-music', {
            url: detail.url,
            filename,
            songInfo: {
              ...songInfo,
              downloadQuality: selectedQuality.key,
              downloadQualityLabel: selectedQuality.label
            },
            type: detail.type || selectedQuality.extension,
            quality: selectedQuality.key,
            downloadKey: key
          })) as DownloadResult;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await window.desktop.invoke('fail-download-task', {
            downloadKey: key,
            filename,
            error: reason
          });
          return { success: false, error: reason };
        }
      })()
        .then(resolve)
        .finally(() => {
          pendingDownloads.delete(key);
          runningDownloads--;
          pumpDownloads();
        });
    });
  });
  pendingDownloads.set(key, task);
  pumpDownloads();
  return task;
};

export const useDownload = () => {
  const message = useMessage();
  const isDownloading = ref(false);

  const batchDownloadMusic = async (songs: SongResult[], quality?: string) => {
    if (!isDesktopRuntime) {
      message.warning('请在桌面端下载音乐');
      return;
    }
    if (isDownloading.value || !songs.length) return;
    const onlineSongs = songs.filter(
      (song) => !song.localFilePath && !song.playMusicUrl?.startsWith('local://')
    );
    if (!onlineSongs.length) {
      message.info('这些歌曲已经在本地目录中');
      return;
    }
    isDownloading.value = true;
    message.info(`已加入下载队列，共 ${onlineSongs.length} 首`);
    try {
      const results = await Promise.all(onlineSongs.map((song) => queueDownload(song, quality)));
      const failed = results.filter((result) => !result.success);
      const missingLyrics = results.filter((result) => result.lyricWarning);
      if (failed.length)
        message.warning(
          `已保存 ${results.length - failed.length} 首，${failed.length} 首未完成：${failed[0].error}`
        );
      else if (missingLyrics.length)
        message.warning(`音乐已保存，${missingLyrics.length} 首暂未匹配到歌词，可在播放页重新搜索`);
      else message.success(`已下载 ${results.length} 首音乐`);
    } finally {
      isDownloading.value = false;
    }
  };

  const downloadMusic = (song: SongResult, quality?: string) => batchDownloadMusic([song], quality);

  const downloadLyric = async (song: SongResult) => {
    if (!isDesktopRuntime) return;
    try {
      const lyric = song.lyric?.lrcArray?.length
        ? song.lyric
        : (await loadLyricCandidates(song)).activeCandidate?.lyric;
      const lrcContent = lyricToLrc(lyric);
      if (!lyric || !lrcContent) {
        message.info('暂时没有匹配到歌词，可以在播放页重新搜索');
        return;
      }
      if (song.localFilePath || song.playMusicUrl?.startsWith('local://')) {
        await saveLocalSongLyric(song, lyric);
      } else {
        const artist = (song.ar || song.artists || []).map((item) => item.name).join(', ');
        const result = await window.desktop.invoke('save-lyric-file', {
          filename: `${song.name} - ${artist}`,
          lrcContent
        });
        if (!result?.success) throw new Error(result?.error || '请检查下载目录是否可以写入');
      }
      message.success('歌词已保存');
    } catch (error) {
      message.warning(`歌词暂未保存：${String(error)}`);
    }
  };

  return { isDownloading, downloadMusic, downloadLyric, batchDownloadMusic };
};
