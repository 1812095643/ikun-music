import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'native-kit/build/unimodule-sdk');
const archive = join(destination, 'uniapp-release.aar');
const expected = '4c62df178081c1c156f25aea2bfa945c64550eee8b833f72819b836796a56399';
await mkdir(destination, { recursive: true });
let bytes;
try {
  bytes = await readFile(archive);
} catch {
  bytes = Buffer.alloc(0);
}
if (createHash('sha256').update(bytes).digest('hex') !== expected) {
  const url =
    'https://raw.githubusercontent.com/dcloudio/RichAlert/3edbdf77ef46f5993fb92c1e66522d5d06ad9a9f/android/UniPlugin_Richalert/app/libs/uniapp-v8-release.aar';
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok)
    throw new Error(`Official UniModule compile SDK returned HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('UniModule compile SDK checksum mismatch');
  await writeFile(archive, bytes);
}
const jar = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'jar.exe' : 'jar')
  : 'jar';
const unpack = spawnSync(jar, ['xf', archive, 'classes.jar'], {
  cwd: destination,
  stdio: 'inherit',
  windowsHide: true
});
if (unpack.error || unpack.status !== 0)
  throw unpack.error || new Error('Unable to extract UniModule compile SDK');
console.log('Official UniModule API ready for compile-only use.');
