<template>
  <div v-if="isDesktopRuntime" class="download-drawer-trigger">
    <n-badge :value="downloadingCount" :max="99" :show="downloadingCount > 0">
      <n-button circle @click="navigateToDownloads">
        <template #icon>
          <i class="iconfont ri-download-cloud-2-line"></i>
        </template>
      </n-button>
    </n-badge>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { isDesktopRuntime } from '@/utils';

const router = useRouter();
const downloadList = ref<any[]>([]);

// 计算下载中的任务数量
const downloadingCount = computed(() => {
  return downloadList.value.filter((item) => item.status === 'downloading').length;
});

// 导航到下载页面
const navigateToDownloads = () => {
  router.push('/downloads');
};

// 监听下载进度
onMounted(() => {
  if (!isDesktopRuntime || !window.desktop) return;

  // 监听下载进度
  window.desktop.on('music-download-progress', (_, data) => {
    const existingItem = downloadList.value.find((item) => item.filename === data.filename);

    // 如果进度为100%，将状态设置为已完成
    if (data.progress === 100) {
      data.status = 'completed';
    }

    if (existingItem) {
      Object.assign(existingItem, {
        ...data,
        songInfo: data.songInfo || existingItem.songInfo
      });

      // 如果下载完成，从列表中移除
      if (data.status === 'completed') {
        downloadList.value = downloadList.value.filter((item) => item.filename !== data.filename);
      }
    } else {
      downloadList.value.push({
        ...data,
        songInfo: data.songInfo
      });
    }
  });

  // 监听下载完成
  window.desktop.on('music-download-complete', async (_, data) => {
    if (data.success) {
      downloadList.value = downloadList.value.filter((item) => item.filename !== data.filename);
    } else {
      const existingItem = downloadList.value.find((item) => item.filename === data.filename);
      if (existingItem) {
        Object.assign(existingItem, {
          status: 'error',
          error: data.error,
          progress: 0
        });
        setTimeout(() => {
          downloadList.value = downloadList.value.filter((item) => item.filename !== data.filename);
        }, 3000);
      }
    }
  });

  // 监听下载队列
  window.desktop.on('music-download-queued', (_, data) => {
    const existingItem = downloadList.value.find((item) => item.filename === data.filename);
    if (!existingItem) {
      downloadList.value.push({
        filename: data.filename,
        progress: 0,
        loaded: 0,
        total: 0,
        path: '',
        status: 'downloading',
        songInfo: data.songInfo
      });
    }
  });
});
</script>

<style lang="scss" scoped>
.download-drawer-trigger {
  @apply fixed left-6 bottom-24 z-[999];

  .n-button {
    @apply text-neutral-600 dark:text-neutral-300;
    @apply w-10 h-10;
    border: 1px solid var(--qqm-border, rgba(20, 24, 31, 0.08));
    background: color-mix(in srgb, var(--qqm-surface, #fff) 88%, transparent);
    backdrop-filter: blur(12px) saturate(1.08);
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 28%, var(--qqm-border));
      background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface));
      color: var(--qqm-primary, #22c55e);
    }

    .iconfont {
      @apply text-xl;
    }
  }
}
</style>
