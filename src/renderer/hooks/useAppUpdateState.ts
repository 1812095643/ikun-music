import { computed, onMounted, onUnmounted } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

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
    if (!isElectron || !window.api?.getAppUpdateState) return;

    try {
      const currentState = await window.api.getAppUpdateState();
      syncUpdateState(currentState);
    } catch (error) {
      console.error('初始化更新状态失败:', error);
    }
  };

  onMounted(() => {
    if (!isElectron || !window.api?.onAppUpdateState) return;

    listenerCount += 1;
    if (listenerCount === 1) {
      window.api.removeAppUpdateListeners();
    }
    window.api.onAppUpdateState(syncUpdateState);
    void initializeUpdateState();
  });

  onUnmounted(() => {
    if (!isElectron || !window.api?.removeAppUpdateListeners) return;

    listenerCount = Math.max(listenerCount - 1, 0);
    if (listenerCount === 0) {
      window.api.removeAppUpdateListeners();
    }
  });

  return {
    appUpdateState: computed(() => settingsStore.appUpdateState),
    hasAppUpdate: computed(() => hasUpdateStatus(settingsStore.appUpdateState))
  };
};
