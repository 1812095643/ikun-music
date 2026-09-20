import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareVersions,
  findMobileUpdate,
  MOBILE_REPOSITORY
} from '../src/services/mobileRelease.ts';

const release = (version, changes = {}) => ({
  tag_name: `mobile-v${version}`,
  draft: false,
  prerelease: true,
  body: 'Release notes',
  assets: [
    {
      name: `ikun-music-mobile-${version}-android.apk`,
      size: 24244486,
      state: 'uploaded',
      digest: `sha256:${'a'.repeat(64)}`,
      browser_download_url: `https://github.com/${MOBILE_REPOSITORY}/releases/download/mobile-v${version}/ikun-music-mobile-${version}-android.apk`
    }
  ],
  ...changes
});

test('selects the newest Android version regardless of release order and desktop latest', () => {
  const result = findMobileUpdate(
    [
      { ...release('99.0.0'), tag_name: 'v99.0.0' },
      release('0.1.2'),
      release('0.1.10'),
      release('0.1.3'),
      release('0.2.0', { draft: true })
    ],
    '0.1.1'
  );
  assert.equal(result.version, '0.1.10');
  assert.equal(compareVersions('0.1.10', '0.1.9'), 1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
});

test('does not downgrade or select draft, emulator or incomplete assets', () => {
  assert.equal(findMobileUpdate([release('0.1.0'), release('0.1.2')], '0.1.2'), null);
  assert.equal(
    findMobileUpdate(
      [release('0.1.3', { draft: true }), release('0.1.4', { assets: [] })],
      '0.1.2'
    ),
    null
  );
  const emulator = release('0.1.3');
  emulator.assets[0].name = 'ikun-music-mobile-0.1.3-emulator.apk';
  assert.equal(findMobileUpdate([emulator], '0.1.2'), null);
});

test('rejects untrusted download URLs and missing or malformed digests', () => {
  for (const changes of [
    { browser_download_url: 'https://example.com/other.apk' },
    { digest: undefined },
    { digest: 'sha256:bad' },
    { state: 'new' },
    { size: 0 }
  ]) {
    const item = release('0.1.3');
    Object.assign(item.assets[0], changes);
    assert.equal(findMobileUpdate([item], '0.1.2'), null);
  }
});

test('handles malformed entries without inventing an update', () => {
  assert.equal(
    findMobileUpdate([null, {}, { tag_name: 'mobile-v0.2.0', assets: {} }], '0.1.2'),
    null
  );
  assert.throws(() => findMobileUpdate({ message: 'Rate limit' }, '0.1.2'));
  assert.throws(() => compareVersions('invalid', '0.1.2'));
});
