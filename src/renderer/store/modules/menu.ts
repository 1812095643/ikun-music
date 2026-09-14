import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import homeRouter from '@/router/home';
import { useSettingsStore } from '@/store/modules/settings';
import { isAndroidRuntime, isDesktopRuntime } from '@/utils';

const androidFirstStageMenuPaths = new Set(['/', '/search']);
const getAndroidFirstStageMenu = (item: any) =>
  item.path === '/search'
    ? {
        ...item,
        path: '/mobile-search'
      }
    : item;

export const useMenuStore = defineStore('menu', () => {
  const allMenus = ref(homeRouter);
  const settingsStore = useSettingsStore();

  const menus = computed(() => {
    return allMenus.value
      .filter((item) => {
        if (isAndroidRuntime && !androidFirstStageMenuPaths.has(item.path)) {
          return false;
        }
        if (item.meta?.electronOnly && !isDesktopRuntime) {
          return false;
        }
        if ((item.meta as any)?.hideInSidebar) {
          return false;
        }
        if (settingsStore.isMobile) {
          return item.meta?.isMobile !== false;
        }
        return true;
      })
      .map((item) => (isAndroidRuntime ? getAndroidFirstStageMenu(item) : item));
  });

  const setMenus = (newMenus: any[]) => {
    allMenus.value = newMenus;
  };

  return {
    menus,
    setMenus
  };
});
