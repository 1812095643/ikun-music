import { computed, onMounted, onUnmounted } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { isDesktopRuntime } from '@/utils';

import { APP_UPDATE_STATUS, type AppUpdateState } from '../../shared/appUpdate';

let listenerCount = 0;

const hasUpdateStatus = (state: AppUpdateState) =>
  state.status === APP_UPDATE_STATUS.available ||
  state.status === APP_UPDATE_STATUS.downloading ||
  state.status === APP_UPDATE_STATUS.downloaded;

export const useAppUpdateState = () => {
  const settingsStore = useSettingsStore();

  const syncUpdateState = (state: AppUpdateState) => {
    settingsStore.setAppUpdateState(state);
  };

  const initializeUpdateState = async () => {
    if (!isDesktopRuntime || !window.desktop?.getAppUpdateState) return;

    try {
      const currentState = await window.desktop.getAppUpdateState();
      syncUpdateState(currentState);
    } catch (error) {
      console.error('初始化更新状态失败:', error);
    }
  };

  onMounted(() => {
    if (!isDesktopRuntime || !window.desktop?.onAppUpdateState) return;

    listenerCount += 1;
    if (listenerCount === 1) {
      window.desktop.removeAppUpdateListeners();
    }
    window.desktop.onAppUpdateState(syncUpdateState);
    void initializeUpdateState();
  });

  onUnmounted(() => {
    if (!isDesktopRuntime || !window.desktop?.removeAppUpdateListeners) return;

    listenerCount = Math.max(listenerCount - 1, 0);
    if (listenerCount === 0) {
      window.desktop.removeAppUpdateListeners();
    }
  });

  return {
    appUpdateState: computed(() => settingsStore.appUpdateState),
    hasAppUpdate: computed(() => hasUpdateStatus(settingsStore.appUpdateState))
  };
};
