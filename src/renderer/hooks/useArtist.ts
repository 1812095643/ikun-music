import { useRouter } from 'vue-router';

import { useSettingsStore } from '@/store';
import { requestMiniModeNavigation } from '@/utils/miniModeNavigation';

export const useArtist = () => {
  const router = useRouter();
  const settingsStore = useSettingsStore();

  /**
   * 跳转到歌手详情页
   * @param id 歌手ID
   */
  const navigateToArtist = (id: number) => {
    const targetRoute = `/artist/detail/${id}`;

    // 迷你模式下直接路由跳转会被全局守卫拦住，所以先记录目标页，再恢复主窗口。
    if (settingsStore.isMiniMode && window.api?.restore) {
      requestMiniModeNavigation(targetRoute);
      window.api.restore();
      return;
    }

    router.push(targetRoute);
  };

  return {
    navigateToArtist
  };
};
