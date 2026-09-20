export const MOBILE_REPOSITORY = '1812095643/ikun-music';
export const MOBILE_RELEASE_API = `https://api.github.com/repos/${MOBILE_REPOSITORY}/releases?per_page=30`;

export interface MobileRelease {
  version: string;
  notes: string;
  pageUrl: string;
  url: string;
  size: number;
  sha256: string;
}

interface ReleaseAsset {
  name?: string;
  size?: number;
  digest?: string;
  browser_download_url?: string;
  state?: string;
}
interface GithubRelease {
  draft?: boolean;
  tag_name?: string;
  body?: string;
  assets?: ReleaseAsset[];
}

function versionParts(value: string) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function compareVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) throw new Error('版本信息不完整，请稍后重新检查。');
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function findMobileUpdate(value: unknown, currentVersion: string): MobileRelease | null {
  if (!Array.isArray(value)) throw new Error('更新服务暂时没有返回版本信息。');
  let newest: MobileRelease | null = null;
  for (const release of value as GithubRelease[]) {
    if (!release || typeof release !== 'object') continue;
    const version = release.tag_name?.match(/^mobile-v(\d+\.\d+\.\d+)$/)?.[1];
    if (release.draft || !version || !versionParts(version)) continue;
    if (compareVersions(version, currentVersion) <= 0) continue;
    if (newest && compareVersions(version, newest.version) <= 0) continue;
    const filename = `ikun-music-mobile-${version}-android.apk`;
    const url = `https://github.com/${MOBILE_REPOSITORY}/releases/download/mobile-v${version}/${filename}`;
    const asset = Array.isArray(release.assets)
      ? release.assets.find((item) => item?.name === filename)
      : undefined;
    // 桌面与移动端共用仓库，只接受本仓库正式上传的安卓包及 GitHub 提供的 SHA-256。
    if (!asset || asset.state !== 'uploaded' || asset.browser_download_url !== url) continue;
    if (!Number.isSafeInteger(asset.size) || !asset.size || asset.size <= 0) continue;
    if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) continue;
    newest = {
      version,
      notes: String(release.body || '').slice(0, 1600),
      pageUrl: `https://github.com/${MOBILE_REPOSITORY}/releases/tag/mobile-v${version}`,
      url,
      size: asset.size,
      sha256: asset.digest!.slice(7).toLowerCase()
    };
  }
  return newest;
}
