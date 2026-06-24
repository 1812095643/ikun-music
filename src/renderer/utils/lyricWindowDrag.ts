type ClosestCapableTarget = EventTarget & {
  closest?: (selector: string) => unknown;
  parentElement?: ClosestCapableTarget | null;
};

const LYRIC_WINDOW_DRAG_BLOCK_SELECTORS = [
  '.control-buttons',
  '.font-size-controls',
  '.play-controls',
  '.theme-color-panel'
];

const resolveClosestTarget = (target: EventTarget | null) => {
  const targetElement = target as ClosestCapableTarget | null;
  if (targetElement?.closest) {
    return targetElement;
  }
  if (targetElement?.parentElement?.closest) {
    return targetElement.parentElement;
  }
  return null;
};

// 桌面歌词允许从空白区域拖动窗口，但控制区和主题色面板内的点击应保留给交互本身。
export const shouldStartLyricWindowDrag = (target: EventTarget | null, isLocked: boolean) => {
  if (isLocked) return false;

  const targetElement = resolveClosestTarget(target);
  if (!targetElement) return true;

  return !LYRIC_WINDOW_DRAG_BLOCK_SELECTORS.some((selector) => targetElement.closest?.(selector));
};
