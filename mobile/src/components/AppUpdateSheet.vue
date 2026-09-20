<script setup lang="ts">
import { computed } from 'vue';

import {
  cancelAppUpdateDownload,
  checkForAppUpdate,
  dismissAppUpdate,
  downloadAppUpdate,
  openAppUpdateRelease,
  updateInfo,
  updateMessage,
  updateProgress,
  updateStatus
} from '@/services/appUpdate';

import { version } from '../../package.json';
import SheetFrame from './SheetFrame.vue';

const title = computed(() =>
  updateInfo.value ? `发现新版本 ${updateInfo.value.version}` : '检查更新'
);
const working = computed(() =>
  ['checking', 'downloading', 'verifying'].includes(updateStatus.value)
);
const action = computed(() =>
  updateStatus.value === 'ready'
    ? '继续安装'
    : updateStatus.value === 'downloading'
      ? `下载中 ${updateProgress.value}%`
      : updateStatus.value === 'verifying'
        ? '正在校验安装包…'
        : '下载并安装'
);
</script>

<template>
  <sheet-frame :title="title" @close="dismissAppUpdate">
    <view class="update-body">
      <view class="update-brand"
        ><image src="/static/brand.png" /><view
          ><text class="update-name">ikun 音乐</text
          ><text class="update-version"
            >当前版本 {{ version
            }}<template v-if="updateInfo">
              · 新版 {{ (updateInfo.size / 1024 / 1024).toFixed(1) }} MB</template
            ></text
          ></view
        ></view
      >
      <text v-if="updateStatus === 'checking'" class="update-caption">正在检查新版本…</text>
      <text v-else-if="updateStatus === 'latest'" class="update-caption">当前已是最新版本。</text>
      <text v-if="updateInfo" class="update-notes">{{
        updateInfo.notes || '优化使用体验，建议更新到最新版本。'
      }}</text>
      <view
        v-if="updateStatus === 'downloading'"
        class="update-progress"
        role="progressbar"
        :aria-valuenow="updateProgress"
        aria-valuemin="0"
        aria-valuemax="100"
        ><view :style="{ width: `${updateProgress}%` }"
      /></view>
      <text v-if="updateMessage" class="update-caption" role="status">{{ updateMessage }}</text>
      <button
        v-if="updateInfo"
        role="button"
        class="update-primary"
        :disabled="working"
        @click="downloadAppUpdate"
      >
        {{ action }}
      </button>
      <button
        v-else-if="updateStatus === 'error'"
        role="button"
        class="update-primary"
        @click="checkForAppUpdate(true)"
      >
        重新检查
      </button>
      <button
        v-if="updateStatus === 'downloading'"
        role="button"
        class="update-secondary"
        @click="cancelAppUpdateDownload"
      >
        取消下载
      </button>
      <button role="button" class="update-secondary" @click="openAppUpdateRelease">
        打开发行页面
      </button>
    </view>
  </sheet-frame>
</template>

<style scoped>
.update-body {
  padding: 6px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.update-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.update-brand image {
  width: 46px;
  height: 46px;
  border-radius: 12px;
}
.update-brand > view {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.update-name {
  font-size: 17px;
  font-weight: 600;
}
.update-version,
.update-caption {
  color: var(--qqm-muted);
  font-size: 12px;
  line-height: 1.7;
}
.update-notes {
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.update-progress {
  height: 5px;
  background: var(--qqm-border);
  border-radius: 5px;
  overflow: hidden;
}
.update-progress > view {
  height: 100%;
  background: var(--qqm-primary);
  transition: width 0.2s;
}
.update-primary,
.update-secondary {
  padding: 12px 16px !important;
  font-size: 14px !important;
  border-radius: 12px;
  line-height: 1.4;
}
.update-primary {
  background: var(--qqm-primary) !important;
  color: #fff !important;
}
.update-primary[disabled] {
  opacity: 0.65;
}
.update-secondary {
  color: var(--qqm-muted) !important;
  background: var(--qqm-surface-muted) !important;
}
</style>
