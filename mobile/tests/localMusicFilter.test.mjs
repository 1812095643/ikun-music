import assert from 'node:assert/strict';
import test from 'node:test';
import { filterLocalMusic } from '../src/services/localMusicFilter.ts';

const track = (id, duration, fileSize, title = id) => ({
  id,
  duration,
  fileSize,
  title,
  artist: 'Artist',
  album: 'Album',
  cover: ''
});
const items = [
  track('short', 29, 300000),
  track('boundary', 60, 1048576),
  track('long', 185, 5000000),
  track('unknown', 0, 0)
];

test('keeps unknown metadata with no filters and excludes it when the corresponding limit is set', () => {
  assert.equal(filterLocalMusic(items, { minimumDuration: 0, minimumSize: 0 }).length, 4);
  assert.deepEqual(
    filterLocalMusic(items, { minimumDuration: 60, minimumSize: 1048576 }).map((t) => t.id),
    ['boundary', 'long']
  );
  assert.deepEqual(
    filterLocalMusic(items, { minimumDuration: 0, minimumSize: 4000000 }).map((t) => t.id),
    ['long']
  );
});

test('combines keyword and numeric filters without changing the source list', () => {
  assert.deepEqual(
    filterLocalMusic(items, { minimumDuration: 30, minimumSize: 0 }, ' BOUND ').map((t) => t.id),
    ['boundary']
  );
  assert.equal(
    filterLocalMusic(items, { minimumDuration: 120, minimumSize: 0 }, 'album').length,
    1
  );
  assert.equal(items.length, 4);
});
