<template>
  <button v-if="showDownloadButton" class="action-btn" @click="navigateToDownloads">
    <n-badge :value="downloadingCount" :max="99" :show="downloadingCount > 0" :offset="[-2, 2]">
      <i class="ri-download-cloud-2-line" />
    </n-badge>
  </button>

  <n-tooltip trigger="hover">
    <template #trigger>
      <button
        class="action-btn"
        :class="{ 'update-checking': updateChecking }"
        :disabled="updateChecking"
        @click="handleAppUpdateClick"
      >
        <n-badge dot :show="hasAppUpdate" :offset="[-1, 3]">
          <i class="ri-upload-cloud-2-line" />
        </n-badge>
      </button>
    </template>
    {{ hasAppUpdate ? t('settings.about.hasUpdate') : t('settings.about.checkUpdate') }}
  </n-tooltip>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAppUpdateState } from '@/hooks/useAppUpdateState';
import { useDownloadStatus } from '@/hooks/useDownloadStatus';
import { useSettingsStore } from '@/store/modules/settings';
import { isDesktopRuntime } from '@/utils';

import { APP_UPDATE_STATUS } from '../../../shared/appUpdate';

const { t } = useI18n();
const message = useMessage();
const settingsStore = useSettingsStore();
const { downloadingCount, navigateToDownloads } = useDownloadStatus();
const { appUpdateState, hasAppUpdate } = useAppUpdateState();

const showDownloadButton = computed(
  () =>
    isDesktopRuntime &&
    (settingsStore.setData?.alwaysShowDownloadButton || downloadingCount.value > 0)
);
const updateChecking = computed(() => appUpdateState.value.status === APP_UPDATE_STATUS.checking);

const handleAppUpdateClick = async () => {
  if (hasAppUpdate.value) {
    settingsStore.setShowUpdateModal(true);
    return;
  }

  try {
    const result = await window.desktop.checkAppUpdate(true);
    settingsStore.setAppUpdateState(result);
    if (result.status === APP_UPDATE_STATUS.available) {
      settingsStore.setShowUpdateModal(true);
    } else if (result.status === APP_UPDATE_STATUS.notAvailable) {
      message.success(t('settings.about.latest'));
    } else if (result.status === APP_UPDATE_STATUS.error) {
      message.error(result.errorMessage || t('settings.about.messages.checkError'));
    }
  } catch (error) {
    console.error('检查更新失败', error);
    message.error(t('settings.about.messages.checkError'));
  }
};
</script>
