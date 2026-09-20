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
  type Track} from '@/services/musicApi';

import { downloadRecords, readStorage, recordPlayed, toast,writeStorage } from './library';

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
export const mode = shallowRef<'sequence' | 'repeat' | 'shuffle'>(readStorage('mode', 'sequence'));
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
export const seekable = shallowRef(false);
const urlCache = new Map<string, { url: string; type: string; at: number }>();

export function initializeAudio() {
  if (audio) return;
  audio = createMusicAudio();
  audio.onPlay(() => {
    if (!expectedSrc || audio?.src !== expectedSrc) return;
    playing.value = true;
    loading.value = false;
    playerError.value = '';
  });
  audio.onPause(() => {
    if (seekable.value) playing.value = false;
  });
  audio.onStop(() => {
    if (seekable.value) playing.value = false;
  });
  audio.onWaiting(() => {
    if (requestedPlay && !pendingTrack.value) loading.value = true;
  });
  audio.onCanplay(() => {
    if (!expectedSrc || audio?.src !== expectedSrc) return;
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
    if (!seekable.value || !requestedPlay || pendingTrack.value) return;
    if (mode.value === 'repeat') {
      audio?.seek(0);
      audio?.play();
    } else nextTrack(true);
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
}

export function playTracks(tracks: Track[], index = 0) {
  if (!tracks.length) return;
  queue.value = tracks;
  writeStorage('queue', tracks);
  requestTrack(index);
  playerOpen.value = true;
}
export function requestTrack(index: number) {
  if (!queue.value.length) return;
  initializeAudio();
  clearTimeout(debounce);
  controller?.abort();
  // 连点以最新目标索引累计，不能从仍在播放的旧索引反复起算；旧请求必须取消并校验版本。
  pendingIndex = Math.max(0, Math.min(index, queue.value.length - 1));
  pendingTrack.value = queue.value[pendingIndex];
  loading.value = true;
  playerError.value = '';
  requestedPlay = true;
  const version = ++navigationVersion;
  debounce = setTimeout(() => {
    void commitTrack(pendingIndex!, version);
  }, 90);
}
async function commitTrack(index: number, version: number) {
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
    expectedSrc = '';
    audio!.stop();
    current.value = song;
    queueIndex.value = index;
    position.value = 0;
    duration.value = song.duration;
    pendingIndex = null;
    pendingTrack.value = null;
    lyrics.value = [];
    lyricsLoading.value = !song.localUri;
    resolvedFormat.value = stream.type.toUpperCase();
    audio!.title = song.title;
    audio!.singer = song.artist;
    audio!.epname = song.album;
    audio!.coverImgUrl = song.cover;
    audio!.startTime = 0;
    expectedSrc = previewMediaUrl(stream.url);
    audio!.src = expectedSrc;
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
    position.value = 0;
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
  initializeAudio();
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
    requestTrack(queueIndex.value);
  } else {
    requestedPlay = true;
    audio?.play();
  }
}
export function nextTrack(automatic = false) {
  const base = pendingIndex ?? queueIndex.value;
  if (mode.value === 'shuffle' && queue.value.length > 1) {
    const offset = 1 + Math.floor(Math.random() * (queue.value.length - 1));
    requestTrack((base + offset) % queue.value.length);
    return;
  }
  if (base >= queue.value.length - 1) {
    if (automatic) {
      playing.value = false;
      requestedPlay = false;
    } else toast('已经是最后一首了');
    return;
  }
  requestTrack(base + 1);
}
export function previousTrack() {
  const base = pendingIndex ?? queueIndex.value;
  if (base > 0) requestTrack(base - 1);
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
  queue.value = list;
  writeStorage('queue', list);
  // 调整队列时重新定位歌曲身份，不能让正在解析的旧索引指向另一首歌。
  queueIndex.value = Math.max(
    0,
    list.findIndex((item) => item.id === current.value?.id)
  );
  if (targetId) requestTrack(list.findIndex((item) => item.id === targetId));
  writeStorage('queueIndex', queueIndex.value);
  toast('已添加到下一首播放');
}
export function seek(seconds: number) {
  if (!seekable.value) return;
  audio?.seek(seconds);
  position.value = seconds;
}
export function changeQuality(value: Quality) {
  quality.value = value;
  writeStorage('quality', value);
}
export function setMode(value: typeof mode.value) {
  mode.value = value;
  writeStorage('mode', value);
}
export function cycleMode() {
  mode.value =
    mode.value === 'sequence' ? 'shuffle' : mode.value === 'shuffle' ? 'repeat' : 'sequence';
  writeStorage('mode', mode.value);
  toast({ sequence: '顺序播放', shuffle: '随机播放', repeat: '单曲循环' }[mode.value]);
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
