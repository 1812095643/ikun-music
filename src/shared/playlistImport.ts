export type PlaylistPlatform = 'qq' | 'netease' | 'kuwo';

export interface PlaylistLink {
  platform: PlaylistPlatform;
  id: string;
  url: string;
  label: string;
}
export interface PlaylistImportSong {
  name: string;
  artist: string;
  album: string;
  duration: number;
  externalId: string;
  platform?: PlaylistPlatform;
}
export interface PlaylistPreview {
  platform: PlaylistPlatform;
  id: string;
  title: string;
  coverUrl?: string;
  songs: PlaylistImportSong[];
  total: number;
  filteredCount: number;
}

export function mergePlaylistSongs(playlists: PlaylistPreview[]) {
  if (playlists.length === 1) return [...playlists[0].songs];
  const seen = new Set<string>();
  return playlists
    .flatMap((playlist) => playlist.songs)
    .filter((song) => {
      const key = `${song.name.toLocaleLowerCase()}\u0000${song.artist.toLocaleLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export interface ImportSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}
export interface PlaylistRequestOptions {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  signal?: ImportSignal;
}
export type PlaylistRequest = (url: string, options: PlaylistRequestOptions) => Promise<any>;
export const PLAYLIST_LIMIT = 10000;

export function checkImportCanceled(signal?: ImportSignal) {
  if (!signal?.aborted) return;
  const error = new Error('已停止读取');
  error.name = 'AbortError';
  throw error;
}

export function extractPlaylistUrls(value: string) {
  return [
    ...new Set(
      (value.match(/https?:\/\/[^\s<>"“”]+/gi) || []).map((url) =>
        url
          .replace(/\\&/g, '&')
          .replace(/&amp;/g, '&')
          .replace(/[，。；;）)】\]]+$/g, '')
      )
    )
  ];
}

export function detectPlaylistLink(value: string): PlaylistLink | null {
  const url = extractPlaylistUrls(value)[0];
  if (!url) return null;
  // 原生 uni-app 服务环境不依赖浏览器 URL 对象；仅接受已支持平台的歌单路径。
  const parts = /^https?:\/\/([a-z0-9.-]+)([/?#][\s\S]*)?$/i.exec(url);
  if (!parts) return null;
  const host = parts[1].toLowerCase();
  const path = parts[2] || '/';
  const queryId = (key: string) => new RegExp(`[?&#]${key}=(\\d+)(?:[&#]|$)`, 'i').exec(path)?.[1];
  let id: string | undefined;
  let platform: PlaylistPlatform;
  let label: string;
  if (['y.qq.com', 'i.y.qq.com', 'c.y.qq.com'].includes(host)) {
    id = /\/playlist\/(\d+)(?:\.html)?(?:[/?#]|$)/i.exec(path)?.[1];
    if (!id && /\/(?:taoge|playlist)(?:\.html|[/?#])/i.test(path))
      id = queryId('id') || queryId('disstid');
    platform = 'qq';
    label = 'QQ音乐';
  } else if (['music.163.com', 'y.music.163.com', '163cn.tv'].includes(host)) {
    if (!/\/playlist(?:[/?#]|$)/i.test(path)) return null;
    id = /\/playlist\/(\d+)(?:[/?#]|$)/i.exec(path)?.[1] || queryId('id');
    platform = 'netease';
    label = '网易云音乐';
  } else if (['kuwo.cn', 'www.kuwo.cn', 'm.kuwo.cn'].includes(host)) {
    id = /\/playlist(?:_detail)?\/(\d+)(?:[/?#]|$)/i.exec(path)?.[1];
    if (!id && /\/(?:playlist|play_detail)(?:[/?#]|$)/i.test(path))
      id = queryId('pid') || queryId('id');
    platform = 'kuwo';
    label = '酷我音乐';
  } else return null;
  return id && Number.isSafeInteger(Number(id)) && Number(id) > 0
    ? { platform, label, id, url }
    : null;
}

export function parsePlaylistText(text: string): PlaylistImportSong[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.、)）]\s*/, '').trim())
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split(/\s+[-—–|]\s+|\t+/);
      return {
        name: fields[0].trim(),
        artist: fields[1]?.trim() || '',
        album: fields[2]?.trim() || '',
        duration: 0,
        externalId: `text-${index}`
      };
    });
}

function importSong(item: any, platform: PlaylistPlatform): PlaylistImportSong | null {
  const name = String(item?.name || item?.title || '').trim();
  if (!name) return null;
  const artists = item.singer || item.ar || item.artists || [];
  return {
    name,
    artist: Array.isArray(artists)
      ? artists
          .map((artist: any) => artist.name || '')
          .filter(Boolean)
          .join(' / ')
      : String(artists),
    album: String(item.al?.name || item.album?.name || item.album?.title || ''),
    duration:
      platform === 'qq' ? Number(item.interval || 0) * 1000 : Number(item.dt || item.duration || 0),
    externalId: String(item.mid || item.id),
    platform
  };
}

export function createPlaylistResolver(dependencies: {
  request: PlaylistRequest;
  kuwo: (id: string, page: number, size: number, signal?: ImportSignal) => Promise<any>;
}) {
  const requestJson = async (url: string, options: PlaylistRequestOptions) => {
    checkImportCanceled(options.signal);
    const result = await dependencies.request(url, options);
    checkImportCanceled(options.signal);
    return typeof result === 'string' ? JSON.parse(result) : result;
  };
  return async (
    link: PlaylistLink,
    signal?: ImportSignal,
    progress?: (loaded: number, total: number) => void
  ): Promise<PlaylistPreview> => {
    const songs: PlaylistImportSong[] = [];
    let title = `${link.label}歌单`;
    let coverUrl = '';
    let total = 0;
    let filteredCount = 0;
    if (link.platform === 'qq') {
      const filteredIds = new Set<string>();
      const pageKeys = new Set<string>();
      for (let begin = 0; begin < PLAYLIST_LIMIT; begin += 100) {
        const payload = await requestJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com/' },
          body: JSON.stringify({
            comm: {
              ct: 24,
              cv: 4747474,
              g_tk: 5381,
              uin: 0,
              format: 'json',
              inCharset: 'utf-8',
              outCharset: 'utf-8',
              notice: 0,
              platform: 'yqq.json',
              needNewCode: 1
            },
            playlist: {
              module: 'music.srfDissInfo.aiDissInfo',
              method: 'uniform_get_Dissinfo',
              param: {
                disstid: Number(link.id),
                userinfo: 1,
                tag: 1,
                orderlist: 1,
                song_begin: begin,
                song_num: 100,
                onlysonglist: 0,
                enc_host_uin: ''
              }
            }
          })
        });
        const data = payload?.playlist?.data;
        if (
          payload?.code !== 0 ||
          payload.playlist?.code !== 0 ||
          data?.code !== 0 ||
          !Array.isArray(data.songlist)
        )
          throw new Error('QQ歌单暂未读取，请确认歌单公开后重试。');
        title = data.dirinfo?.title || title;
        coverUrl = data.dirinfo?.picurl || coverUrl;
        total = Math.max(total, Number(data.dirinfo?.songnum || data.total_song_num || 0));
        if (total > PLAYLIST_LIMIT) throw new Error('歌单超过一万首，请分成较小的歌单后导入。');
        for (const item of [...(data.filtered_song || []), ...(data.invalid_song || [])])
          filteredIds.add(String(item.songid || item.id));
        const pageKey = data.songlist.map((item: any) => item.id).join(',');
        if (pageKey && pageKeys.has(pageKey))
          throw new Error('QQ返回了重复分页，请稍后重新读取完整歌单。');
        pageKeys.add(pageKey);
        for (const item of data.songlist) {
          const song = importSong(item, 'qq');
          if (song) songs.push(song);
        }
        progress?.(songs.length, total);
        // 偏移对应原始歌单位置，不能用过滤后的数量递增，否则漏曲或重复。
        if (!data.hasmore || begin + 100 >= total) break;
        if (!data.songlist.length && !data.filtered_song?.length && !data.invalid_song?.length)
          throw new Error('QQ后续歌曲暂未返回，请重新读取。');
      }
      filteredCount = Math.max(filteredIds.size, total - songs.length);
    } else if (link.platform === 'netease') {
      const headers = {
        Referer: 'https://music.163.com/',
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      const detail = await requestJson(
        `https://music.163.com/api/v6/playlist/detail?id=${link.id}`,
        { method: 'GET', headers, signal }
      );
      const playlist = detail?.playlist;
      if (detail?.code !== 200 || !playlist || !Array.isArray(playlist.trackIds))
        throw new Error('网易云歌单暂未读取，请确认歌单公开后重试。');
      title = playlist.name || title;
      coverUrl = playlist.coverImgUrl || '';
      const ids: number[] = playlist.trackIds.map((item: any) => Number(item.id));
      total = Number(playlist.trackCount) || ids.length;
      if (ids.length < total) throw new Error('平台暂未返回完整歌曲编号，请稍后重试。');
      if (ids.length > PLAYLIST_LIMIT) throw new Error('歌单超过一万首，请分成较小的歌单后导入。');
      const details = new Map<number, any>(
        (playlist.tracks || []).map((song: any) => [Number(song.id), song])
      );
      for (let start = 0; start < ids.length; start += 200) {
        const missing = ids.slice(start, start + 200).filter((id) => !details.has(id));
        if (missing.length) {
          const result = await requestJson('https://music.163.com/api/v3/song/detail', {
            method: 'POST',
            headers,
            signal,
            body: `c=${encodeURIComponent(JSON.stringify(missing.map((id) => ({ id }))))}`
          });
          if (result?.code !== 200 || !Array.isArray(result.songs))
            throw new Error('网易云歌曲详情暂未读取，请重试。');
          for (const song of result.songs) details.set(Number(song.id), song);
        }
        progress?.(Math.min(start + 200, ids.length), total);
      }
      for (const id of ids) {
        const song = importSong(details.get(id), 'netease');
        if (song) songs.push(song);
      }
      filteredCount = Math.max(0, total - songs.length);
    } else {
      const pageKeys = new Set<string>();
      for (let page = 0; page < PLAYLIST_LIMIT / 200; page++) {
        checkImportCanceled(signal);
        const playlist = await dependencies.kuwo(link.id, page, 200, signal);
        checkImportCanceled(signal);
        if (!playlist || !Array.isArray(playlist.tracks))
          throw new Error('酷我歌单暂未读取，请重试。');
        title = playlist.name || title;
        coverUrl = playlist.coverImgUrl || playlist.picUrl || coverUrl;
        total = Math.max(total, Number(playlist.trackCount) || 0);
        if (total > PLAYLIST_LIMIT) throw new Error('歌单超过一万首，请分成较小的歌单后导入。');
        const key = playlist.tracks.map((song: any) => song.id).join(',');
        if (key && pageKeys.has(key)) throw new Error('酷我返回了重复分页，请稍后重新读取。');
        pageKeys.add(key);
        for (const item of playlist.tracks) {
          const song = importSong(item, 'kuwo');
          if (song) songs.push(song);
        }
        progress?.(songs.length, total);
        if ((page + 1) * 200 >= total || playlist.tracks.length < 200) break;
      }
      filteredCount = Math.max(0, total - songs.length);
    }
    checkImportCanceled(signal);
    if (!songs.length) throw new Error('这个歌单没有可读取的歌曲，请换一个公开歌单。');
    return { ...link, title, coverUrl, songs, total: Math.max(total, songs.length), filteredCount };
  };
}

const normalizeMatch = (value: string) =>
  value.toLocaleLowerCase().replace(/[\s\-_—–|《》.,，。!！?？()（）:：;；“”、·&]/g, '');
const songTitle = (value: string) => normalizeMatch(value.replace(/-《.*$/, ''));
const versionMarker = (value: string) =>
  [...value.toLowerCase().matchAll(/live|remix|伴奏|翻唱|现场|加速|降调/g)]
    .map((match) => match[0])
    .sort()
    .join('|');
export function isImportMatch(
  source: PlaylistImportSong,
  target: { name: string; artist: string; duration?: number }
) {
  if (
    songTitle(source.name) !== songTitle(target.name) ||
    versionMarker(source.name) !== versionMarker(target.name)
  )
    return false;
  const artists = source.artist
    .split(/\s*[/、&]\s*/)
    .filter(Boolean)
    .map(normalizeMatch);
  if (!artists.length || !artists.every((artist) => normalizeMatch(target.artist).includes(artist)))
    return false;
  return (
    !source.duration || !target.duration || Math.abs(source.duration - target.duration) <= 12000
  );
}

export interface ImportMatch<T> {
  source: PlaylistImportSong;
  track?: T;
  exact: boolean;
  error?: string;
}

export async function matchPlaylistSongs<T>(options: {
  songs: PlaylistImportSong[];
  signal: ImportSignal;
  search: (query: string, signal: ImportSignal) => Promise<T[]>;
  describe: (track: T) => { name: string; artist: string; duration?: number };
  onResult: (index: number, result: ImportMatch<T>) => void;
}) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, options.songs.length) }, async () => {
      while (next < options.songs.length && !options.signal.aborted) {
        const index = next++;
        const source = options.songs[index];
        try {
          const found = await options.search(
            `${source.name} ${source.artist}`.trim(),
            options.signal
          );
          checkImportCanceled(options.signal);
          const exact = found.find((track) => isImportMatch(source, options.describe(track)));
          // 搜索第一项不一定是同一版本；只有歌名、歌手和时长匹配才自动勾选。
          options.onResult(index, { source, track: exact || found[0], exact: Boolean(exact) });
        } catch (error) {
          if (options.signal.aborted || (error instanceof Error && error.name === 'AbortError'))
            break;
          options.onResult(index, { source, exact: false, error: '暂未匹配，稍后可重试' });
        }
      }
    })
  );
  checkImportCanceled(options.signal);
}
