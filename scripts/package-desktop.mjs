import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const target =
  process.argv.find((value) => value.startsWith('--target='))?.slice(9) ||
  `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-${process.platform === 'win32' ? 'pc-windows-msvc' : 'apple-darwin'}`;
const arch = target.split('-')[0];
const windows = target.endsWith('pc-windows-msvc');
if (
  !['x86_64', 'aarch64'].includes(arch) ||
  (windows ? process.platform !== 'win32' : process.platform !== 'darwin')
) {
  throw new Error(`Unsupported host/target: ${process.platform}/${target}`);
}
process.env.IKUN_RUNTIME_ARCH = arch;
const platformKey = `${windows ? 'windows' : 'darwin'}-${arch}`;
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const output = resolve(
  process.argv.find((value) => value.startsWith('--output='))?.slice(9) ||
    `release-stage/${platformKey}`
);
await mkdir(output, { recursive: true });
const prefix = `ikun-music-${version}-${windows ? 'windows' : 'macos'}-${arch === 'aarch64' ? 'arm64' : 'x64'}`;
const release = join(root, 'src-tauri/target', target, 'release');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0)
    throw result.error || new Error(`${command} exited with ${result.status}`);
}
function signed(args) {
  run(process.execPath, ['scripts/tauri-release.mjs', ...args]);
}
signed(['build', '--target', target, '--bundles', windows ? 'nsis' : 'app,dmg']);
const nativeArch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
run(process.execPath, [
  'scripts/check-music-service.mjs',
  'src-tauri/runtime-stage',
  ...(nativeArch === arch ? [] : ['--host-node'])
]);
const platforms = {};
const artifacts = [];
async function asset(source, name, key) {
  const destination = join(output, name);
  if (resolve(source) !== destination) await copyFile(source, destination);
  const data = await readFile(destination);
  const item = {
    name,
    sha256: createHash('sha256').update(data).digest('hex'),
    size: (await stat(destination)).size
  };
  artifacts.push(item);
  if (key) {
    const signature = (await readFile(source + '.sig', 'utf8')).trim();
    if (!signature || !/^[a-zA-Z0-9+/=\r\n]+$/.test(signature))
      throw new Error(`Invalid updater signature: ${name}`);
    if (resolve(source) !== destination) await copyFile(source + '.sig', destination + '.sig');
    platforms[key] = {
      url: `https://github.com/1812095643/ikun-music/releases/download/v${version}/${name}`,
      signature,
      sha256: item.sha256,
      size: item.size
    };
  }
}
async function bundled(directory, extension) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(extension));
  if (names.length !== 1) throw new Error(`Expected one ${extension} in ${directory}`);
  return join(directory, names[0]);
}
if (windows) {
  const work = join(output, '.portable-stage');
  const portable = join(work, 'ikun-music-portable');
  await mkdir(portable, { recursive: true });
  await copyFile(join(release, 'ikun-music-tauri.exe'), join(portable, 'ikun-music-tauri.exe'));
  await cp(join(root, 'src-tauri/runtime-stage'), join(portable, 'runtime'), { recursive: true });
  await writeFile(
    join(portable, 'portable.json'),
    JSON.stringify({ product: 'ikun-music', version, format: 1, arch }) + '\n'
  );
  const archive = join(output, `${prefix}-portable.zip`);
  run('tar.exe', ['-a', '-c', '-f', archive, '-C', work, 'ikun-music-portable']);
  signed(['signer', 'sign', archive]);
  await asset(archive, `${prefix}-portable.zip`, `${platformKey}-portable`);
  await asset(
    await bundled(join(release, 'bundle/nsis'), '-setup.exe'),
    `${prefix}-setup.exe`,
    platformKey
  );
  await rm(work, { recursive: true, force: true });
} else {
  await asset(
    await bundled(join(release, 'bundle/macos'), '.app.tar.gz'),
    `${prefix}.app.tar.gz`,
    platformKey
  );
  await asset(await bundled(join(release, 'bundle/dmg'), '.dmg'), `${prefix}.dmg`);
}
await writeFile(
  join(output, `${platformKey}.json`),
  JSON.stringify({ version, platforms, artifacts }, null, 2) + '\n'
);
console.log(`Packaged ${target}: ${output}`);
