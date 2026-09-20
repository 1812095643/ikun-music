import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (!process.env.HBUILDERX_CLI) throw new Error('HBUILDERX_CLI is required');
const hbuilder = dirname(resolve(process.env.HBUILDERX_CLI));
const cache = join(hbuilder, 'update', 'ci-plugins');
await mkdir(cache, { recursive: true });
const base =
  'https://update.liuyingyong.cn/hbuilderx/upgrade_repositories/5.26.2026091802/win32/plugins/contents/';
const plugins = [
  ['node_modules', '1.0.0.2022092012', '9aeafe1760f4d26ea52746698589b6f0'],
  ['amazon-corretto', '21.2.0', '089a14d65d630851fc1cb981f69ec6bd'],
  ['launcher-tools', '1.0.3.2026052917', 'b13b17de5c8d8dd264d12868a20e0c50'],
  ['launcher', '5.26.2026091620.2526', 'c8b9d7d01699cc2cba2fa446e6e0aa2c'],
  ['app-safe-pack', '2.0.0.2026030912', '19a63b16c1c6cf32d6eea2ae10e31a42'],
  ['node18', '1.0.0.2026070820', '9c65e9750dedc5c9c4c61de24a357cd1'],
  ['uni_modules', '1.0.7-2026063000', '6d7520d7601efad07dd9a6878d1a2808'],
  ['uni_helpers', '3.0.1-2026081817', 'a6937e64e5effa333c46e893acf276c4'],
  ['unicloud', '2.0.70-2026091812', 'd13fe8b7af33385e7477e4b976074bde'],
  ['uniapp-uts-v1', '5.26.2026091619.3958', 'e59978445d5034962b913409ac7d005a'],
  ['uniapp-cli-vite', '5.26.2026091411.1611', '4eb09d0ad068afd754ee04a97509face']
];
const downloads = await Promise.allSettled(
  plugins.map(async ([name, version, expected]) => {
    const archive = join(cache, `${name}.${version}.zip`);
    let bytes;
    try {
      bytes = await readFile(archive);
    } catch {
      bytes = Buffer.alloc(0);
    }
    if (createHash('md5').update(bytes).digest('hex') !== expected) {
      console.log(`Downloading official HBuilderX plugin: ${name} ${version}`);
      const response = await fetch(base + `${name}.${version}.zip`, {
        signal: AbortSignal.timeout(300000)
      });
      if (!response.ok) throw new Error(`${name} download returned HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (createHash('md5').update(bytes).digest('hex') !== expected)
        throw new Error(`${name} checksum does not match the official index`);
      await writeFile(archive, bytes);
    }
    return archive;
  })
);
for (let index = 0; index < plugins.length; index++) {
  const result = downloads[index];
  if (result.status === 'rejected') throw result.reason;
  const [name] = plugins[index];
  const destination = join(hbuilder, 'plugins', name);
  await mkdir(destination, { recursive: true });
  const unpack = spawnSync('tar.exe', ['-xf', result.value, '-C', destination], {
    stdio: 'inherit',
    windowsHide: true
  });
  if (unpack.error || unpack.status !== 0)
    throw unpack.error || new Error(`Unable to extract ${name}`);
  const manifest = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
  console.log(`Installed HBuilderX plugin: ${name} ${manifest.version}`);
}
