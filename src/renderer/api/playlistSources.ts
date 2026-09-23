import { createPlaylistResolver } from '../../shared/playlistImport';
import { assertExternalOk, requestExternalMusic } from './externalMusicRequest';
import { getKuwoPlaylistDetail } from './kuwo';

export {
  type PlaylistLink as DetectedPlaylistLink,
  detectPlaylistLink,
  extractPlaylistUrls,
  mergePlaylistSongs,
  parsePlaylistText,
  type PlaylistImportSong,
  type PlaylistPreview as ResolvedPlaylistSource
} from '../../shared/playlistImport';

export const resolvePlaylistLink = createPlaylistResolver({
  request: async (url, options) =>
    assertExternalOk(
      await requestExternalMusic(url, {
        ...options,
        signal: options.signal as AbortSignal | undefined,
        timeout: 30000,
        requestPrefix: 'playlist-import'
      }),
      '歌单'
    ),
  kuwo: async (id, page, size, signal) => {
    const response = await getKuwoPlaylistDetail(id, page, size, signal as AbortSignal | undefined);
    if (response.data.code !== 200) throw new Error('酷我歌单暂未读取，请重试。');
    return response.data.playlist;
  }
});
