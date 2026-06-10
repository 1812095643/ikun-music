<template>
  <responsive-modal
    v-model="visible"
    :title="t('settings.playback.musicSources')"
    @close="handleCancel"
  >
    <div class="flex flex-col h-full">
      <!-- Tabs Header -->
      <div class="music-source-tabs flex p-0.5 mb-3 rounded-lg shrink-0">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex-1 py-1 text-xs font-medium rounded-md transition-colors duration-200"
          :class="[
            activeTab === tab.key
              ? 'music-source-tab-active text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary'
          ]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="h-[400px] relative shrink-0">
        <Transition name="fade" mode="out-in">
          <div :key="activeTab" class="h-full overflow-y-auto overscroll-contain">
            <!-- Sources Tab -->
            <div v-if="activeTab === 'sources'" class="space-y-3 pb-2">
              <p class="text-xs text-neutral-500 dark:text-neutral-400 px-1">
                {{ t('settings.playback.musicSourcesDesc') }}
              </p>

              <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div
                  v-for="source in allSources"
                  :key="source.key"
                  class="group relative flex items-center p-2.5 rounded-lg border transition-colors duration-200 cursor-pointer"
                  :class="[
                    isSourceSelected(source.key) ? 'music-source-selected' : 'music-source-card',
                    { 'opacity-60 cursor-not-allowed': !source.available }
                  ]"
                  @click="toggleSource(source.key)"
                >
                  <div
                    class="flex items-center justify-center w-8 h-8 rounded-lg mr-2.5 transition-colors shrink-0"
                    :style="{
                      backgroundColor: isSourceSelected(source.key) ? source.color : 'transparent',
                      color: isSourceSelected(source.key) ? '#fff' : source.color
                    }"
                    :class="{ 'music-source-check-idle': !isSourceSelected(source.key) }"
                  >
                    <i :class="source.icon" class="text-base"></i>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span
                        class="font-semibold text-neutral-900 dark:text-neutral-100 text-sm truncate"
                        >{{ source.key }}</span
                      >
                      <div
                        class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ml-1"
                        :class="[
                          isSourceSelected(source.key)
                            ? 'bg-primary border-primary'
                            : 'border-neutral-300 dark:border-neutral-700'
                        ]"
                      >
                        <i
                          v-if="isSourceSelected(source.key)"
                          class="ri-check-line text-white text-[10px]"
                        ></i>
                      </div>
                    </div>
                    <!-- lxMusic 子描述 -->
                    <p
                      v-if="source.key === 'lxMusic'"
                      class="text-[10px] text-neutral-500 mt-0.5 truncate"
                    >
                      {{
                        activeLxApiId && lxMusicScriptInfo
                          ? lxMusicScriptInfo.name
                          : t('settings.playback.lxMusic.scripts.notConfigured')
                      }}
                    </p>
                    <!-- custom 子描述 -->
                    <p
                      v-else-if="source.key === 'custom'"
                      class="text-[10px] text-neutral-500 mt-0.5 truncate"
                    >
                      {{
                        settingsStore.setData.customApiPlugin
                          ? t('settings.playback.customApi.status.imported')
                          : t('settings.playback.customApi.status.notImported')
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- LX Music Management Tab -->
            <div v-else-if="activeTab === 'lxMusic'" class="space-y-3 pb-2">
              <div class="flex justify-between items-center mb-1">
                <h3 class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {{ t('settings.playback.lxMusic.scripts.title') }}
                </h3>
                <button
                  @click="importLxMusicScript"
                  class="flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <i class="ri-upload-line"></i>
                  {{ t('settings.playback.lxMusic.scripts.importLocal') }}
                </button>
              </div>

              <!-- Script List -->
              <div v-if="lxMusicApis.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div
                  v-for="api in lxMusicApis"
                  :key="api.id"
                  class="flex items-center p-2.5 rounded-lg border transition-colors duration-200"
                  :class="[
                    activeLxApiId === api.id ? 'music-source-selected' : 'music-source-card'
                  ]"
                >
                  <div class="relative flex items-center justify-center w-4 h-4 mr-3">
                    <input
                      type="radio"
                      :checked="activeLxApiId === api.id"
                      class="peer appearance-none w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-700 checked:border-primary checked:bg-primary transition-colors cursor-pointer"
                      @change="setActiveLxApi(api.id)"
                    />
                    <i
                      class="ri-check-line absolute text-white text-[10px] pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
                    ></i>
                  </div>

                  <div class="flex-1 min-w-0 mr-2">
                    <div class="flex items-center gap-2">
                      <span
                        v-if="editingScriptId !== api.id"
                        class="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate"
                      >
                        {{ api.name }}
                      </span>
                      <input
                        v-else
                        v-model="editingName"
                        ref="renameInputRef"
                        class="music-source-rename-input w-full px-2 py-0.5 text-sm rounded focus:outline-none"
                        @blur="saveScriptName(api.id)"
                        @keyup.enter="saveScriptName(api.id)"
                      />

                      <button
                        v-if="editingScriptId !== api.id"
                        class="text-neutral-400 hover:text-primary transition-colors"
                        @click="startRenaming(api)"
                      >
                        <i class="ri-edit-line text-sm"></i>
                      </button>
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span
                        v-if="api.info.version"
                        class="music-source-tag text-[10px] text-neutral-500 px-1.5 py-0.5 rounded"
                      >
                        v{{ api.info.version }}
                      </span>
                    </div>
                  </div>

                  <button
                    class="p-1.5 text-neutral-400 hover:text-primary hover:bg-primary/5 dark:hover:text-primary dark:hover:bg-primary/10 rounded-lg transition-colors"
                    @click="removeLxApi(api.id)"
                  >
                    <i class="ri-delete-bin-line text-sm"></i>
                  </button>
                </div>
              </div>

              <div
                v-else
                class="music-source-empty py-6 text-center text-xs text-neutral-400 rounded-lg"
              >
                <p>{{ t('settings.playback.lxMusic.scripts.empty') }}</p>
              </div>

              <!-- URL Import -->
              <div class="music-source-form mt-4 pt-4">
                <h4 class="text-xs font-medium mb-2 text-neutral-900 dark:text-neutral-100">
                  {{ t('settings.playback.lxMusic.scripts.importOnline') }}
                </h4>
                <div class="flex gap-2">
                  <input
                    v-model="lxScriptUrl"
                    :placeholder="t('settings.playback.lxMusic.scripts.urlPlaceholder')"
                    class="music-source-input flex-1 px-3 py-1.5 rounded-lg text-xs focus:outline-none transition-colors"
                    :disabled="isImportingFromUrl"
                  />
                  <button
                    @click="importLxMusicScriptFromUrl"
                    class="px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    :disabled="!lxScriptUrl.trim() || isImportingFromUrl"
                  >
                    <i v-if="isImportingFromUrl" class="ri-loader-4-line animate-spin"></i>
                    <i v-else class="ri-download-line"></i>
                    {{ t('settings.playback.lxMusic.scripts.importBtn') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Custom API Tab -->
            <div
              v-else-if="activeTab === 'customApi'"
              class="flex flex-col items-center justify-center py-6 text-center h-full"
            >
              <div
                class="w-12 h-12 bg-primary/10 dark:bg-primary/20 text-primary rounded-lg flex items-center justify-center mb-3"
              >
                <i class="ri-plug-fill text-2xl"></i>
              </div>

              <h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                {{ t('settings.playback.customApi.sectionTitle') }}
              </h3>
              <p class="text-neutral-500 dark:text-neutral-400 text-xs mb-4 max-w-xs mx-auto">
                {{ t('settings.playback.lxMusic.scripts.importHint') }}
              </p>

              <button
                @click="importPlugin"
                class="px-5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <i class="ri-upload-line"></i>
                {{ t('settings.playback.customApi.importConfig') }}
              </button>

              <div
                v-if="settingsStore.setData.customApiPluginName"
                class="music-source-current mt-4 flex items-center gap-2 px-3 py-1.5 text-primary rounded-lg text-xs"
              >
                <i class="ri-check-circle-fill"></i>
                <span
                  >{{ t('settings.playback.customApi.currentSource') }}:
                  <b>{{ settingsStore.setData.customApiPluginName }}</b></span
                >
              </div>

              <div v-else class="mt-4 text-xs text-neutral-400">
                {{ t('settings.playback.customApi.notImported') }}
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
          @click="handleCancel"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors confirm-button"
          @click="handleConfirm"
        >
          {{ t('common.confirm') }}
        </button>
      </div>
    </template>
  </responsive-modal>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ResponsiveModal from '@/components/common/ResponsiveModal.vue';
import {
  initLxMusicRunner,
  parseScriptInfo,
  setLxMusicRunner
} from '@/services/LxMusicSourceRunner';
import { useSettingsStore } from '@/store';
import type { LxMusicScriptConfig, LxScriptInfo, LxSourceKey } from '@/types/lxMusic';
import { type Platform } from '@/types/music';
import { useMusicSources } from '@/utils/musicSourceConfig';

// ==================== Props & Emits ====================
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  sources: {
    type: Array as () => Platform[],
    default: () => ['migu', 'kugou', 'kuwo', 'pyncmd'] as Platform[]
  }
});

const emit = defineEmits(['update:show', 'update:sources']);

// ==================== 状态管理 ====================
const { t } = useI18n();
const settingsStore = useSettingsStore();
const message = useMessage();
const visible = ref(props.show);
const selectedSources = ref<Platform[]>([...props.sources]);
const activeTab = ref('sources');
const { allSources } = useMusicSources();

const tabs = computed(() => [
  { key: 'sources', label: t('settings.playback.lxMusic.tabs.sources') },
  { key: 'lxMusic', label: t('settings.playback.lxMusic.tabs.lxMusic') },
  { key: 'customApi', label: t('settings.playback.lxMusic.tabs.customApi') }
]);

// 落雪音源列表（从 store 中的脚本解析）
const lxMusicApis = computed<LxMusicScriptConfig[]>(() => {
  const scripts = settingsStore.setData.lxMusicScripts || [];
  return scripts;
});

// 当前激活的音源 ID
const activeLxApiId = computed<string | null>({
  get: () => settingsStore.setData.activeLxMusicApiId || null,
  set: (id: string | null) => {
    settingsStore.setSetData({ activeLxMusicApiId: id });
  }
});

// 落雪音源脚本信息（保持向后兼容）
const lxMusicScriptInfo = computed<LxScriptInfo | null>(() => {
  const activeId = activeLxApiId.value;
  if (!activeId) {
    return null;
  }
  const activeApi = lxMusicApis.value.find((api: LxMusicScriptConfig) => api.id === activeId);
  return activeApi?.info || null;
});

// URL 导入相关状态
const lxScriptUrl = ref('');
const isImportingFromUrl = ref(false);

// 重命名相关状态
const editingScriptId = ref<string | null>(null);
const editingName = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

// ==================== 计算属性 ====================
const isSourceSelected = (sourceKey: string): boolean => {
  return selectedSources.value.includes(sourceKey as Platform);
};

// ==================== 方法 ====================
/**
 * 切换音源选择状态
 */
const toggleSource = (sourceKey: string) => {
  // 检查是否是自定义API且未导入
  if (sourceKey === 'custom' && !settingsStore.setData.customApiPlugin) {
    message.warning(t('settings.playback.customApi.enableHint'));
    activeTab.value = 'customApi';
    return;
  }

  // 检查是否是落雪音源且未配置
  if (sourceKey === 'lxMusic') {
    if (lxMusicApis.value.length === 0) {
      message.warning(t('settings.playback.lxMusic.scripts.noScriptWarning'));
      activeTab.value = 'lxMusic';
      return;
    }
    if (!activeLxApiId.value) {
      message.warning(t('settings.playback.lxMusic.scripts.noSelectionWarning'));
      activeTab.value = 'lxMusic';
      return;
    }
  }

  const index = selectedSources.value.indexOf(sourceKey as Platform);
  if (index > -1) {
    // 至少保留一个音源
    if (selectedSources.value.length <= 1) {
      message.warning(t('settings.playback.musicSourcesWarning'));
      return;
    }
    selectedSources.value.splice(index, 1);
  } else {
    selectedSources.value.push(sourceKey as Platform);
  }
};

/**
 * 导入自定义API插件
 */
const importPlugin = async () => {
  try {
    const result = await window.api.importCustomApiPlugin();
    if (result && result.name && result.content) {
      settingsStore.setCustomApiPlugin(result);
      message.success(t('settings.playback.customApi.importSuccess', { name: result.name }));

      // 导入成功后自动勾选
      if (!selectedSources.value.includes('custom')) {
        selectedSources.value.push('custom');
      }
    }
  } catch (error: any) {
    message.error(t('settings.playback.customApi.importFailed', { message: error.message }));
  }
};

/**
 * 导入落雪音源脚本
 */
const importLxMusicScript = async () => {
  try {
    const result = await window.api.importLxMusicScript();
    if (result && result.content) {
      await addLxMusicScript(result.content);
    }
  } catch (error: any) {
    console.error('导入落雪音源脚本失败:', error);
    message.error(`${t('common.error')}：${error.message}`);
  }
};

/**
 * 添加落雪音源脚本到列表
 */
const addLxMusicScript = async (scriptContent: string) => {
  // 解析脚本信息
  const scriptInfo = parseScriptInfo(scriptContent);

  // 尝试初始化执行器以验证脚本
  try {
    const runner = await initLxMusicRunner(scriptContent);
    const sources = runner.getSources();
    const sourceKeys = Object.keys(sources) as LxSourceKey[];

    // 生成唯一 ID
    const id = `lx_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建新的脚本配置
    const newApiConfig: LxMusicScriptConfig = {
      id,
      name: scriptInfo.name,
      script: scriptContent,
      info: scriptInfo,
      sources: sourceKeys,
      enabled: true,
      createdAt: Date.now()
    };

    // 添加到列表
    const scripts = [...(settingsStore.setData.lxMusicScripts || []), newApiConfig];

    settingsStore.setSetData({
      lxMusicScripts: scripts,
      activeLxMusicApiId: id // 自动激活新添加的音源
    });

    message.success(`${t('common.success')}：${scriptInfo.name}`);

    // 导入成功后自动勾选
    if (!selectedSources.value.includes('lxMusic')) {
      selectedSources.value.push('lxMusic');
    }
  } catch (initError: any) {
    console.error('[MusicSourceSettings] 落雪音源脚本初始化失败:', initError);
    message.error(`${t('common.error')}：${initError.message}`);
  }
};

/**
 * 设置激活的落雪音源
 */
const setActiveLxApi = async (apiId: string) => {
  const api = lxMusicApis.value.find((a: LxMusicScriptConfig) => a.id === apiId);
  if (!api) {
    message.error(t('settings.playback.lxMusic.scripts.notFound'));
    return;
  }

  try {
    // 清除旧的 runner
    setLxMusicRunner(null);

    // 初始化新选中的脚本
    await initLxMusicRunner(api.script);

    // 更新激活的音源 ID
    activeLxApiId.value = apiId;

    // 确保 lxMusic 在已选音源中
    if (!selectedSources.value.includes('lxMusic')) {
      selectedSources.value.push('lxMusic');
    }

    message.success(t('settings.playback.lxMusic.scripts.switched', { name: api.name }));
  } catch (error: any) {
    console.error('[MusicSourceSettings] 切换落雪音源失败:', error);
    message.error(`${t('common.error')}：${error.message}`);
  }
};

/**
 * 删除落雪音源
 */
const removeLxApi = (apiId: string) => {
  const scripts = [...(settingsStore.setData.lxMusicScripts || [])];
  const index = scripts.findIndex((s) => s.id === apiId);

  if (index === -1) return;

  const removedScript = scripts[index];
  scripts.splice(index, 1);

  // 更新 store
  settingsStore.setSetData({
    lxMusicScripts: scripts
  });

  // 如果删除的是当前激活的音源
  if (activeLxApiId.value === apiId) {
    // 自动选择下一个可用音源，或者清空
    if (scripts.length > 0) {
      setActiveLxApi(scripts[0].id);
    } else {
      setLxMusicRunner(null);
      settingsStore.setSetData({ activeLxMusicApiId: null });
      // 从已选音源中移除 lxMusic
      const srcIndex = selectedSources.value.indexOf('lxMusic');
      if (srcIndex > -1) {
        selectedSources.value.splice(srcIndex, 1);
      }
    }
  }

  message.success(t('settings.playback.lxMusic.scripts.deleted', { name: removedScript.name }));
};

/**
 * 从 URL 导入落雪音源脚本
 */
const importLxMusicScriptFromUrl = async () => {
  const url = lxScriptUrl.value.trim();
  if (!url) {
    message.warning(t('settings.playback.lxMusic.scripts.enterUrl'));
    return;
  }

  // 验证 URL 格式
  try {
    new URL(url);
  } catch {
    message.error(t('settings.playback.lxMusic.scripts.invalidUrl'));
    return;
  }

  isImportingFromUrl.value = true;

  try {
    // 下载脚本内容
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();

    // 验证脚本格式 - 检查是否包含 lx-music 脚本的特征
    // 1. 检查是否有头部注释块（包含 @name、@version 等）
    const hasHeaderComment = /^\/\*+[\s\S]*?@name[\s\S]*?\*\//.test(content);
    // 2. 检查是否使用 lx API（lx.on 或 lx.send）
    const hasLxApi = content.includes('lx.on(') || content.includes('lx.send(');

    if (!hasHeaderComment && !hasLxApi) {
      throw new Error(t('settings.playback.lxMusic.scripts.invalidScript'));
    }

    // 使用统一的添加方法
    await addLxMusicScript(content);

    // 清空 URL 输入框
    lxScriptUrl.value = '';
  } catch (error: any) {
    console.error('从 URL 导入落雪音源脚本失败:', error);
    message.error(
      `${t('settings.playback.lxMusic.scripts.importOnline')} ${t('common.error')}：${error.message}`
    );
  } finally {
    isImportingFromUrl.value = false;
  }
};

/**
 * 开始重命名
 */
const startRenaming = (api: LxMusicScriptConfig) => {
  editingScriptId.value = api.id;
  editingName.value = api.name;
  nextTick(() => {
    renameInputRef.value?.focus();
  });
};

/**
 * 保存脚本名称
 */
const saveScriptName = (apiId: string) => {
  if (!editingName.value.trim()) {
    message.warning(t('settings.playback.lxMusic.scripts.nameRequired'));
    return;
  }

  const scripts = [...(settingsStore.setData.lxMusicScripts || [])];
  const index = scripts.findIndex((s) => s.id === apiId);

  if (index > -1) {
    scripts[index] = {
      ...scripts[index],
      name: editingName.value.trim()
    };

    settingsStore.setSetData({
      lxMusicScripts: scripts
    });

    message.success(t('settings.playback.lxMusic.scripts.renameSuccess'));
  }

  editingScriptId.value = null;
  editingName.value = '';
};

/**
 * 确认选择
 */
const handleConfirm = () => {
  const defaultPlatforms: Platform[] = ['migu', 'kugou', 'kuwo', 'pyncmd'];
  const valuesToEmit =
    selectedSources.value.length > 0 ? [...new Set(selectedSources.value)] : defaultPlatforms;
  emit('update:sources', valuesToEmit);
  visible.value = false;
};

/**
 * 取消选择
 */
const handleCancel = () => {
  selectedSources.value = [...props.sources];
  visible.value = false;
};

// ==================== 监听器 ====================
// 监听自定义插件内容变化
watch(
  () => settingsStore.setData.customApiPlugin,
  (newPluginContent: any) => {
    if (!newPluginContent) {
      const index = selectedSources.value.indexOf('custom');
      if (index > -1) {
        selectedSources.value.splice(index, 1);
      }
    }
  }
);

// 监听落雪音源列表变化
watch(
  [() => lxMusicApis.value.length, () => activeLxApiId.value],
  ([apiCount, activeId]) => {
    // 如果没有音源或没有激活的音源，自动从已选音源中移除 lxMusic
    if (apiCount === 0 || !activeId) {
      const index = selectedSources.value.indexOf('lxMusic');
      if (index > -1) {
        selectedSources.value.splice(index, 1);
      }
    }
  },
  { deep: true }
);

// 同步外部show属性变化
watch(
  () => props.show,
  (newVal: boolean) => {
    visible.value = newVal;
  }
);

// 同步内部visible变化
watch(
  () => visible.value,
  (newVal: boolean) => {
    emit('update:show', newVal);
  }
);

// 同步外部sources属性变化
watch(
  () => props.sources,
  (newVal: Platform[]) => {
    selectedSources.value = [...newVal];
  },
  { deep: true }
);
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.confirm-button {
  background-color: var(--qqm-primary, #22c55e);
}

.confirm-button:hover {
  background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 90%, black);
}

.music-source-tabs,
.music-source-tab-active,
.music-source-card,
.music-source-tag,
.music-source-input {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.music-source-card:hover,
.music-source-input:focus {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}

.music-source-check-idle {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.music-source-empty {
  border: 1px dashed var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
}

.music-source-form {
  border-top: 1px solid var(--qqm-border);
}

.music-source-rename-input {
  border: 1px solid
    color-mix(in srgb, var(--qqm-primary, #22c55e) 32%, var(--qqm-border, rgba(15, 23, 42, 0.08)));
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 92%, transparent);
  color: var(--qqm-text, #111827);
  transition:
    border-color 160ms var(--qqm-ease, ease),
    background-color 160ms var(--qqm-ease, ease),
    box-shadow 160ms var(--qqm-ease, ease);
}

.music-source-rename-input:focus {
  border-color: var(--qqm-primary, #22c55e);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--qqm-primary, #22c55e) 12%, transparent);
}

.music-source-selected,
.music-source-current {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}
</style>
