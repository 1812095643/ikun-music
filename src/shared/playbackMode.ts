export type PlaybackMode = 'single' | 'repeat' | 'sequence' | 'loop' | 'shuffle';
export type PlaybackTrigger = 'ended' | 'next' | 'previous';

// 保留桌面旧版 0/1/2 的含义，3 仍留给心动模式，避免升级后模式错位。
export const PLAYBACK_MODES = [
  { key: 'single', desktopValue: 4, label: '单曲播放', icon: 'ri-play-circle-line' },
  { key: 'repeat', desktopValue: 1, label: '单曲循环', icon: 'ri-repeat-one-line' },
  { key: 'sequence', desktopValue: 0, label: '列表播放', icon: 'ri-order-play-line' },
  { key: 'loop', desktopValue: 5, label: '列表循环', icon: 'ri-repeat-2-line' },
  { key: 'shuffle', desktopValue: 2, label: '随机播放', icon: 'ri-shuffle-line' }
] as const;

export function normalizePlaybackMode(value: unknown): PlaybackMode {
  return PLAYBACK_MODES.find((item) => item.key === value)?.key ?? 'sequence';
}

export function desktopPlaybackMode(value: number): PlaybackMode {
  return PLAYBACK_MODES.find((item) => item.desktopValue === value)?.key ?? 'sequence';
}

export function playbackModeInfo(mode: PlaybackMode) {
  return PLAYBACK_MODES.find((item) => item.key === mode) ?? PLAYBACK_MODES[2];
}

export function nextPlaybackMode(mode: PlaybackMode): PlaybackMode {
  const index = PLAYBACK_MODES.findIndex((item) => item.key === mode);
  return PLAYBACK_MODES[(index + 1) % PLAYBACK_MODES.length].key;
}

/** 仅决定队列目标；自然结束与手动切歌必须区分，null 表示停止或到达边界。 */
export function getQueueTarget(
  mode: PlaybackMode,
  index: number,
  length: number,
  trigger: PlaybackTrigger
): number | null {
  if (length <= 0) return null;
  const current = Math.max(0, Math.min(index, length - 1));
  if (trigger === 'ended') {
    if (mode === 'single') return null;
    if (mode === 'repeat') return current;
  }
  const target = current + (trigger === 'previous' ? -1 : 1);
  if (mode === 'sequence' && (target < 0 || target >= length)) return null;
  return (target + length) % length;
}

/** 复用原有洗牌方式，当前曲目留在首位，一轮内逐首播放且上一首可回退。 */
export function shuffleQueue<T>(list: T[], currentIndex = -1): T[] {
  const remaining = [...list];
  const result =
    currentIndex >= 0 && currentIndex < list.length ? remaining.splice(currentIndex, 1) : [];
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  return [...result, ...remaining];
}
