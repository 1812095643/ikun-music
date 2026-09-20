import { APP_UPDATE_RELEASE_URL } from '../../../src/shared/appUpdate';

export function openReleaseDownloads() {
  // #ifdef APP-PLUS
  plus.runtime.openURL(APP_UPDATE_RELEASE_URL, () => {
    uni.showToast({ title: '暂时无法打开下载页面，请稍后重试', icon: 'none' });
  });
  // #endif
  // #ifdef H5
  window.open(APP_UPDATE_RELEASE_URL, '_blank', 'noopener,noreferrer');
  // #endif
}
