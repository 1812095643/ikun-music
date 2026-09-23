import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectPlaylistLink,
  isImportMatch,
  matchPlaylistSongs
} from '../../src/shared/playlistImport.ts';

test('recognizes supported share links without browser URL APIs', () => {
  const originalUrl = globalThis.URL;
  try {
    globalThis.URL = undefined;
    for (const [url, platform, id] of [
      [
        'https://y.qq.com/n/ryqq_v2/playlist/1602398029?ADTAG=h5_share_playlist',
        'qq',
        '1602398029'
      ],
      ['https://i.y.qq.com/n2/m/share/details/taoge.html?id=1602398029', 'qq', '1602398029'],
      ['https://music.163.com/#/playlist?id=3778678', 'netease', '3778678'],
      ['https://y.music.163.com/m/playlist?id=3778678', 'netease', '3778678'],
      ['https://www.kuwo.cn/playlist_detail/12345', 'kuwo', '12345']
    ]) {
      const link = detectPlaylistLink(`Shared playlist: ${url}`);
      assert.equal(link?.platform, platform);
      assert.equal(link?.id, id);
    }
    assert.equal(detectPlaylistLink('https://y.qq.com.example.com/playlist/1602398029'), null);
    assert.equal(detectPlaylistLink('https://music.163.com/song?id=3778678'), null);
  } finally {
    globalThis.URL = originalUrl;
  }
});

test('does not auto-select another artist, version or duration', () => {
  const source = {
    name: 'The Song',
    artist: 'Singer',
    album: '',
    duration: 240000,
    externalId: '1'
  };
  assert.equal(
    isImportMatch(source, { name: 'The Song', artist: 'Singer', duration: 240500 }),
    true
  );
  for (const candidate of [
    { name: 'The Song', artist: 'Another Artist', duration: 240000 },
    { name: 'The Song (Live)', artist: 'Singer', duration: 240000 },
    { name: 'The Song', artist: 'Singer', duration: 180000 }
  ]) {
    assert.equal(isImportMatch(source, candidate), false);
  }
});

test('cancellation prevents late matching results from reaching the next import', async () => {
  const controller = new AbortController();
  const source = {
    name: 'The Song',
    artist: 'Singer',
    album: '',
    duration: 240000,
    externalId: '1'
  };
  const delivered = [];
  await assert.rejects(
    matchPlaylistSongs({
      songs: [source],
      signal: controller.signal,
      search: async () => {
        controller.abort();
        return [source];
      },
      describe: (track) => track,
      onResult: (...result) => delivered.push(result)
    }),
    { name: 'AbortError' }
  );
  assert.deepEqual(delivered, []);
});
