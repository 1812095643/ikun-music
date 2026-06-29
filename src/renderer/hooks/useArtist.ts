import { useRouter } from 'vue-router';

import { useSettingsStore } from '@/store';
import { isAndroidRuntime, isDesktopRuntime } from '@/utils';
import { restoreMainWindowFromMiniMode } from '@/utils/miniModeNavigation';

export const useArtist = () => {
  const router = useRouter();
  const settingsStore = useSettingsStore();

  /**
   * 跳转到歌手详情页
   * @param id 歌手ID
   */
  const navigateToArtist = (id: number) => {
    // Android 第一阶段不开放歌手详情，避免歌曲项点击歌手后被路由守卫回首页。
    if (isAndroidRuntime) return;

    const targetRoute = `/artist/detail/${id}`;

    // 迷你模式下直接路由跳转会被全局守卫拦住，所以先记录目标页，再恢复主窗口。
    if (settingsStore.isMiniMode && isDesktopRuntime && window.api?.restore) {
      restoreMainWindowFromMiniMode({
        restore: window.api.restore,
        targetRoute
      });
      return;
    }

    router.push(targetRoute);
  };

  return {
    navigateToArtist
  };
};
