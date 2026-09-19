import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { resolveAudioUrl } from '@/utils/audioUrl';

/** 原生媒体通道提供 CORS 和 Range，音效处理在线音乐时不会被 WebAudio 静音。 */
export const prepareAudioTransport = async (url: string, direct = false) => {
  if (direct || !(window as any).__TAURI_INTERNALS__ || !/^https?:\/\//i.test(url)) {
    return { url: resolveAudioUrl(url), release: () => {} };
  }
  const id = await invoke<string>('register_audio_stream', { url });
  let released = false;
  return {
    url: convertFileSrc(id, 'musicstream'),
    release: () => {
      if (released) return;
      released = true;
      void invoke('release_audio_stream', { id }).catch(() => {});
    }
  };
};
