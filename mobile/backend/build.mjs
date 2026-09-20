import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const project = resolve(root, '../..');
const assets = resolve(root, '../src/static');
const bundledAssets = resolve(root, '../src/assets');
const styles = resolve(root, '../src/styles');
await mkdir(assets, { recursive: true });
await mkdir(bundledAssets, { recursive: true });
await mkdir(styles, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  minify: true,
  legalComments: 'eof',
  inject: [resolve(root, 'globals.ts')],
  plugins: [
    {
      name: 'native-platform',
      setup(builder) {
        builder.onResolve({ filter: /^@\/utils$/ }, () => ({ path: resolve(root, 'platform.ts') }));
      }
    }
  ],
  alias: {
    '@/services/musicService': resolve(root, 'service.ts'),
    '@': resolve(project, 'src/renderer')
  },
  outfile: resolve(root, 'dist/index.js')
});
await copyFile(resolve(project, 'src/renderer/assets/logo.png'), resolve(assets, 'brand.png'));
const css = await readFile(resolve(project, 'src/renderer/assets/css/base.css'), 'utf8');
const tokens = [...css.matchAll(/--qqm-[a-z-]+:\s*[^;]+;/g)];
const primary = new Map();
for (const token of tokens) {
  const name = token[0].split(':')[0];
  if (!primary.has(name)) primary.set(name, token[0]);
}
await writeFile(
  resolve(styles, 'brand.css'),
  '.mobile-app {\n' + [...primary.values()].map((value) => '  ' + value).join('\n') + '\n}\n'
);
const iconRoot = dirname(require.resolve('remixicon/package.json'));
const iconDir = resolve(iconRoot, 'fonts');
await copyFile(resolve(iconDir, 'remixicon.woff2'), resolve(bundledAssets, 'remixicon.woff2'));
const icons = (await readFile(resolve(iconDir, 'remixicon.css'), 'utf8')).replace(
  /@font-face\s*\{[\s\S]*?\}/,
  '@font-face {font-family:"remixicon";src:url("../assets/remixicon.woff2") format("woff2");font-display:swap;}'
);
await writeFile(resolve(styles, 'icons.css'), icons);
const licenses = resolve(assets, 'licenses');
await mkdir(licenses, { recursive: true });
const musicRoot = dirname(require.resolve('@unblockneteasemusic/server/package.json'));
await copyFile(resolve(musicRoot, 'COPYING'), resolve(licenses, 'unblock-COPYING.txt'));
await copyFile(
  resolve(musicRoot, 'COPYING.LESSER'),
  resolve(licenses, 'unblock-COPYING.LESSER.txt')
);
await copyFile(
  resolve(dirname(require.resolve('buffer/package.json')), 'LICENSE'),
  resolve(licenses, 'buffer.txt')
);
await copyFile(resolve(iconRoot, 'License'), resolve(licenses, 'remixicon.txt'));
