<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import MusicTrackList from '@/components/common/music-list/MusicTrackList.vue';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { toSongResult } from '@/utils/localMusicUtils';

// ==================== Stores ====================
const { t } = useI18n();
const { message } = createDiscreteApi(['message']);
const localMusicStore = useLocalMusicStore();

// ==================== State ====================
/** 文件夹管理抽屉是否显示 */
const showFolderManager = ref(false);

// ==================== Computed ====================
const songResults = computed(() => localMusicStore.musicList.map(toSongResult));

// ==================== Methods ====================

/**
 * 选择并添加文件夹
 * 调用系统文件夹选择对话框
 * dialog.showOpenDialog 返回 { canceled: boolean, filePaths: string[] }
 */
async function handleAddFolder(): Promise<void> {
  try {
    const result = await window.desktop.invoke('select-directory');
    if (result && !result.canceled && result.filePaths?.length > 0) {
      localMusicStore.addFolder(result.filePaths[0]);
      // 添加文件夹后自动触发扫描
      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    message.error(String(error));
  }
}

/**
 * 移除文件夹
 * @param folder 要移除的文件夹路径
 */
function handleRemoveFolder(folder: string): void {
  localMusicStore.removeFolder(folder);
}

/**
 * 触发扫描
 */
async function handleScan(): Promise<void> {
  if (localMusicStore.scanPaths.length === 0) {
    // 没有配置文件夹时，引导用户先添加文件夹
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
}

// ==================== Lifecycle ====================
onMounted(async () => {
  // 进入页面时从 IndexedDB 缓存加载音乐列表
  await localMusicStore.initialize();
});
</script>

<template>
  <div class="local-music-page h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="local-music-content pb-24">
        <!-- Page Header -->
        <section class="page-header page-padding-x pt-8 pb-5">
          <div class="flex items-end justify-between gap-4">
            <div>
              <h1
                class="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
              >
                {{ t('localMusic.title') }}
              </h1>
              <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
              </p>
              <p class="mt-2 text-xs text-neutral-500 break-all">
                下载目录自动收录：{{ localMusicStore.downloadFolder }}
              </p>
            </div>
            <div
              class="local-header-icon hidden md:flex h-10 w-10 items-center justify-center rounded-lg text-primary"
            >
              <i aria-hidden="true" class="ri-folder-music-line text-xl" />
            </div>
          </div>
        </section>

        <section class="page-padding-x">
          <music-track-list
            scrollable
            class="local-tracks"
            :songs="songResults"
            kind="local"
            :loading="localMusicStore.scanning && !songResults.length"
          >
            <template #actions>
              <button
                class="music-list-button"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  aria-hidden="true"
                  class="ri-refresh-line"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />{{ localMusicStore.scanning ? t('localMusic.scanning') : '重新扫描' }}
              </button>
              <button class="music-list-button" @click="handleAddFolder">
                <i aria-hidden="true" class="ri-folder-add-line" />添加文件夹
              </button>
              <button
                v-if="localMusicStore.folderPaths.length"
                class="music-list-icon"
                title="管理音乐文件夹"
                aria-label="管理音乐文件夹"
                @click="showFolderManager = true"
              >
                <i aria-hidden="true" class="ri-folder-settings-line" />
              </button>
            </template>
            <template #notice
              ><p v-if="localMusicStore.scanning" class="local-scan-status" role="status">
                {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
              </p></template
            >
            <template #empty-action
              ><button class="music-list-button" @click="handleAddFolder">
                <i aria-hidden="true" class="ri-folder-add-line" />{{ t('localMusic.scanFolder') }}
              </button></template
            >
          </music-track-list>
        </section>
      </div>
    </n-scrollbar>

    <!-- 文件夹管理抽屉 -->
    <n-drawer v-model:show="showFolderManager" :width="400" placement="right">
      <n-drawer-content :title="t('localMusic.removeFolder')" closable>
        <div class="space-y-3 py-4">
          <div
            v-for="folder in localMusicStore.folderPaths"
            :key="folder"
            class="local-folder-row flex items-center justify-between p-3 rounded-lg"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <i aria-hidden="true" class="ri-folder-line text-lg text-primary flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                folder
              }}</span>
            </div>
            <button
              class="local-remove-button w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 transition-colors flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i aria-hidden="true" class="ri-delete-bin-line" />
            </button>
          </div>

          <!-- 空文件夹列表 -->
          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i
              aria-hidden="true"
              class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800"
            />
            <p class="text-sm text-neutral-400 mt-2">{{ t('localMusic.emptyState') }}</p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i aria-hidden="true" class="ri-folder-add-line" />
            </template>
            {{ t('localMusic.scanFolder') }}
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
/* 虚拟列表样式 */
.song-virtual-list {
  @apply w-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll) {
  scrollbar-width: thin;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar {
  width: 6px;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-thumb {
  @apply bg-neutral-300 dark:bg-neutral-700 rounded-lg;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-track {
  @apply bg-transparent;
}

:deep(.n-drawer-content) {
  border-left: 1px solid var(--qqm-border, rgba(20, 24, 31, 0.08));
  box-shadow: none;
}

.local-action-bar {
  border-bottom: 1px solid var(--qqm-border);
  background: color-mix(in srgb, var(--qqm-bg) 96%, transparent);
}

.list-section {
  border-top: 1px solid var(--qqm-border);
}

.empty-state {
  min-height: 232px;
  border: 1px dashed color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 3%, var(--qqm-bg));
}

.local-action-btn,
.local-folder-row {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.local-action-btn:hover,
.local-folder-row:hover {
  color: var(--qqm-primary, #22c55e);
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}

.local-music-page {
  background: var(--qqm-bg, #f7f8fa);
}

.local-header-icon,
.local-scan-panel {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.qqm-primary-button {
  background: var(--qqm-primary, #22c55e);
}

.qqm-primary-button:hover:not(:disabled) {
  background: var(--qqm-primary-strong, #16a34a);
}

.local-remove-button:hover {
  color: var(--qqm-primary, #22c55e);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface));
}
.local-scan-status {
  font-size: 12px;
  color: var(--qqm-muted);
  padding-bottom: 12px;
}
.local-tracks {
  height: calc(100vh - 280px);
  min-height: 300px;
}
</style>
