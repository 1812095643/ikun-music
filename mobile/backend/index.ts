import {
  getKuwoMusicUrl,
  getKuwoPlaylistDetail,
  getKuwoRankDetail,
  getKuwoRankList,
  getKuwoRecommendPlaylists,
  searchKuwoArtists,
  searchKuwoSongs
} from '../../src/renderer/api/kuwo';

export { setTransport } from './transport';
import { resolvePlaylistLink } from '../../src/renderer/api/playlistSources';
import { parseLyrics } from '../../src/renderer/utils/yrcParser';
import { detectPlaylistLink, type ImportSignal } from '../../src/shared/playlistImport';
import { getTransport } from './transport';

export async function resolveSharedPlaylist(url: string, signal?: ImportSignal) {
  const link = detectPlaylistLink(url);
  if (!link) throw new Error('请粘贴 QQ 音乐、网易云或酷我的公开歌单链接。');
  return resolvePlaylistLink(link, signal);
}

async function requestLyrics(url: string) {
  const response = await getTransport().request({
    requestId: `lyric-${Date.now()}-${Math.random()}`,
    url,
    options: {
      method: 'GET',
      timeout: 8000,
      headers: { 'User-Agent': 'okhttp/3.10.0', Referer: 'https://m.kuwo.cn/' }
    }
  });
  if (response.statusCode !== 200) throw new Error('Lyrics temporarily unavailable');
  return response.body;
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[\s《》「」『』"“”‘’()（）\-_.·,，。!！?？:：]/g, '');

export async function run(operation: string, input: any = {}) {
  switch (operation) {
    case 'playlist-link':
      return resolveSharedPlaylist(input.url, input.signal);
    case 'home':
      return (await getKuwoRecommendPlaylists(18)).data.result;
    case 'search':
      return (
        await searchKuwoSongs(
          { keywords: input.query, limit: 40, offset: input.offset || 0 },
          input.signal
        )
      ).data.result;
    case 'playlist':
      return (await getKuwoPlaylistDetail(input.id, 0, 500)).data.playlist;
    case 'artists':
      return (await searchKuwoArtists({ keywords: input.query, limit: 4 })).data.result.artists;
    case 'ranks':
      return (await getKuwoRankList()).data;
    case 'rank':
      return (await getKuwoRankDetail(input.id, undefined, 1, 50)).data.playlist;
    case 'resolve':
      return (await getKuwoMusicUrl(input.id, input.quality, input.signal)).data.data;
    case 'lyrics': {
      const primary = await requestLyrics(
        `https://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${encodeURIComponent(input.id)}`
      ).catch(() => null);
      if (primary?.data?.lrclist?.length)
        return primary.data.lrclist.map((line: any) => ({
          time: Number(line.time),
          text: line.lineLyric
        }));
      if (!input.title || !input.artist) return [];
      const title = String(input.title).replace(/-《.*$/, '');
      const result = await requestLyrics(
        `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(input.artist + '-' + title)}&duration=${Math.round(input.duration * 1000)}`
      );
      const candidates = (result?.candidates || [])
        .filter((candidate: any) => {
          const duration = Number(candidate.duration || 0) / 1000;
          const sameVersion =
            /live|现场|伴奏|remix/i.test(title) ===
            /live|现场|伴奏|remix/i.test(candidate.song || '');
          return (
            candidate.id &&
            candidate.accesskey &&
            sameVersion &&
            normalize(candidate.singer || '').includes(normalize(input.artist)) &&
            normalize(candidate.song || '').includes(normalize(title)) &&
            (!duration || !input.duration || Math.abs(duration - input.duration) <= 10)
          );
        })
        .sort(
          (a: any, b: any) =>
            Math.abs(a.duration / 1000 - input.duration) -
            Math.abs(b.duration / 1000 - input.duration)
        );
      for (const candidate of candidates.slice(0, 2)) {
        const content = await requestLyrics(
          `https://lyrics.kugou.com/download?ver=1&client=pc&id=${encodeURIComponent(candidate.id)}&accesskey=${encodeURIComponent(candidate.accesskey)}&fmt=lrc&charset=utf8`
        );
        if (!content?.content) continue;
        const parsed = parseLyrics(Buffer.from(content.content, 'base64').toString('utf8'));
        if (parsed.success)
          return parsed.data.lyrics
            .filter((line) => line.startTime >= 0 && line.fullText.trim())
            .map((line) => ({ time: line.startTime / 1000, text: line.fullText }));
      }
      return [];
    }
    default:
      throw new Error('Unknown music operation');
  }
}
