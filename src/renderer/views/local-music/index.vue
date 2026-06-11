<template>
  <div class="local-music-page h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="local-music-content pb-32">
        <!-- Page Header -->
        <section class="page-header page-padding-x pt-8 pb-5">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-primary">
                {{ t('localMusic.title') }}
              </p>
              <h1
                class="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
              >
                {{ t('localMusic.title') }}
              </h1>
              <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
              </p>
            </div>
            <div
              class="local-header-icon hidden md:flex h-10 w-10 items-center justify-center rounded-lg text-primary"
            >
              <i class="ri-folder-music-line text-xl" />
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky) -->
        <section class="action-bar local-action-bar sticky top-0 z-20 page-padding-x py-3">
          <div class="flex items-center justify-between gap-3">
            <!-- 左侧：搜索框 -->
            <div class="flex-1 max-w-sm">
              <n-input
                v-model:value="searchKeyword"
                :placeholder="t('localMusic.search')"
                clearable
                size="small"
                round
              >
                <template #prefix>
                  <i class="ri-search-line text-neutral-400" />
                </template>
              </n-input>
            </div>

            <!-- 右侧：操作按钮 -->
            <div class="flex items-center gap-2.5">
              <!-- 播放全部按钮 -->
              <button
                v-if="filteredList.length > 0"
                class="qqm-primary-button flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors text-white"
                @click="handlePlayAll"
              >
                <i class="ri-play-fill text-lg" />
                <span class="hidden md:inline">{{ t('localMusic.playAll') }}</span>
              </button>

              <!-- 扫描按钮 -->
              <button
                class="action-btn-icon local-action-btn w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />
              </button>

              <!-- 添加文件夹按钮 -->
              <button
                class="action-btn-icon local-action-btn w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line text-lg" />
              </button>

              <!-- 文件夹管理按钮 -->
              <button
                v-if="localMusicStore.folderPaths.length > 0"
                class="action-btn-icon local-action-btn w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400"
                @click="showFolderManager = true"
              >
                <i class="ri-folder-settings-line text-lg" />
              </button>
            </div>
          </div>
        </section>

        <!-- 扫描进度提示 -->
        <section v-if="localMusicStore.scanning" class="page-padding-x mt-6">
          <div class="local-scan-panel flex items-center gap-4 p-4 rounded-lg">
            <n-spin size="small" />
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {{ t('localMusic.scanning') }}
              </p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
              </p>
            </div>
          </div>
        </section>

        <!-- 歌曲列表 -->
        <section class="list-section page-padding-x mt-4">
          <!-- 空状态 -->
          <div
            v-if="!localMusicStore.scanning && filteredList.length === 0"
            class="empty-state py-16 text-center"
          >
            <i class="ri-folder-music-fill text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">{{ t('localMusic.emptyState') }}</p>
            <button
              class="qqm-primary-button mt-6 px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              @click="handleAddFolder"
            >
              <i class="ri-folder-add-line mr-2" />
              {{ t('localMusic.scanFolder') }}
            </button>
          </div>

          <!-- 虚拟列表 -->
          <div v-else-if="filteredList.length > 0" class="song-list-container">
            <n-virtual-list
              class="song-virtual-list"
              style="max-height: calc(100vh - 260px)"
              :items="filteredSongResults"
              :item-size="70"
              item-resizable
              key-field="id"
            >
              <template #default="{ item, index }">
                <div>
                  <song-item :index="index" :item="item" @play="handlePlaySong" />
                  <!-- 列表末尾留白 -->
                  <div v-if="index === filteredSongResults.length - 1" class="h-36"></div>
                </div>
              </template>
            </n-virtual-list>
          </div>
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
              <i class="ri-folder-line text-lg text-primary flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                folder
              }}</span>
            </div>
            <button
              class="local-remove-button w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 transition-colors flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <!-- 空文件夹列表 -->
          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800" />
            <p class="text-sm text-neutral-400 mt-2">{{ t('localMusic.emptyState') }}</p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            {{ t('localMusic.scanFolder') }}
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import SongItem from '@/components/common/SongItem.vue';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { filterByKeyword, toSongResult } from '@/utils/localMusicUtils';

// ==================== Stores ====================
const { t } = useI18n();
const { message } = createDiscreteApi(['message']);
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();

// ==================== State ====================
/** 搜索关键词 */
const searchKeyword = ref('');
/** 文件夹管理抽屉是否显示 */
const showFolderManager = ref(false);

// ==================== Computed ====================
/** 根据搜索关键词过滤后的本地音乐列表 */
const filteredList = computed(() => {
  return filterByKeyword(localMusicStore.musicList, searchKeyword.value);
});

/** 将过滤后的列表转换为 SongResult[] 供 SongItem 使用 */
const filteredSongResults = computed(() => {
  return filteredList.value.map(toSongResult);
});

// ==================== Methods ====================

/**
 * 选择并添加文件夹
 * 调用系统文件夹选择对话框
 * dialog.showOpenDialog 返回 { canceled: boolean, filePaths: string[] }
 */
async function handleAddFolder(): Promise<void> {
  try {
    const result = await window.electron.ipcRenderer.invoke('select-directory');
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
  if (localMusicStore.folderPaths.length === 0) {
    // 没有配置文件夹时，引导用户先添加文件夹
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
}

/**
 * 播放单曲
 * SongItem 内部已通过 playMusicEvent 调用 playerStore.setPlay 触发播放
 * 此处只需设置播放列表上下文，确保上下一首切换正常
 * @param song SongItem 组件 emit 的 SongResult 对象
 */
async function handlePlaySong(_song: SongResult): Promise<void> {
  try {
    // 设置播放列表上下文，确保上下一首切换正常
    playerStore.setPlayList(filteredSongResults.value);
  } catch (error) {
    console.error('播放本地音乐失败:', error);
  }
}

/**
 * 播放全部
 * 将完整列表转换为 SongResult[] 后设置为播放列表并从第一首开始播放
 */
async function handlePlayAll(): Promise<void> {
  if (filteredSongResults.value.length === 0) return;

  try {
    const firstSong = filteredSongResults.value[0];
    const entry = filteredList.value[0];

    // 检查第一首歌文件是否存在
    const exists = await window.electron.ipcRenderer.invoke('check-file-exists', entry.filePath);
    if (!exists) {
      message.error(t('localMusic.fileNotFound'));
      return;
    }

    // 设置播放列表并播放第一首
    playerStore.setPlayList(filteredSongResults.value);
    await playerStore.setPlay(firstSong);
  } catch (error) {
    console.error('播放全部失败:', error);
  }
}

// ==================== Lifecycle ====================
onMounted(async () => {
  // 进入页面时从 IndexedDB 缓存加载音乐列表
  await localMusicStore.loadFromCache();
});
</script>

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
</style>
