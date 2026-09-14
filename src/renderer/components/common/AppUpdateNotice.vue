<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';

import { useAppUpdateState } from '@/hooks/useAppUpdateState';
import { useSettingsStore } from '@/store/modules/settings';

import { APP_UPDATE_STATUS } from '../../../shared/appUpdate';

const settings = useSettingsStore();
const { appUpdateState } = useAppUpdateState();
const dismissedVersion = shallowRef('');
const visible = computed(
  () =>
    appUpdateState.value.status === APP_UPDATE_STATUS.available &&
    appUpdateState.value.availableVersion !== dismissedVersion.value &&
    !settings.showUpdateModal
);
let firstCheck: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let lastCheck = 0;
const check = () => {
  if (!navigator.onLine || Date.now() - lastCheck < 60000) return;
  lastCheck = Date.now();
  void window.desktop.checkAppUpdate(false);
};
onMounted(() => {
  firstCheck = setTimeout(check, 3000);
  interval = setInterval(check, 4 * 60 * 60 * 1000);
  window.addEventListener('online', check);
});
onUnmounted(() => {
  clearTimeout(firstCheck);
  clearInterval(interval);
  window.removeEventListener('online', check);
});
</script>

<template>
  <aside v-if="visible" class="update-notice" role="status" aria-live="polite">
    <i class="ri-download-cloud-2-line" aria-hidden="true" />
    <div>
      <strong>发现新版本 {{ appUpdateState.availableVersion }}</strong>
      <p>可在方便时下载并安装更新。</p>
    </div>
    <button type="button" class="view-update" @click="settings.setShowUpdateModal(true)">
      查看更新
    </button>
    <button
      type="button"
      aria-label="稍后提醒"
      class="dismiss-update"
      @click="dismissedVersion = appUpdateState.availableVersion || ''"
    >
      <i class="ri-close-line" aria-hidden="true" />
    </button>
  </aside>
</template>

<style scoped>
.update-notice {
  position: fixed;
  right: 24px;
  bottom: 108px;
  z-index: 9900;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  max-width: calc(100vw - 40px);
  background: var(--qqm-surface);
  color: var(--qqm-text);
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgba(30, 70, 50, 0.08),
    0 8px 36px rgba(15, 30, 20, 0.12);
}
.update-notice > i {
  color: var(--qqm-primary-strong);
  font-size: 22px;
}
.update-notice strong {
  font-size: 14px;
}
.update-notice p {
  color: var(--qqm-muted);
  font-size: 12px;
  margin-top: 4px;
}
.view-update {
  white-space: nowrap;
  color: var(--qqm-primary-strong);
  font-size: 13px;
  font-weight: 600;
}
.dismiss-update {
  color: var(--qqm-muted);
  padding: 4px;
}
button:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 3px;
}
</style>
