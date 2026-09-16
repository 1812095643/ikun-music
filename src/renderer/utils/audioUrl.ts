import { convertFileSrc } from '@tauri-apps/api/core';

export const getLocalAudioPath = (url?: string): string => {
  if (!url?.startsWith('local:///')) return '';
  let path = decodeURIComponent(url.slice('local:///'.length));
  if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1);
  return path;
};

export const createLocalAudioUrl = (path: string) => `local:///${encodeURIComponent(path)}`;

export const resolveAudioUrl = (url: string): string => {
  const path = getLocalAudioPath(url);
  return path ? convertFileSrc(path) : url;
};
