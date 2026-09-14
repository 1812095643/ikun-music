import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const root = resolve(process.argv[2]);
const base = `https://gitee.com/caixukun66666666/ikun-music/releases/download/v${version}/`;
const platforms = {};
const hashes = [];
for (const [target, suffix] of [
  ['windows-x86_64', 'setup.exe'],
  ['windows-x86_64-portable', 'portable.zip']
]) {
  const name = `ikun-music-${version}-${suffix}`;
  const file = join(root, name);
  const signature = (await readFile(file + '.sig', 'utf8')).trim();
  if (!signature || !/^[a-zA-Z0-9+/=\r\n]+$/.test(signature)) throw new Error(`${name} 签名不完整`);
  const sha256 = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  platforms[target] = { signature, url: base + name, sha256, size: (await stat(file)).size };
  hashes.push(`${sha256}  ${name}`);
}
const notes = await readFile('release-notes.md', 'utf8');
await writeFile(
  join(root, 'latest.json'),
  JSON.stringify({ version, notes, pub_date: new Date().toISOString(), platforms }, null, 2) + '\n'
);
await writeFile(join(root, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
console.log('安装包、便携包、签名和更新清单已准备好；附件上传成功后才发布清单。');
