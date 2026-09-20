import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const emulator = process.argv.includes('--emulator');
const sdk = process.env.DCLOUD_ANDROID_SDK;
if (!sdk) throw new Error('DCLOUD_ANDROID_SDK must point to Android-SDK@5.26.82680_20260914');
const appKey = process.env.DCLOUD_APPKEY || '';
if (!checkOnly) {
  for (const name of [
    'DCLOUD_APPKEY',
    'ANDROID_KEYSTORE_FILE',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS'
  ]) {
    if (!process.env[name]) throw new Error(`${name} is required for an installable offline APK`);
  }
  await stat(process.env.ANDROID_KEYSTORE_FILE);
}
if (appKey && !/^[a-zA-Z0-9_-]{16,256}$/.test(appKey))
  throw new Error('Invalid offline AppKey format');
const manifest = JSON.parse(await readFile(join(root, 'src/manifest.json'), 'utf8'));
const compiled = JSON.parse(await readFile(join(root, 'dist/build/app/manifest.json'), 'utf8'));
const plugin = JSON.parse(
  await readFile(join(root, 'src/nativeplugins/Ikun-DeviceKit/package.json'), 'utf8')
);
if (!/^__UNI__[A-Z0-9]+$/.test(manifest.appid) || compiled.id !== manifest.appid) {
  throw new Error('Compiled and source AppIDs must match the registered DCloud application');
}
if (
  compiled.version?.name !== manifest.versionName ||
  compiled.plus?.['uni-app']?.compilerVersion !== '5.26'
) {
  throw new Error(
    'Rebuild the app with the matching uni-app 5.26 compiler and application version'
  );
}
const hashes = {
  'lib.5plus.base-release.aar': '12f78a607b8eba0a79acb856cb13ecd5830ec5873d5339fedc758fa28f43212c',
  'uniapp-v8-release.aar': '58982bc01e4d293a33749b8f1831915172243e35c0102b1fada8b5c3e98e78f6',
  'android-gif-drawable-1.2.29.aar':
    '611e2699782ee0d56168b6546962f75a54bdff03136d9db94019a65c0924eddd',
  'oaid_sdk_1.0.25.aar': '917f6381f84d213abdd4d6541afda15ffd320d6ca16a934ad1f63a927f972077',
  'install-apk-release.aar': '49d90541ae41900f60a72b5c3ca79254f28c81d973662cdab9e64811fb30fc22',
  'breakpad-build-release.aar': 'bb359434b3aafe9e3d47c249a73a1d8ccff50315c47d3afd4d81846405d5b537'
};
for (const [name, expected] of Object.entries(hashes)) {
  const bytes = await readFile(join(sdk, 'SDK/libs', name));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) {
    throw new Error(`DCloud SDK version or checksum mismatch: ${name}`);
  }
}
const android = join(root, 'android');
const build = join(android, 'app/build');
const staging = join(build, 'generated/offline');
await mkdir(staging, { recursive: true });
const actualRoot = await realpath(root);
const actualStaging = await realpath(staging);
if (
  relative(actualRoot, actualStaging) !== join('android', 'app', 'build', 'generated', 'offline')
) {
  throw new Error('Refusing to replace a staging directory outside the Android build directory');
}
await rm(actualStaging, { recursive: true, force: true });
const assets = join(staging, 'assets');
const resources = join(staging, 'res');
await mkdir(join(staging, 'libs'), { recursive: true });
for (const name of Object.keys(hashes)) {
  await copyFile(join(sdk, 'SDK/libs', name), join(staging, 'libs', name));
}
await mkdir(join(assets, 'data'), { recursive: true });
const www = join(assets, 'apps', manifest.appid, 'www');
const app = join(root, 'dist/build/app');
await cp(app, www, {
  recursive: true,
  filter: (path) => {
    const name = relative(app, path).split(sep)[0];
    return !['nativeplugins', 'AndroidManifest.xml', 'Info.plist'].includes(name);
  }
});
await writeFile(
  join(assets, 'data/dcloud_control.xml'),
  `<hbuilder><apps><app appid="${manifest.appid}" appver="" /></apps></hbuilder>\n`
);
await writeFile(
  join(assets, 'dcloud_uniplugins.json'),
  JSON.stringify(
    { nativePlugins: [{ plugins: plugin._dp_nativeplugin.android.plugins }] },
    null,
    2
  ) + '\n'
);
await mkdir(join(resources, 'values'), { recursive: true });
await mkdir(join(resources, 'drawable-xxxhdpi'), { recursive: true });
await copyFile(join(root, 'src/static/brand.png'), join(resources, 'drawable-xxxhdpi/icon.png'));
await writeFile(
  join(resources, 'values/offline.xml'),
  `<resources><string name="dcloud_appkey" translatable="false">${appKey}</string></resources>\n`
);

const gradle = process.env.GRADLE_BIN || (process.platform === 'win32' ? 'gradle.bat' : 'gradle');
const tasks = checkOnly
  ? [':app:compileReleaseSources', ':app:mergeExtDexRelease', ':app:mergeReleaseNativeLibs']
  : [':app:assembleRelease'];
if (emulator) tasks.push('-PikunEmulator=true');
const result = spawnSync(
  process.platform === 'win32' ? `"${gradle}"` : gradle,
  ['--no-daemon', ...tasks],
  {
    cwd: android,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    windowsHide: true
  }
);
if (result.error || result.status !== 0)
  throw result.error || new Error(`Android build exited with ${result.status}`);
if (checkOnly) {
  console.log(
    'Offline native resources, dependencies and dex compilation verified. No installable APK was generated.'
  );
  process.exit(0);
}
const apk = join(build, 'outputs/apk/release/app-release.apk');
const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!androidSdk) throw new Error('ANDROID_HOME is required for APK signature verification');
const apksigner = join(
  androidSdk,
  'build-tools/36.1.0',
  process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'
);
const verified = spawnSync(
  process.platform === 'win32' ? `"${apksigner}"` : apksigner,
  ['verify', '--verbose', 'app-release.apk'],
  {
    cwd: dirname(apk),
    shell: process.platform === 'win32',
    stdio: 'inherit',
    windowsHide: true
  }
);
if (verified.error || verified.status !== 0)
  throw verified.error || new Error('APK signature verification failed');
const output = emulator ? join(build, 'emulator') : resolve(root, '../release-stage/android');
await mkdir(output, { recursive: true });
const destination = join(
  output,
  `ikun-music-mobile-${manifest.versionName}-${emulator ? 'emulator' : 'android'}.apk`
);
await copyFile(apk, destination);
const bytes = await readFile(destination);
const hash = createHash('sha256').update(bytes).digest('hex');
await writeFile(join(output, 'SHA256SUMS.txt'), `${hash}  ${basename(destination)}\n`);
console.log(JSON.stringify({ apk: destination, bytes: bytes.length, sha256: hash }));
