export type LyricWindowLifecyclePayload =
  | {
      closedAt?: number;
      readyAt?: number;
    }
  | null
  | undefined;

const normalizeLifecycleTimestamp = (value: unknown) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
};

export const getLyricWindowClosedAt = (payload: LyricWindowLifecyclePayload) => {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }

  return normalizeLifecycleTimestamp(payload.closedAt);
};

export const isStaleLyricWindowClosedEvent = (
  closedAt: number,
  lastOpenRequestedAt: number,
  isWindowMarkedOpen: boolean
) =>
  Boolean(
    isWindowMarkedOpen && closedAt > 0 && lastOpenRequestedAt > 0 && closedAt <= lastOpenRequestedAt
  );
