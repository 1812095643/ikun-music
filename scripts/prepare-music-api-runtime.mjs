import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(project, 'src-tauri/runtime');
const destination = join(project, 'src-tauri/runtime-stage');
const nodeBinary = resolve(process.env.IKUN_NODE_BINARY || process.execPath);
const requestedArch = process.env.IKUN_RUNTIME_ARCH || process.env.TAURI_ENV_ARCH || process.arch;
const arch = { x64: 'x86_64', arm64: 'aarch64' }[requestedArch] || requestedArch;
const platform = process.platform;
if (!['win32', 'darwin'].includes(platform) || !['x86_64', 'aarch64'].includes(arch)) {
  throw new Error(`Unsupported music runtime target: ${platform}/${arch}`);
}
const binary = await readFile(nodeBinary);
let actualArch;
if (platform === 'win32' && binary.readUInt16LE(0) === 0x5a4d) {
  const offset = binary.readUInt32LE(0x3c);
  if (binary.readUInt32LE(offset) !== 0x4550) throw new Error('Invalid PE binary');
  actualArch = { 0x8664: 'x86_64', 0xaa64: 'aarch64' }[binary.readUInt16LE(offset + 4)];
} else if (platform === 'darwin' && binary.readUInt32LE(0) === 0xfeedfacf) {
  actualArch = { 0x1000007: 'x86_64', 0x100000c: 'aarch64' }[binary.readUInt32LE(4)];
}
if (actualArch !== arch) {
  throw new Error(
    `Node architecture mismatch: expected ${arch}, got ${actualArch || 'unknown'}. Set IKUN_NODE_BINARY to the matching Node executable.`
  );
}
const files = ['music-service.cjs', 'kuwo-playback.cjs', 'package.json', 'package-lock.json'];
const inputs = await Promise.all(files.map((name) => readFile(join(source, name))));
const signature = createHash('sha256').update(`${platform}/${arch}`).update(binary);
for (const input of inputs) signature.update(input);
signature.update(await readFile(fileURLToPath(import.meta.url)));
const expected = signature.digest('hex');
const executable = platform === 'win32' ? 'node.exe' : 'node';
const signaturePath = join(destination, '.runtime-signature');
let current = '';
try {
  await stat(join(destination, executable));
  await stat(join(destination, 'node_modules'));
  current = (await readFile(signaturePath, 'utf8')).trim();
} catch {
  current = '';
}
if (current === expected) {
  console.log(`Reusing music runtime: ${platform}/${arch}`);
  process.exit(0);
}
await mkdir(destination, { recursive: true });
await rm(signaturePath, { force: true });
await rm(join(destination, platform === 'win32' ? 'node' : 'node.exe'), { force: true });
await copyFile(nodeBinary, join(destination, executable));
if (platform !== 'win32') await chmod(join(destination, executable), 0o755);
for (let index = 0; index < files.length; index++) {
  await writeFile(join(destination, files[index]), inputs[index]);
}
const installArgs = ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'];
const installed =
  platform === 'win32'
    ? spawnSync(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', 'npm ci --omit=dev --ignore-scripts --no-audit --no-fund'],
        { cwd: destination, stdio: 'inherit', windowsHide: true }
      )
    : spawnSync('npm', installArgs, { cwd: destination, stdio: 'inherit' });
if (installed.error || installed.status !== 0)
  throw installed.error || new Error('Runtime dependencies could not be installed');
for (const name of files.filter((name) => name.endsWith('.cjs'))) {
  const checked = spawnSync(process.execPath, ['--check', join(destination, name)], {
    stdio: 'inherit',
    windowsHide: true
  });
  if (checked.error || checked.status !== 0)
    throw checked.error || new Error(`Invalid runtime script: ${name}`);
}
await writeFile(
  join(destination, 'runtime-target.json'),
  JSON.stringify(
    { platform, arch, nodeSha256: createHash('sha256').update(binary).digest('hex') },
    null,
    2
  ) + '\n'
);
await writeFile(signaturePath, expected + '\n');
console.log(`Music runtime ready: ${platform}/${arch}`);
