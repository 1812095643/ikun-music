import { copyFile, cp, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/build/app');
await stat(resolve(output, 'manifest.json'));
await stat(resolve(root, 'src/nativeplugins/Ikun-DeviceKit/android/ikun-device-kit.aar'));
for (const name of ['AndroidManifest.xml', 'Info.plist']) {
  await copyFile(resolve(root, 'src', name), resolve(output, name));
}
await cp(resolve(root, 'src/nativeplugins'), resolve(output, 'nativeplugins'), { recursive: true });
process.stdout.write('Native packaging configuration is ready.\n');
