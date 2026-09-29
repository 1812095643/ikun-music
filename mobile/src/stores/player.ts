import { computed, shallowRef } from 'vue';

import { createMusicAudio, type MusicAudio } from '@/services/audioEngine';
import {
  createCancellation,
  isCanceled,
  loadLyrics,
  type LyricLine,
  previewMediaUrl,
  type Quality,
  resolveTrack,
  type Track
} from '@/services/musicApi';

import {
  getQueueTarget,
  nextPlaybackMode,
  normalizePlaybackMode,
  type PlaybackMode,
  playbackModeInfo,
  shuffleQueue
} from '../../../src/shared/playbackMode';
import { downloadRecords, readStorage, recordPlayed, toast, writeStorage } from './library';

export const queue = shallowRef<Track[]>(readStorage('queue', []));
export const queueIndex = shallowRef<number>(
  Math.min(readStorage('queueIndex', 0), Math.max(0, queue.value.length - 1))
);
export const current = shallowRef<Track | null>(queue.value[queueIndex.value] || null);
export const playing = shallowRef(false);
export const loading = shallowRef(false);
export const playerError = shallowRef('');
export const pendingTrack = shallowRef<Track | null>(null);
export const position = shallowRef(0);
export const duration = shallowRef(0);
export const lyrics = shallowRef<LyricLine[]>([]);
export const lyricsLoading = shallowRef(false);
export const playerOpen = shallowRef(false);
export const quality = shallowRef<Quality>(readStorage('quality', 'high'));
export const mode = shallowRef<PlaybackMode>(
  normalizePlaybackMode(readStorage('mode', 'sequence'))
);
export const modeInfo = computed(() => playbackModeInfo(mode.value));
let originalQueue = readStorage<Track[]>('originalQueue', []);
export const resolvedFormat = shallowRef('');
export const lyricIndex = computed(() => {
  let low = 0,
    high = lyrics.value.length - 1,
    result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lyrics.value[mid].time <= position.value) {
      result = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return result;
});
let audio: MusicAudio | undefined;
let navigationVersion = 0;
let pendingIndex: number | null = null;
let controller: ReturnType<typeof createCancellation> | undefined;
let debounce: ReturnType<typeof setTimeout>;
let expectedSrc = '';
let requestedPlay = false;
let trackEnded = false;
export const seekable = shallowRef(false);
const urlCache = new Map<string, { url: string; type: string; at: number }>();

export function initializeAudio() {
  if (audio) return true;
  try {
    audio = createMusicAudio();
  } catch (error) {
    playerError.value = (error as Error).message;
    loading.value = false;
    toast(playerError.value);
    return false;
  }
  audio.onPlay(() => {
    if (!expectedSrc || audio?.src !== expectedSrc || pendingTrack.value) return;
    playing.value = true;
    loading.value = false;
    playerError.value = '';
  });
  audio.onPause(() => {
    playing.value = false;
  });
  audio.onStop(() => {
    if (seekable.value) playing.value = false;
  });
  audio.onWaiting(() => {
    if (requestedPlay && !pendingTrack.value) loading.value = true;
  });
  audio.onCanplay(() => {
    if (!expectedSrc || audio?.src !== expectedSrc || pendingTrack.value || trackEnded) return;
    const actual = Number(audio.duration);
    const expected = current.value?.duration || 0;
    // 提示音与试听不能被标成完整歌曲；先核对时长，再接受播放器就绪事件。
    if (actual > 0 && expected > 45 && actual < expected * 0.65) {
      audio.pause();
      playing.value = false;
      loading.value = false;
      seekable.value = false;
      playerError.value = '音源返回的时长不完整，请重试或换一首。';
      toast(playerError.value);
      return;
    }
    seekable.value = true;
    loading.value = false;
    duration.value = actual > 0 ? actual : expected;
    if (requestedPlay) audio.play();
  });
  audio.onTimeUpdate(() => {
    if (seekable.value && audio?.src === expectedSrc) {
      position.value = audio.currentTime || 0;
      if (audio.duration > 0) duration.value = audio.duration;
      if (!audio.paused) {
        loading.value = false;
        playing.value = true;
      }
    }
  });
  audio.onEnded(() => {
    if (
      !seekable.value ||
      !requestedPlay ||
      pendingTrack.value ||
      trackEnded ||
      audio?.src !== expectedSrc
    )
      return;
    trackEnded = true;
    playing.value = false;
    position.value = duration.value;
    nextTrack(true);
  });
  audio.onError(() => {
    if (!expectedSrc || pendingTrack.value) return;
    loading.value = false;
    playing.value = false;
    seekable.value = false;
    playerError.value = current.value?.localUri
      ? '无法打开这首本地音乐，请检查文件是否移动，或重新选择文件。'
      : '这首歌暂时没有加载好，点播放重试或换一首。';
    toast(playerError.value);
  });
  audio.onNext?.(() => nextTrack());
  audio.onPrev?.(() => previousTrack());
  audio.onPlaybackIntent?.((value) => {
    if (pendingTrack.value) return;
    requestedPlay = value;
    if (!value) loading.value = false;
  });
  return true;
}

export function synchronizeAudio() {
  audio?.synchronize?.();
}
function updateNavigation() {
  const index = pendingIndex ?? queueIndex.value;
  audio?.setNavigation?.(
    Boolean(current.value),
    getQueueTarget(mode.value, index, queue.value.length, 'next') !== null
  );
}
export function playTracks(tracks: Track[], index = 0) {
  if (!tracks.length) return;
  const startIndex = Math.max(0, Math.min(index, tracks.length - 1));
  originalQueue = mode.value === 'shuffle' ? [...tracks] : [];
  queue.value = mode.value === 'shuffle' ? shuffleQueue(tracks, startIndex) : [...tracks];
  writeStorage('originalQueue', originalQueue);
  writeStorage('queue', queue.value);
  requestTrack(mode.value === 'shuffle' ? 0 : startIndex);
  playerOpen.value = true;
}
export function requestTrack(index: number, resumeAt = 0) {
  if (!queue.value.length) return;
  if (!initializeAudio()) return;
  clearTimeout(debounce);
  controller?.abort();
  // 连点以最新目标索引累计，不能从仍在播放的旧索引反复起算；旧请求必须取消并校验版本。
  pendingIndex = Math.max(0, Math.min(index, queue.value.length - 1));
  pendingTrack.value = queue.value[pendingIndex];
  loading.value = true;
  playerError.value = '';
  requestedPlay = true;
  const version = ++navigationVersion;
  updateNavigation();
  debounce = setTimeout(() => {
    void commitTrack(pendingIndex!, version, resumeAt);
  }, 90);
}
async function commitTrack(index: number, version: number, resumeAt: number) {
  const song = queue.value[index];
  const cancellation = createCancellation();
  controller = cancellation;
  const requestedQuality = quality.value;
  try {
    const key = `${song.id}:${requestedQuality}`;
    const offline = downloadRecords.value.find(
      (record) =>
        record.track.id === song.id &&
        record.quality === requestedQuality &&
        record.state === 'completed'
    );
    const cached = urlCache.get(key);
    const stream = song.localUri
      ? { url: song.localUri, type: '本地' }
      : offline
        ? { url: offline.path, type: offline.format || '' }
        : cached && Date.now() - cached.at < 60000
          ? cached
          : await resolveTrack(song.id, requestedQuality, cancellation.signal);
    if (version !== navigationVersion || cancellation.signal.aborted) return;
    if (!offline && !song.localUri) {
      if (urlCache.size > 24) urlCache.clear();
      urlCache.set(key, { ...stream, at: Date.now() });
    }
    seekable.value = false;
    trackEnded = false;
    expectedSrc = '';
    // 换歌保留原生媒体项和前台通知，清空队列会让后台的新音源失去启动播放服务的资格。
    audio!.pause();
    current.value = song;
    queueIndex.value = index;
    position.value = Math.max(0, resumeAt);
    duration.value = song.duration;
    pendingIndex = null;
    pendingTrack.value = null;
    lyrics.value = [];
    lyricsLoading.value = !song.localUri;
    resolvedFormat.value = stream.type.toUpperCase();
    audio!.title = song.title;
    audio!.trackId = song.id;
    audio!.singer = song.artist;
    audio!.epname = song.album;
    audio!.coverImgUrl = song.cover;
    audio!.startTime = position.value;
    expectedSrc = previewMediaUrl(stream.url);
    audio!.src = expectedSrc;
    updateNavigation();
    audio!.play();
    writeStorage('queueIndex', index);
    recordPlayed(song);
    if (song.localUri) return;
    void loadLyrics(song)
      .then((value) => {
        if (version === navigationVersion) lyrics.value = value;
      })
      .catch(() => {})
      .finally(() => {
        if (version === navigationVersion) lyricsLoading.value = false;
      });
  } catch (error) {
    if (isCanceled(error) || version !== navigationVersion) return;
    seekable.value = false;
    expectedSrc = '';
    audio?.stop();
    playing.value = false;
    current.value = song;
    queueIndex.value = index;
    position.value = Math.max(0, resumeAt);
    duration.value = song.duration;
    lyrics.value = [];
    lyricsLoading.value = false;
    pendingIndex = null;
    pendingTrack.value = null;
    loading.value = false;
    playerError.value = '暂时没能取得这首歌，请点播放重试。';
    toast(playerError.value);
  }
}
export function togglePlay() {
  if (!initializeAudio()) return;
  synchronizeAudio();
  if (!current.value) {
    toast('先选一首喜欢的歌吧');
    return;
  }
  if (pendingTrack.value) {
    clearTimeout(debounce);
    controller?.abort();
    navigationVersion++;
    pendingIndex = null;
    pendingTrack.value = null;
    loading.value = false;
    requestedPlay = false;
    audio?.pause();
    return;
  }
  if (playing.value) {
    requestedPlay = false;
    audio?.pause();
    playing.value = false;
  } else if (!expectedSrc || playerError.value) {
    urlCache.delete(`${current.value.id}:${quality.value}`);
    requestTrack(queueIndex.value, position.value);
  } else {
    requestedPlay = true;
    if (trackEnded) {
      trackEnded = false;
      position.value = 0;
      audio?.seek(0);
    }
    audio?.play();
  }
}
export function nextTrack(automatic = false) {
  if (!queue.value.length) return;
  const base = pendingIndex ?? queueIndex.value;
  const target = getQueueTarget(mode.value, base, queue.value.length, automatic ? 'ended' : 'next');
  if (target === null) {
    if (automatic) {
      playing.value = false;
      requestedPlay = false;
      loading.value = false;
      audio?.pause();
    } else toast('已经是最后一首了');
    return;
  }
  requestTrack(target);
}
export function previousTrack() {
  const base = pendingIndex ?? queueIndex.value;
  const target = getQueueTarget(mode.value, base, queue.value.length, 'previous');
  if (target !== null) requestTrack(target);
  else seek(0);
}
export function playNext(song: Track) {
  const anchorId = pendingTrack.value?.id || current.value?.id;
  if (song.id === anchorId) {
    toast('这首歌已经在播放了');
    return;
  }
  if (!queue.value.length) {
    playTracks([song]);
    return;
  }
  const targetId = pendingTrack.value?.id;
  const list = queue.value.filter((item) => item.id !== song.id);
  const anchor = list.findIndex((item) => item.id === anchorId);
  list.splice(Math.max(0, anchor + 1), 0, song);
  if (mode.value === 'shuffle') {
    originalQueue = originalQueue.filter((item) => item.id !== song.id);
    const originalAnchor = originalQueue.findIndex((item) => item.id === anchorId);
    originalQueue.splice(Math.max(0, originalAnchor + 1), 0, song);
    writeStorage('originalQueue', originalQueue);
  }
  queue.value = list;
  writeStorage('queue', list);
  // 调整队列时重新定位歌曲身份，不能让正在解析的旧索引指向另一首歌。
  queueIndex.value = Math.max(
    0,
    list.findIndex((item) => item.id === current.value?.id)
  );
  if (targetId) requestTrack(list.findIndex((item) => item.id === targetId));
  writeStorage('queueIndex', queueIndex.value);
  updateNavigation();
  toast('已添加到下一首播放');
}
export function seek(seconds: number) {
  if (!seekable.value) return;
  trackEnded = false;
  audio?.seek(seconds);
  position.value = seconds;
}
export function changeQuality(value: Quality) {
  quality.value = value;
  writeStorage('quality', value);
}
export function setMode(value: typeof mode.value) {
  const nextMode = normalizePlaybackMode(value);
  const targetId = pendingTrack.value?.id;
  const anchorId = targetId || current.value?.id;
  if (nextMode === 'shuffle' && mode.value !== 'shuffle') {
    originalQueue = [...queue.value];
    queue.value = shuffleQueue(
      queue.value,
      queue.value.findIndex((item) => item.id === anchorId)
    );
  } else if (nextMode !== 'shuffle' && mode.value === 'shuffle' && originalQueue.length) {
    queue.value = [...originalQueue];
    originalQueue = [];
  }
  mode.value = nextMode;
  queueIndex.value = Math.max(
    0,
    queue.value.findIndex((item) => item.id === current.value?.id)
  );
  // 队列换序后，重新定位正在解析的目标，避免旧索引把另一首歌写成当前歌曲。
  if (targetId) requestTrack(queue.value.findIndex((item) => item.id === targetId));
  writeStorage('mode', nextMode);
  writeStorage('queue', queue.value);
  writeStorage('queueIndex', queueIndex.value);
  writeStorage('originalQueue', originalQueue);
  updateNavigation();
}
export function cycleMode() {
  setMode(nextPlaybackMode(mode.value));
  toast(modeInfo.value.label);
}

// 旧版随机模式未保存洗牌队列，首次升级补齐顺序且不主动开始播放。
if (mode.value === 'shuffle' && !originalQueue.length && queue.value.length) {
  mode.value = 'sequence';
  setMode('shuffle');
}
export function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    navigationVersion++;
    clearTimeout(debounce);
    controller?.abort();
    audio?.stop();
    audio?.destroy?.();
  });
}
