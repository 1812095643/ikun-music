import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import './prepare-unimodule-sdk.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const platforms = join(sdk, 'platforms');
if (!existsSync(platforms)) throw new Error('Android SDK platforms directory was not found');
const platform = readdirSync(platforms)
  .filter((name) => /^android-\d/.test(name))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
const tasks = process.argv.includes('--test')
  ? ['test', 'packagePlugin', 'writePreviewClasspath']
  : ['packagePlugin', 'writePreviewClasspath'];
const result = spawnSync(
  process.platform === 'win32' ? 'gradle.bat' : 'gradle',
  [
    '--no-daemon',
    '-p',
    'native-kit',
    ...tasks,
    `-PandroidJar=${join(platforms, platform, 'android.jar')}`
  ],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
