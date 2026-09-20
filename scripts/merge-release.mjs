import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'release-stage');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const keys = ['windows-x86_64', 'windows-aarch64', 'darwin-x86_64', 'darwin-aarch64'];
const manifest = {
  version,
  notes: (await readFile('release-notes.md', 'utf8')).trim(),
  pub_date: new Date().toISOString(),
  platforms: {}
};
const sums = [];
for (const key of keys) {
  const part = JSON.parse(await readFile(join(root, key + '.json'), 'utf8'));
  if (part.version !== version || !part.platforms[key])
    throw new Error(`Incomplete release: ${key}`);
  if (key.startsWith('windows') && !part.platforms[key + '-portable'])
    throw new Error(`Missing portable update: ${key}`);
  for (const item of part.artifacts) {
    const bytes = await readFile(join(root, item.name));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== item.sha256 || bytes.length !== item.size)
      throw new Error(`Artifact mismatch: ${item.name}`);
    sums.push(`${sha256}  ${item.name}`);
  }
  for (const [platform, item] of Object.entries(part.platforms)) {
    const url = new URL(item.url);
    if (
      url.origin !== 'https://github.com' ||
      !url.pathname.startsWith(`/1812095643/ikun-music/releases/download/v${version}/`)
    )
      throw new Error(`Invalid release URL: ${platform}`);
    const name = decodeURIComponent(url.pathname.split('/').at(-1));
    const signature = (await readFile(join(root, name + '.sig'), 'utf8')).trim();
    if (signature !== item.signature) throw new Error(`Signature mismatch: ${name}`);
    manifest.platforms[platform] = item;
  }
}
await writeFile(join(root, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(root, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log(
  `Verified ${sums.length} packages for ${Object.keys(manifest.platforms).length} update targets.`
);
