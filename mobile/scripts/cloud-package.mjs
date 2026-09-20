import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = join(root, 'src');
const output = resolve(root, '../release-stage/android');
const cli = process.env.HBUILDERX_CLI;
const username = process.env.DCLOUD_USERNAME;
const password = process.env.DCLOUD_PASSWORD;
if (!cli || !username || !password)
  throw new Error('HBUILDERX_CLI and DCloud credentials must be configured');
const manifest = JSON.parse(await readFile(join(root, 'dist/build/app/manifest.json'), 'utf8'));
if (manifest.id !== '__UNI__GC2DB750') throw new Error('Unexpected DCloud AppID');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (manifest.version?.name !== version)
  throw new Error('Mobile package and manifest versions must match');

function run(args, timeout = 120000, quiet = false) {
  return new Promise((resolve, reject) => {
    const operation = args.slice(0, args[0] === 'user' ? 2 : 1).join(' ');
    console.log(`HBuilderX: ${operation}`);
    const child = spawn(cli, args, {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let text = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`HBuilderX ${operation} timed out`));
    }, timeout);
    const collect = (chunk) => {
      text += chunk.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      const output = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
      const reportedFailure =
        /:\s*FAILED\b|Cloud server returns error|compiling failed|compilation failed|depends on the plug-in|operation depends on|please try again after installation/i.test(
          output
        );
      if (!quiet && output.trim()) {
        process.stdout.write(
          output
            .split(password)
            .join('[redacted]')
            .split(username)
            .join('[account]')
            .replace(/(token|password|authorization|cookie)[^\r\n]*/gi, '$1 [redacted]')
        );
      }
      if (code !== 0 || reportedFailure) {
        reject(
          new Error(
            `HBuilderX ${operation} failed (exit ${code}, reported failure ${reportedFailure})`
          )
        );
      } else resolve(output);
    });
  });
}
await run(['open']);
let ready = false;
for (let attempt = 0; attempt < 15; attempt++) {
  if (/5\.26/.test(await run(['version'], 15000, true))) {
    ready = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!ready) throw new Error('HBuilderX 5.26 did not become ready');
await run(
  ['user', 'login', '--username', username, '--password', password, '--global', 'true'],
  120000,
  true
);
await run(['project', 'open', '--path', project]);
await run(['project', 'list']);
console.log('Submitting Android package with the application cloud certificate.');
const report = await run(
  [
    'pack',
    '--project',
    project,
    '--platform',
    'android',
    '--safemode',
    'true',
    '--android.packagename',
    'cn.ikun.music',
    '--android.androidpacktype',
    '3',
    '--splashads',
    'false',
    '--rpads',
    'false',
    '--unimpads',
    'false'
  ],
  45 * 60 * 1000
);
async function apks(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await apks(path)));
    else if (entry.name.endsWith('.apk')) files.push(path);
  }
  return files;
}
await mkdir(output, { recursive: true });
const destination = join(output, `ikun-music-mobile-${version}-android.apk`);
const files = await apks(join(project, 'unpackage/release'));
if (files.length === 1) {
  await copyFile(files[0], destination);
} else if (files.length === 0) {
  const status = report + '\n' + (await run(['pack', 'status', '--project', project]));
  const urls = [...new Set(status.match(/https:\/\/[^\s"'<>]+\.apk(?:\?[^\s"'<>]*)?/g) || [])];
  if (urls.length !== 1)
    throw new Error(
      'Cloud packaging did not return one APK. Inspect packaging status in HBuilderX.'
    );
  const response = await fetch(urls[0], { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`APK download returned HTTP ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
} else {
  throw new Error('More than one APK was produced; refusing an ambiguous release');
}
const bytes = await readFile(destination);
if (bytes.readUInt32LE(0) !== 0x04034b50 || bytes.length < 1000000)
  throw new Error('Downloaded file is not an APK');
const hash = createHash('sha256').update(bytes).digest('hex');
await writeFile(join(output, 'SHA256SUMS.txt'), `${hash}  ${destination.split(/[\\/]/).at(-1)}\n`);
console.log(
  JSON.stringify({
    version,
    appid: manifest.id,
    bytes: (await stat(destination)).size,
    sha256: hash
  })
);
