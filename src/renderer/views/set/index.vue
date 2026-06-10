<template>
  <div class="set-page h-full w-full transition-colors duration-200 flex flex-col">
    <!-- 顶部导航区 -->
    <div class="settings-header flex-shrink-0 z-10 page-padding pt-6 pb-3">
      <h1 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6">
        {{ t('common.settings') }}
      </h1>

      <n-scrollbar x-scrollable class="w-full">
        <div class="settings-tabs flex items-center pb-1 whitespace-nowrap">
          <div
            v-for="section in navSections"
            :key="section.id"
            class="setting-tab-button py-1.5 px-3.5 mr-2 inline-block rounded-lg border cursor-pointer transition-colors duration-200 text-sm font-medium select-none"
            :class="
              currentSection === section.id
                ? 'border-primary/25 bg-primary/10 text-primary'
                : 'settings-nav-item text-neutral-600 hover:text-primary dark:text-neutral-400 dark:hover:text-primary'
            "
            @click="currentSection = section.id"
          >
            {{ section.title }}
          </div>
        </div>
      </n-scrollbar>
    </div>

    <!-- 内容区域 -->
    <n-scrollbar class="flex-1">
      <div class="settings-content w-full mx-auto pb-32 pt-5 page-padding">
        <div v-show="currentSection === 'basic'">
          <basic-tab />
        </div>

        <div v-show="currentSection === 'playback'">
          <playback-tab />
        </div>

        <div v-show="currentSection === 'application'">
          <application-tab />
        </div>

        <div v-show="currentSection === 'network'">
          <network-tab />
        </div>

        <div v-show="currentSection === 'system'">
          <system-tab />
        </div>

        <div v-show="currentSection === 'about'">
          <about-tab />
        </div>

        <div v-show="currentSection === 'donation'">
          <donation-tab />
        </div>

        <div class="h-20"></div>
        <play-bottom />
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import PlayBottom from '@/components/common/PlayBottom.vue';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import config from '../../../../package.json';
import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';
import AboutTab from './tabs/AboutTab.vue';
import ApplicationTab from './tabs/ApplicationTab.vue';
import BasicTab from './tabs/BasicTab.vue';
import DonationTab from './tabs/DonationTab.vue';
import NetworkTab from './tabs/NetworkTab.vue';
import PlaybackTab from './tabs/PlaybackTab.vue';
import SystemTab from './tabs/SystemTab.vue';

const settingsStore = useSettingsStore();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();

// ==================== 设置数据管理 ====================
const saveSettings = useDebounceFn((data) => {
  settingsStore.setSetData(data);
}, 500);

const localSetData = ref({ ...settingsStore.setData });

const setData = computed({
  get: () => localSetData.value,
  set: (newData) => {
    localSetData.value = newData;
  }
});

watch(
  () => localSetData.value,
  (newValue) => saveSettings(newValue),
  { deep: true }
);

watch(
  () => settingsStore.setData,
  (newValue) => {
    if (JSON.stringify(localSetData.value) !== JSON.stringify(newValue)) {
      localSetData.value = { ...newValue };
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  settingsStore.setSetData(localSetData.value);
});

// ==================== Provide ====================
provide(SETTINGS_DATA_KEY, setData);
provide(SETTINGS_MESSAGE_KEY, message);
provide(SETTINGS_DIALOG_KEY, dialog);

// ==================== 导航相关 ====================
type SettingSectionConfig = {
  id: string;
  electron?: boolean;
};

const settingSections: SettingSectionConfig[] = [
  { id: 'basic' },
  { id: 'playback' },
  { id: 'application', electron: true },
  { id: 'network', electron: true },
  { id: 'system', electron: true },
  { id: 'about' },
  { id: 'donation' }
];

const navSections = computed(() => {
  return settingSections
    .filter((section) => !section.electron || isElectron)
    .map((section) => ({
      id: section.id,
      title: t(`settings.sections.${section.id}`)
    }));
});

const currentSection = ref('basic');

// ==================== 初始化 ====================
onMounted(() => {
  if (isElectron && settingsStore.appUpdateState.currentVersion === '') {
    settingsStore.setAppUpdateState(createDefaultAppUpdateState(config.version));
  }
  if (setData.value.proxyConfig) {
    // proxy form init moved to NetworkTab
  }
  if (setData.value.enableRealIP === undefined) {
    setData.value = { ...setData.value, enableRealIP: false };
  }
  if (setData.value.enableDiskCache === undefined) {
    setData.value = { ...setData.value, enableDiskCache: true };
  }
  if (!setData.value.diskCacheMaxSizeMB) {
    setData.value = { ...setData.value, diskCacheMaxSizeMB: 4096 };
  }
  if (!['lru', 'fifo'].includes(setData.value.diskCacheCleanupPolicy)) {
    setData.value = { ...setData.value, diskCacheCleanupPolicy: 'lru' };
  }
});
</script>

<style scoped>
:deep(.n-select .n-base-selection) {
  border-radius: 10px;
}

.settings-header {
  border-bottom: 1px solid var(--qqm-border);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--qqm-primary, #22c55e) 3%, var(--qqm-bg)),
    var(--qqm-bg)
  );
}

.settings-tabs {
  gap: 2px;
}

.setting-tab-button {
  border-color: var(--qqm-border);
  background: var(--qqm-surface);
}

.settings-nav-item {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.setting-tab-button:hover,
.settings-nav-item:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 26%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}

.settings-content :deep(.setting-section-surface) {
  border: 1px solid var(--qqm-border);
  border-radius: 10px;
  background: var(--qqm-surface);
  overflow: hidden;
}

.settings-content :deep(.setting-item) {
  min-height: 72px;
  border-bottom: 1px solid var(--qqm-border);
}

.settings-content :deep(.setting-item:hover) {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, var(--qqm-surface));
}

.settings-content :deep(.setting-section-surface > .setting-item:last-child) {
  border-bottom: 0;
}

.settings-content :deep(.setting-item .text-\[15px\]) {
  color: var(--qqm-text);
  font-weight: 600;
}
</style>
