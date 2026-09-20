import { encryptQuery } from '@unblockneteasemusic/server/src/kwDES';

import { createKuwoPlaybackRequest } from '../../src-tauri/runtime/kuwo-playback.cjs';

export const requestMusicService = async (
  path: string,
  params: { id: string; quality: string }
) => {
  if (path !== '/desktop/kuwo-playback-request') throw new Error('Unsupported music operation');
  return { status: 200, body: createKuwoPlaybackRequest(params.id, params.quality, encryptQuery) };
};
