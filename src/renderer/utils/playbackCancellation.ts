export const abortPlaybackError = () => new DOMException('播放请求已取消', 'AbortError');

export const withPlaybackSignal = <T>(task: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return task;
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortPlaybackError());
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
};
