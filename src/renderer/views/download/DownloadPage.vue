<template>
  <div class="download-page h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="download-content pb-32">
        <!-- Page Header -->
        <section class="page-header page-padding-x pt-8 pb-5">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-primary">
                {{ t('download.title') }}
              </p>
              <h1
                class="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
              >
                {{
                  tabName === 'downloading'
                    ? t('download.tabs.downloading')
                    : t('download.tabs.downloaded')
                }}
              </h1>
              <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                {{
                  tabName === 'downloading'
                    ? t('download.progress.total', { progress: totalProgress.toFixed(1) })
                    : t('download.count', { count: downloadedList.length })
                }}
              </p>
            </div>
            <div
              class="download-header-icon hidden md:flex h-10 w-10 items-center justify-center rounded-lg text-primary"
            >
              <i class="ri-download-cloud-2-line text-xl" />
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky) -->
        <section class="action-bar sticky top-0 z-20 page-padding-x py-3">
          <div class="flex items-center justify-between gap-4">
            <!-- Tabs (Segment Control) -->
            <div class="download-tabs flex items-center gap-1 rounded-md p-1">
              <button
                v-for="tab in ['downloading', 'downloaded']"
                :key="tab"
                class="px-5 py-1.5 rounded-md text-sm font-medium transition-colors"
                :class="
                  tabName === tab
                    ? 'download-tab-active text-primary'
                    : 'text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-primary'
                "
                @click="tabName = tab"
              >
                {{ t(`download.tabs.${tab}`) }}
              </button>
            </div>

            <!-- Right Actions -->
            <div class="flex items-center gap-3">
              <button
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-neutral-500 hover:text-primary dark:hover:text-primary"
                @click="refreshDownloadedList"
                :disabled="isLoadingDownloaded"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': isLoadingDownloaded }"
                />
                <span class="hidden md:inline">刷新目录</span>
              </button>

              <button
                class="action-btn-icon w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400"
                @click="openDownloadPath"
              >
                <i class="ri-folder-open-line text-lg" />
              </button>

              <button
                class="action-btn-icon w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400"
                @click="showSettingsDrawer = true"
              >
                <i class="ri-settings-3-line text-lg" />
              </button>
            </div>
          </div>
        </section>

        <div class="page-padding-x py-3 flex items-center gap-3 text-sm text-neutral-500">
          <span class="flex-1 min-w-0 truncate" :title="downloadSettings.path"
            >下载目录：{{ downloadSettings.path }}</span
          >
          <button class="text-primary flex-shrink-0" @click="showSettingsDrawer = true">
            更改目录
          </button>
        </div>

        <!-- List Section -->
        <section class="list-section page-padding-x mt-4">
          <!-- Downloading List -->
          <div v-if="tabName === 'downloading'" class="downloading-container">
            <div v-if="downloadList.length === 0" class="empty-state py-20 text-center">
              <i
                class="ri-download-cloud-2-line text-5xl mb-4 text-neutral-200 dark:text-neutral-800"
              />
              <p class="text-neutral-400">{{ t('download.empty.noTasks') }}</p>
            </div>
            <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div
                v-for="item in downloadList"
                :key="item.downloadKey"
                class="downloading-item group p-3 rounded-lg"
              >
                <div class="flex items-center gap-4">
                  <n-image
                    :src="getImgUrl(item.songInfo?.picUrl, '100y100')"
                    class="w-12 h-12 rounded-lg flex-shrink-0"
                    preview-disabled
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                      <div class="truncate pr-4">
                        <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{
                          item.filename
                        }}</span>
                        <span class="ml-2 text-xs text-neutral-400">{{
                          item.songInfo?.ar?.map((a) => a.name).join(', ')
                        }}</span>
                      </div>
                      <span
                        class="text-xs font-medium"
                        :class="item.status === 'error' ? 'text-red-500' : 'text-primary'"
                      >
                        {{ getStatusText(item) }}
                      </span>
                    </div>
                    <div
                      class="download-progress-track relative h-1.5 rounded-full overflow-hidden"
                    >
                      <div
                        class="absolute inset-y-0 left-0 bg-primary transition-colors duration-200"
                        :class="{ 'bg-red-500': item.status === 'error' }"
                        :style="{ width: `${item.progress}%` }"
                      ></div>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                      <span class="text-[10px] text-neutral-400"
                        >{{ formatSize(item.loaded) }} / {{ formatSize(item.total) }}</span
                      >
                      <span class="text-[10px] text-neutral-400"
                        >{{ item.progress.toFixed(1) }}%</span
                      >
                    </div>
                    <p v-if="item.error" class="mt-2 text-xs text-neutral-500">{{ item.error }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Downloaded List -->
          <div v-else class="downloaded-container">
            <n-spin :show="isLoadingDownloaded">
              <div v-if="downloadedList.length === 0" class="empty-state py-20 text-center">
                <i
                  class="ri-inbox-archive-line text-5xl mb-4 text-neutral-200 dark:text-neutral-800"
                />
                <p class="text-neutral-400">{{ t('download.empty.noDownloaded') }}</p>
                <p class="text-xs text-neutral-500 mt-2">
                  {{ t('download.empty.noDownloadedHint') }}
                </p>
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="item in downList"
                  :key="item.path"
                  class="downloaded-item group p-3 rounded-lg flex items-center gap-4"
                >
                  <div class="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      :src="getImgUrl(item.picUrl, '100y100')"
                      class="w-full h-full object-cover"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                      @click="handlePlayMusic(item)"
                    >
                      <i class="ri-play-fill text-white text-xl" />
                    </div>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate"
                        >{{ item.displayName || item.filename }}</span
                      >
                      <span class="text-xs text-neutral-400 flex-shrink-0">{{
                        formatSize(item.size)
                      }}</span>
                    </div>
                    <div class="flex items-center gap-4 mt-1">
                      <span class="text-xs text-neutral-500 truncate max-w-[150px]">{{
                        item.ar?.map((a) => a.name).join(', ')
                      }}</span>
                      <div
                        class="download-path-chip hidden md:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md truncate"
                      >
                        <i class="ri-folder-line" />
                        <span class="truncate">{{ shortenPath(item.path) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      class="download-icon-button w-8 h-8 rounded-lg text-neutral-400"
                      title="播放并搜索或替换歌词"
                      @click="openSongLyrics(item)"
                    >
                      <i class="ri-file-list-3-line" />
                    </button>
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <button
                          class="download-icon-button w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 transition-colors"
                          @click="copyPath(item.path)"
                        >
                          <i class="ri-file-copy-line" />
                        </button>
                      </template>
                      {{ t('download.path.copy') || '复制路径' }}
                    </n-tooltip>
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <button
                          class="download-icon-button w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 transition-colors"
                          @click="openDirectory(item.path)"
                        >
                          <i class="ri-folder-open-line" />
                        </button>
                      </template>
                      {{ t('download.settingsPanel.open') }}
                    </n-tooltip>
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <button
                          class="delete-action w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 transition-colors"
                          @click="handleDelete(item)"
                        >
                          <i class="ri-delete-bin-line" />
                        </button>
                      </template>
                      {{ t('common.delete') }}
                    </n-tooltip>
                  </div>
                </div>
              </div>
            </n-spin>
          </div>
        </section>
      </div>
    </n-scrollbar>

    <!-- 删除确认对话框 -->
    <n-modal
      v-model:show="showDeleteConfirm"
      preset="dialog"
      type="warning"
      :title="t('download.delete.title')"
      :content="
        t('download.delete.message', {
          filename: itemToDelete?.displayName || itemToDelete?.filename
        })
      "
      :positive-text="t('download.delete.confirm')"
      :negative-text="t('download.delete.cancel')"
      @positive-click="confirmDelete"
    />

    <!-- 下载设置抽屉 -->
    <n-drawer
      v-model:show="showSettingsDrawer"
      :width="400"
      placement="right"
      :style="{ top: '40px' }"
    >
      <n-drawer-content :title="t('download.settingsPanel.title')" closable>
        <div class="download-settings-content space-y-8 py-4">
          <!-- Path Section -->
          <div class="setting-group">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {{ t('download.settingsPanel.path') }}
            </h3>
            <p class="text-xs text-neutral-500 mb-4">{{ t('download.settingsPanel.pathDesc') }}</p>
            <div class="space-y-3">
              <n-input
                :value="downloadSettings.path"
                readonly
                placeholder="选择音乐下载目录"
                class="download-setting-input"
              />
              <div class="flex gap-2">
                <n-button class="flex-1" @click="selectDownloadPath">{{
                  t('download.settingsPanel.select')
                }}</n-button>
                <n-button class="flex-1" @click="openDownloadPath">{{
                  t('download.settingsPanel.open')
                }}</n-button>
              </div>
            </div>
          </div>

          <!-- Save Lyric File -->
          <div class="setting-group">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {{ t('download.settingsPanel.saveLyric') }}
                </h3>
                <p class="text-xs text-neutral-500 mt-1">
                  {{ t('download.settingsPanel.saveLyricDesc') }}
                </p>
              </div>
              <n-switch v-model:value="downloadSettings.saveLyric" />
            </div>
          </div>

          <!-- Format Section -->
          <div class="setting-group">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {{ t('download.settingsPanel.fileFormat') }}
            </h3>
            <p class="text-xs text-neutral-500 mb-4">
              {{ t('download.settingsPanel.fileFormatDesc') }}
            </p>

            <div class="space-y-4">
              <div class="flex flex-wrap gap-2">
                <n-button
                  v-for="preset in [
                    { label: 'songArtist', value: '{songName} - {artistName}' },
                    { label: 'artistSong', value: '{artistName} - {songName}' },
                    { label: 'songOnly', value: '{songName}' }
                  ]"
                  :key="preset.label"
                  size="small"
                  :type="downloadSettings.nameFormat === preset.value ? 'primary' : 'default'"
                  @click="downloadSettings.nameFormat = preset.value"
                >
                  {{ t(`download.settingsPanel.presets.${preset.label}`) }}
                </n-button>
              </div>

              <div>
                <p class="text-[10px] text-neutral-400 mb-2 uppercase font-bold">
                  {{ t('download.settingsPanel.separator') }}
                </p>
                <div class="flex items-center gap-2">
                  <n-button
                    v-for="sep in [' - ', '_', ' ']"
                    :key="sep"
                    size="small"
                    :type="downloadSettings.separator === sep ? 'primary' : 'default'"
                    @click="downloadSettings.separator = sep"
                  >
                    {{ sep === ' ' ? '空格' : sep }}
                  </n-button>
                  <n-input
                    v-model:value="downloadSettings.separator"
                    placeholder="分隔符"
                    size="small"
                    class="download-setting-input w-20"
                  />
                </div>
              </div>

              <div>
                <p class="text-[10px] text-neutral-400 mb-2 uppercase font-bold">
                  {{ t('download.settingsPanel.dragToArrange') }}
                </p>
                <div class="space-y-2">
                  <div
                    v-for="(comp, idx) in formatComponents"
                    :key="comp.id"
                    class="format-component-row flex items-center justify-between p-2 rounded-lg"
                  >
                    <span class="text-xs">{{
                      t(`download.settingsPanel.components.${comp.type}`)
                    }}</span>
                    <div class="flex items-center gap-1">
                      <n-button
                        quaternary
                        circle
                        size="tiny"
                        :disabled="idx === 0"
                        @click="handleMoveUp(idx)"
                        ><i class="ri-arrow-up-s-line"
                      /></n-button>
                      <n-button
                        quaternary
                        circle
                        size="tiny"
                        :disabled="idx === formatComponents.length - 1"
                        @click="handleMoveDown(idx)"
                        ><i class="ri-arrow-down-s-line"
                      /></n-button>
                      <n-button
                        quaternary
                        circle
                        size="tiny"
                        :disabled="formatComponents.length <= 1"
                        @click="removeFormatComponent(idx)"
                        ><i class="ri-close-line"
                      /></n-button>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <n-button
                      v-for="type in ['songName', 'artistName', 'albumName']"
                      :key="type"
                      size="tiny"
                      :disabled="formatComponents.some((c) => c.type === type)"
                      @click="addFormatComponent(type)"
                    >
                      + {{ t(`download.settingsPanel.components.${type}`) }}
                    </n-button>
                  </div>
                </div>
              </div>

              <div class="download-preview-card p-3 rounded-lg">
                <p class="text-[10px] text-neutral-400 mb-1 uppercase font-bold">
                  {{ t('download.settingsPanel.preview') }}
                </p>
                <p class="text-sm font-medium text-primary truncate">{{ formatNamePreview }}</p>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="saveDownloadSettings">{{
            t('common.save')
          }}</n-button>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import type { LocalMusicEntry } from '@/types/localMusic';
import { getImgUrl } from '@/utils';
import { toSongResult } from '@/utils/localMusicUtils';

const { t } = useI18n();
const playerStore = usePlayerStore();
const message = useMessage();
const settingsStore = useSettingsStore();

interface DownloadItem {
  stage?: string;
  downloadKey: string;
  filename: string;
  progress: number;
  loaded: number;
  total: number;
  path: string;
  status: 'downloading' | 'completed' | 'error';
  error?: string;
  songInfo?: any;
}

interface DownloadedItem extends LocalMusicEntry {
  filename: string;
  path: string;
  size: number;
  id: string;
  picUrl: string;
  ar: { name: string }[];
  displayName?: string;
}
const tabName = ref('downloading');

const downloadList = ref<DownloadItem[]>([]);
const downloadedList = ref<DownloadedItem[]>([]);

const downList = computed(() => downloadedList.value);

// 计算总进度
const totalProgress = computed(() => {
  if (downloadList.value.length === 0) return 0;
  const total = downloadList.value.reduce((sum, item) => sum + item.progress, 0);
  return total / downloadList.value.length;
});

watch(totalProgress, (newVal) => {
  if (newVal === 100) {
    refreshDownloadedList();
  }
});

// 获取状态文本
const getStatusText = (item: DownloadItem) => {
  if (item.status !== 'error' && item.stage === 'resolving') return '正在获取下载地址';
  if (item.status !== 'error' && item.stage === 'lyrics') return '正在保存歌词';
  switch (item.status) {
    case 'downloading':
      return t('download.status.downloading');
    case 'completed':
      return t('download.status.completed');
    case 'error':
      return t('download.status.failed');
    default:
      return t('download.status.unknown');
  }
};

// 格式化文件大小
const formatSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
};

// 复制文件路径
const copyPath = (path: string) => {
  navigator.clipboard
    .writeText(path)
    .then(() => {
      message.success(t('download.path.copied'));
    })
    .catch((err) => {
      console.error('复制失败:', err);
      message.error(t('download.path.copyFailed'));
    });
};

// 格式化路径
const shortenPath = (path: string) => {
  if (!path) return '';

  // 获取文件名和目录
  const parts = path.split(/[/\\]/);
  const fileName = parts.pop() || '';

  // 如果路径很短，直接返回
  if (path.length < 30) return path;

  // 保留开头的部分目录和结尾的文件名
  if (parts.length <= 2) return path;

  const start = parts.slice(0, 1).join('/');
  const end = parts.slice(-1).join('/');

  return `${start}/.../${end}/${fileName}`;
};

const openDirectory = (path: string) => {
  const directory = path.replace(/[\\/][^\\/]+$/, '');
  window.desktop.send('open-directory', directory);
};

const handlePlayMusic = async (item: DownloadedItem) => {
  try {
    if (!(await window.desktop.invoke('check-file-exists', item.path))) {
      message.warning('音乐文件已移动，请刷新目录');
      return false;
    }
    const songs = downloadedList.value.map(toSongResult);
    playerStore.setPlayList(songs);
    return await playerStore.setPlay(toSongResult(item));
  } catch (error) {
    message.warning(`暂时无法播放：${String(error)}`);
    return false;
  }
};

const openSongLyrics = async (item: DownloadedItem) => {
  if (playerStore.playMusic.localFilePath !== item.path) await handlePlayMusic(item);
  playerStore.setMusicFull(true);
};

// 删除相关
const showDeleteConfirm = ref(false);
const itemToDelete = ref<DownloadedItem | null>(null);

// 处理删除点击
const handleDelete = (item: DownloadedItem) => {
  itemToDelete.value = item;
  showDeleteConfirm.value = true;
};

// 确认删除
const confirmDelete = async () => {
  const item = itemToDelete.value;
  if (!item) return;

  try {
    const success = await window.desktop.invoke('delete-downloaded-music', item.path);

    if (success) {
      const newList = downloadedList.value.filter((i) => i.id !== item.id);
      downloadedList.value = newList;
      localStorage.setItem('downloadedList', JSON.stringify(newList));
      message.success(t('download.delete.success'));
    } else {
      message.warning(t('download.delete.fileNotFound'));
    }
  } catch (error) {
    console.error('Failed to delete music:', error);
    message.warning(t('download.delete.recordRemoved'));
  } finally {
    showDeleteConfirm.value = false;
    itemToDelete.value = null;
  }
};

// 添加加载状态
const isLoadingDownloaded = ref(false);
let needsRefresh = false;

// 格式化歌曲名称，应用用户设置的格式
const formatSongName = (songInfo) => {
  if (!songInfo) return '';

  // 获取格式设置
  const nameFormat = downloadSettings.value.nameFormat || '{songName} - {artistName}';

  // 准备替换变量
  const artistName = songInfo.ar?.map((a) => a.name).join('/') || '未知艺术家';
  const songName = songInfo.name || songInfo.filename || '未知歌曲';
  const albumName = songInfo.al?.name || '未知专辑';

  // 应用自定义格式
  return nameFormat
    .replace(/\{songName\}/g, songName)
    .replace(/\{artistName\}/g, artistName)
    .replace(/\{albumName\}/g, albumName);
};

// 获取已下载音乐列表
const refreshDownloadedList = async () => {
  if (isLoadingDownloaded.value) {
    needsRefresh = true;
    return;
  }
  isLoadingDownloaded.value = true;
  try {
    downloadSettings.value.path = await window.desktop.invoke('get-downloads-path');
    const list = await window.desktop.invoke('get-downloaded-music');
    downloadedList.value = list.map((item: DownloadedItem) => ({
      ...item,
      displayName: formatSongName(item) || item.filename
    }));
  } catch (error) {
    message.warning(`目录暂时无法读取，请检查路径：${String(error)}`);
  } finally {
    isLoadingDownloaded.value = false;
    if (needsRefresh) {
      needsRefresh = false;
      scheduleRefresh();
    }
  }
};

const removers: Array<() => void> = [];
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleRefresh = () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void refreshDownloadedList(), 400);
};
const syncDownloadTasks = async () => {
  downloadList.value = await window.desktop.invoke('get-download-tasks');
};
watch(tabName, (tab) => {
  if (tab === 'downloaded') void refreshDownloadedList();
});
onMounted(() => {
  void syncDownloadTasks();
  for (const event of [
    'music-download-error',
    'music-download-queued',
    'music-download-progress',
    'music-download-complete'
  ]) {
    removers.push(window.desktop.on(event, syncDownloadTasks));
  }
  removers.push(window.desktop.on('music-library-changed', scheduleRefresh));
  window.addEventListener('focus', scheduleRefresh);
});
onActivated(scheduleRefresh);
onUnmounted(() => {
  clearTimeout(refreshTimer);
  removers.forEach((remove) => remove());
  window.removeEventListener('focus', scheduleRefresh);
});

// 下载设置
const showSettingsDrawer = ref(false);
const downloadSettings = ref({
  path: '',
  nameFormat: '{songName} - {artistName}',
  separator: ' - ',
  saveLyric: true
});

// 格式组件（用于拖拽排序）
const formatComponents = ref([
  { id: 1, type: 'songName' },
  { id: 2, type: 'artistName' }
]);

// 处理组件排序
const handleMoveUp = (index: number) => {
  if (index > 0) {
    const temp = formatComponents.value.splice(index, 1)[0];
    formatComponents.value.splice(index - 1, 0, temp);
  }
};

const handleMoveDown = (index: number) => {
  if (index < formatComponents.value.length - 1) {
    const temp = formatComponents.value.splice(index, 1)[0];
    formatComponents.value.splice(index + 1, 0, temp);
  }
};

// 添加新的格式组件
const addFormatComponent = (type: string) => {
  if (!formatComponents.value.some((item) => item.type === type)) {
    formatComponents.value.push({
      id: Date.now(),
      type
    });
  }
};

// 删除格式组件
const removeFormatComponent = (index: number) => {
  formatComponents.value.splice(index, 1);
};

// 监听组件变化更新格式
watch(
  formatComponents,
  (newComponents) => {
    let format = '';
    newComponents.forEach((component, index) => {
      format += `{${component.type}}`;
      if (index < newComponents.length - 1) {
        format += downloadSettings.value.separator;
      }
    });
    downloadSettings.value.nameFormat = format;
  },
  { deep: true }
);

// 监听分隔符变化更新格式
watch(
  () => downloadSettings.value.separator,
  (newSeparator) => {
    if (formatComponents.value.length > 1) {
      // 重新构建格式字符串
      let format = '';
      formatComponents.value.forEach((component, index) => {
        format += `{${component.type}}`;
        if (index < formatComponents.value.length - 1) {
          format += newSeparator;
        }
      });
      downloadSettings.value.nameFormat = format;
    }
  }
);

// 格式名称预览
const formatNamePreview = computed(() => {
  const format = downloadSettings.value.nameFormat;
  return format
    .replace(/\{songName\}/g, '莫失莫忘')
    .replace(/\{artistName\}/g, '香蜜沉沉烬如霜')
    .replace(/\{albumName\}/g, '电视剧原声带');
});

// 选择下载路径
const selectDownloadPath = async () => {
  const result = await window.desktop.invoke('select-directory');
  if (result && !result.canceled && result.filePaths.length > 0) {
    downloadSettings.value.path = result.filePaths[0];
  }
};

// 打开下载路径
const openDownloadPath = () => {
  if (downloadSettings.value.path) {
    window.desktop.send('open-directory', downloadSettings.value.path);
  } else {
    message.warning(t('download.settingsPanel.noPathSelected'));
  }
};

// 保存下载设置
const saveDownloadSettings = async () => {
  try {
    const changes = {
      downloadPath: downloadSettings.value.path,
      downloadNameFormat: downloadSettings.value.nameFormat,
      downloadSeparator: downloadSettings.value.separator,
      downloadSaveLyric: downloadSettings.value.saveLyric
    };
    const nextSettings = { ...settingsStore.setData, ...changes };
    await window.desktop.invoke('set-store-value', 'set', nextSettings);
    settingsStore.setData = nextSettings;
    showSettingsDrawer.value = false;
    await refreshDownloadedList();
    message.success('下载设置已保存，目录已自动刷新');
  } catch (error) {
    message.warning(`设置暂未保存，请重试：${String(error)}`);
  }
};

// 初始化下载设置
const initDownloadSettings = async () => {
  // 获取当前配置
  const path = await window.desktop.invoke('get-store-value', 'set.downloadPath');
  const nameFormat = await window.desktop.invoke('get-store-value', 'set.downloadNameFormat');
  const separator = await window.desktop.invoke('get-store-value', 'set.downloadSeparator');
  const saveLyric = await window.desktop.invoke('get-store-value', 'set.downloadSaveLyric');

  downloadSettings.value = {
    path: path || (await window.desktop.invoke('get-downloads-path')),
    nameFormat: nameFormat || '{songName} - {artistName}',
    separator: separator || ' - ',
    saveLyric: saveLyric !== false
  };

  // 初始化排序组件
  updateFormatComponents();
};

// 根据格式更新组件
const updateFormatComponents = () => {
  // 提取格式中的变量
  const format = downloadSettings.value.nameFormat;
  const matches = Array.from(format.matchAll(/\{(\w+)\}/g));

  if (matches.length === 0) {
    formatComponents.value = [
      { id: 1, type: 'songName' },
      { id: 2, type: 'artistName' }
    ];
    return;
  }

  formatComponents.value = matches.map((match, index) => ({
    id: index + 1,
    type: match[1]
  }));
};

// 监听格式变化更新组件
watch(() => downloadSettings.value.nameFormat, updateFormatComponents);

// 监听命名格式变化，更新已下载文件的显示名称
watch(
  () => downloadSettings.value.nameFormat,
  () => {
    if (downloadedList.value.length > 0) {
      // 更新所有已下载项的显示名称
      downloadedList.value = downloadedList.value.map((item) => ({
        ...item,
        displayName: formatSongName(item) || item.filename
      }));

      // 保存到本地存储
      localStorage.setItem('downloadedList', JSON.stringify(downloadedList.value));
    }
  }
);

// 初始化
onMounted(() => {
  void initDownloadSettings().then(refreshDownloadedList);
});
</script>

<style lang="scss" scoped>
.download-page {
  position: relative;
  background: var(--qqm-bg, #f7f8fa);
}

.hero-section {
  min-height: 220px;
  border-bottom: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  background: var(--qqm-bg);
}

.action-bar {
  border-bottom: 1px solid var(--qqm-border);
  background: color-mix(in srgb, var(--qqm-bg) 96%, transparent);
}

.list-section {
  border-top: 1px solid var(--qqm-border);
  background: var(--qqm-bg, #f7f8fa);
}

.empty-state {
  min-height: 232px;
  border: 1px dashed color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 3%, var(--qqm-bg));
}

.download-tabs {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface, #ffffff);
}

.download-path-chip {
  border: 1px solid var(--qqm-border);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, var(--qqm-surface));
  color: var(--qqm-text-secondary, #737373);
}

.delete-action:hover {
  color: var(--qqm-danger, #ef4444);
  background: color-mix(in srgb, var(--qqm-danger, #ef4444) 8%, transparent);
}

.download-setting-input :deep(.n-input-wrapper) {
  border: 1px solid var(--qqm-border);
  border-radius: 10px;
  background: var(--qqm-surface);
}

.format-component-row,
.download-preview-card {
  border: 1px solid var(--qqm-border);
  border-radius: 10px;
  background: var(--qqm-surface);
}

.download-preview-card {
  border-style: dashed;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, var(--qqm-surface));
}

.action-btn-pill {
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 30%, var(--qqm-border));
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
  }
}

.action-btn-icon {
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
  &:hover {
    color: var(--qqm-primary, #22c55e);
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 28%, var(--qqm-border));
    background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface));
  }
}

.downloading-item,
.downloaded-item {
  border-bottom: 1px solid var(--qqm-border);
  background: var(--qqm-surface, #ffffff);
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, var(--qqm-border));
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
  }
}

.download-progress-track {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 10%, var(--qqm-border));
}

.download-header-icon,
.download-tab-active {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.download-icon-button:hover {
  color: var(--qqm-primary, #22c55e);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}
</style>
