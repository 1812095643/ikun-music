<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    class="shortcut-modal"
    :show-icon="false"
    :title="t('settings.shortcutSettings.title')"
    style="width: min(980px, 94vw)"
  >
    <div class="shortcut-panel">
      <div class="shortcut-panel__header">
        <div>
          <p class="shortcut-panel__summary">{{ summaryText }}</p>
        </div>
        <n-tag size="small" class="shortcut-count-tag">
          {{ t('settings.shortcutSettings.enabledCount') }}: {{ enabledCount }}
        </n-tag>
      </div>

      <div class="shortcut-panel__toolbar">
        <n-space>
          <n-button
            round
            size="small"
            class="toolbar-btn toolbar-btn--neutral"
            @click="resetShortcuts"
          >
            {{ t('settings.shortcutSettings.resetShortcuts') }}
          </n-button>
          <n-button
            round
            size="small"
            class="toolbar-btn toolbar-btn--danger"
            @click="disableAllShortcuts"
          >
            {{ t('settings.shortcutSettings.disableAll') }}
          </n-button>
          <n-button
            round
            size="small"
            class="toolbar-btn toolbar-btn--success"
            @click="enableAllShortcuts"
          >
            {{ t('settings.shortcutSettings.enableAll') }}
          </n-button>
        </n-space>
        <span class="shortcut-panel__tips">{{ t('settings.shortcutSettings.recordingTip') }}</span>
      </div>

      <n-alert
        v-if="registrationFailures.length"
        class="mb-3"
        type="warning"
        :title="t('settings.shortcutSettings.registrationWarningTitle')"
      >
        <div class="shortcut-warning-list">
          <div v-for="item in registrationFailures" :key="`failure-${item.action}-${item.key}`">
            {{ getShortcutLabel(item.action) }}: {{ formatShortcut(item.key) }} ({{
              getRegistrationFailureLabel(item.reason)
            }})
          </div>
        </div>
      </n-alert>

      <div class="shortcut-panel__content">
        <n-scrollbar class="shortcut-scrollbar">
          <div v-for="section in shortcutSections" :key="section.key" class="shortcut-section">
            <div class="shortcut-section__title">{{ section.title }}</div>

            <div
              v-for="action in section.actions"
              :key="action"
              class="shortcut-row"
              :class="{ 'shortcut-row--error': shortcutIssueMap.has(action) }"
            >
              <div class="shortcut-row__info">
                <div class="shortcut-row__name">{{ getShortcutLabel(action) }}</div>
                <div class="shortcut-row__desc">{{ getShortcutDescription(action) }}</div>
              </div>

              <div class="shortcut-row__editor">
                <button
                  :ref="(el) => setRecorderRef(action, el as HTMLButtonElement | null)"
                  type="button"
                  class="shortcut-recorder"
                  :class="{ 'shortcut-recorder--recording': recordingAction === action }"
                  @click="startRecording(action)"
                  @keydown="(event) => handleRecorderKeydown(event, action)"
                  @blur="() => handleRecorderBlur(action)"
                >
                  <span class="shortcut-recorder__value">{{
                    formatShortcut(draftShortcuts[action].key)
                  }}</span>
                  <span class="shortcut-recorder__hint">
                    {{
                      recordingAction === action
                        ? t('settings.shortcutSettings.recording')
                        : t('settings.shortcutSettings.clickToRecord')
                    }}
                  </span>
                </button>

                <n-button size="tiny" quaternary @click="resetSingleShortcut(action)">
                  {{ t('settings.shortcutSettings.restoreSingle') }}
                </n-button>
              </div>

              <div class="shortcut-row__controls">
                <n-switch v-model:value="draftShortcuts[action].enabled" size="small" />
                <n-select
                  v-model:value="draftShortcuts[action].scope"
                  size="small"
                  :options="scopeOptions"
                  :disabled="!draftShortcuts[action].enabled"
                  class="w-28"
                />
              </div>

              <div class="shortcut-row__status">
                <n-tag v-if="shortcutIssueMap.has(action)" type="error" size="small">
                  {{ getIssueLabel(action) }}
                </n-tag>
              </div>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <div class="shortcut-panel__footer">
        <n-space justify="end">
          <n-button round class="footer-btn footer-btn--cancel" @click="handleCancel">
            {{ t('common.cancel') }}
          </n-button>
          <n-button
            round
            class="footer-btn footer-btn--primary"
            :loading="saving"
            :disabled="hasLocalBlockingIssue"
            @click="handleSave"
          >
            {{ t('common.save') }}
          </n-button>
        </n-space>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { useMessage } from 'naive-ui';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { isDesktopRuntime } from '@/utils';
import { setAppShortcutsSuspended } from '@/utils/appShortcuts';
import { keyboardEventToAccelerator } from '@/utils/shortcutKeyboard';

import {
  createDefaultShortcuts,
  formatShortcutForDisplay,
  getReservedAccelerators,
  getShortcutConflicts,
  isModifierOnlyShortcut,
  normalizeShortcutAccelerator,
  normalizeShortcutsConfig,
  type ShortcutAction,
  shortcutGroups,
  type ShortcutPlatform,
  type ShortcutsConfig,
  type ShortcutScope
} from '../../../shared/shortcuts';

type ShortcutValidationIssueReason = 'invalid' | 'conflict' | 'reserved';

type ShortcutValidationIssuePayload = {
  action: ShortcutAction;
  key: string;
  scope: ShortcutScope;
  reason: ShortcutValidationIssueReason;
  conflictWith?: ShortcutAction;
};

type ShortcutRegistrationFailureReason = 'invalid' | 'occupied';

type ShortcutRegistrationFailurePayload = {
  action: ShortcutAction;
  key: string;
  reason: ShortcutRegistrationFailureReason;
};

type ShortcutSaveResult = {
  ok: boolean;
  validation: {
    shortcuts: ShortcutsConfig;
    hasBlockingIssue: boolean;
    issues: ShortcutValidationIssuePayload[];
  };
  registration: {
    success: boolean;
    failed: ShortcutRegistrationFailurePayload[];
  };
};

const props = defineProps<{
  show?: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void;
  (event: 'change', value: ShortcutsConfig): void;
}>();

const { t } = useI18n();
const message = useMessage();

const visible = ref(false);
const saving = ref(false);
const platform = ref<ShortcutPlatform>('web');
const recordingAction = ref<ShortcutAction | null>(null);
const serverIssues = ref<ShortcutValidationIssuePayload[]>([]);
const registrationFailures = ref<ShortcutRegistrationFailurePayload[]>([]);

const defaultShortcuts = createDefaultShortcuts();

const storedShortcuts = ref<ShortcutsConfig>(cloneDeep(defaultShortcuts));
const draftShortcuts = ref<ShortcutsConfig>(cloneDeep(defaultShortcuts));

const recorderRefs = ref<Record<ShortcutAction, HTMLButtonElement | null>>({
  togglePlay: null,
  prevPlay: null,
  nextPlay: null,
  volumeUp: null,
  volumeDown: null,
  toggleFavorite: null,
  toggleWindow: null
});

const scopeOptions = computed(() => [
  { label: t('settings.shortcutSettings.scopeGlobal'), value: 'global' },
  { label: t('settings.shortcutSettings.scopeApp'), value: 'app' }
]);

const shortcutSections = computed(() => [
  {
    key: 'playback',
    title: t('settings.shortcutSettings.groups.playback'),
    actions: shortcutGroups.playback
  },
  {
    key: 'sound',
    title: t('settings.shortcutSettings.groups.sound'),
    actions: shortcutGroups.sound
  },
  {
    key: 'window',
    title: t('settings.shortcutSettings.groups.window'),
    actions: shortcutGroups.window
  }
]);

const conflictIssueMap = computed(() => {
  const map = new Map<ShortcutAction, ShortcutValidationIssuePayload>();

  getShortcutConflicts(draftShortcuts.value).forEach((conflict) => {
    conflict.actions.forEach((action, index) => {
      const conflictWith = conflict.actions[(index + 1) % conflict.actions.length];
      map.set(action, {
        action,
        key: conflict.key,
        scope: conflict.scope,
        reason: 'conflict',
        conflictWith
      });
    });
  });

  return map;
});

const invalidIssueMap = computed(() => {
  const map = new Map<ShortcutAction, ShortcutValidationIssuePayload>();

  Object.entries(draftShortcuts.value).forEach(([action, config]) => {
    const shortcutAction = action as ShortcutAction;
    if (!config.enabled) {
      return;
    }

    const normalizedKey = normalizeShortcutAccelerator(config.key);
    if (!normalizedKey || isModifierOnlyShortcut(config.key)) {
      map.set(shortcutAction, {
        action: shortcutAction,
        key: config.key,
        scope: config.scope,
        reason: 'invalid'
      });
    }
  });

  return map;
});

const reservedIssueMap = computed(() => {
  const map = new Map<ShortcutAction, ShortcutValidationIssuePayload>();
  const reservedAccelerators = new Set(getReservedAccelerators(platform.value));

  Object.entries(draftShortcuts.value).forEach(([action, config]) => {
    const shortcutAction = action as ShortcutAction;
    if (!config.enabled || config.scope !== 'global') {
      return;
    }

    const normalizedKey = normalizeShortcutAccelerator(config.key);
    if (normalizedKey && reservedAccelerators.has(normalizedKey)) {
      map.set(shortcutAction, {
        action: shortcutAction,
        key: normalizedKey,
        scope: config.scope,
        reason: 'reserved'
      });
    }
  });

  return map;
});

const localIssueMap = computed(() => {
  const map = new Map<ShortcutAction, ShortcutValidationIssuePayload>();

  invalidIssueMap.value.forEach((issue, action) => {
    map.set(action, issue);
  });

  conflictIssueMap.value.forEach((issue, action) => {
    if (!map.has(action)) {
      map.set(action, issue);
    }
  });

  reservedIssueMap.value.forEach((issue, action) => {
    if (!map.has(action)) {
      map.set(action, issue);
    }
  });

  return map;
});

const shortcutIssueMap = computed(() => {
  const map = new Map<ShortcutAction, ShortcutValidationIssuePayload>();

  localIssueMap.value.forEach((issue, action) => {
    map.set(action, issue);
  });

  serverIssues.value.forEach((issue) => {
    if (!map.has(issue.action)) {
      map.set(issue.action, issue);
    }
  });

  return map;
});

const hasLocalBlockingIssue = computed(() => localIssueMap.value.size > 0);

const enabledCount = computed(() => {
  return Object.values(draftShortcuts.value).filter((item) => item.enabled).length;
});

const summaryText = computed(() => {
  if (hasLocalBlockingIssue.value) {
    return t('settings.shortcutSettings.summaryBlocked');
  }

  if (recordingAction.value) {
    return t('settings.shortcutSettings.summaryRecording');
  }

  return t('settings.shortcutSettings.summaryReady');
});

watch(
  () => props.show,
  (newValue) => {
    const nextVisible = Boolean(newValue);
    if (nextVisible !== visible.value) {
      visible.value = nextVisible;
    }
  },
  { immediate: true }
);

watch(visible, (newValue, oldValue) => {
  emit('update:show', newValue);

  if (newValue === oldValue) {
    return;
  }

  if (newValue) {
    void handleOpen();
    return;
  }

  handleClose();
});

watch(
  draftShortcuts,
  () => {
    serverIssues.value = [];
    registrationFailures.value = [];
  },
  { deep: true }
);

function setRecorderRef(action: ShortcutAction, element: HTMLButtonElement | null) {
  recorderRefs.value[action] = element;
}

function getShortcutLabel(action: ShortcutAction) {
  const labels: Record<ShortcutAction, string> = {
    togglePlay: t('settings.shortcutSettings.togglePlay'),
    prevPlay: t('settings.shortcutSettings.prevPlay'),
    nextPlay: t('settings.shortcutSettings.nextPlay'),
    volumeUp: t('settings.shortcutSettings.volumeUp'),
    volumeDown: t('settings.shortcutSettings.volumeDown'),
    toggleFavorite: t('settings.shortcutSettings.toggleFavorite'),
    toggleWindow: t('settings.shortcutSettings.toggleWindow')
  };

  return labels[action];
}

function getShortcutDescription(action: ShortcutAction) {
  const descriptions: Record<ShortcutAction, string> = {
    togglePlay: t('settings.shortcutSettings.togglePlayDesc'),
    prevPlay: t('settings.shortcutSettings.prevPlayDesc'),
    nextPlay: t('settings.shortcutSettings.nextPlayDesc'),
    volumeUp: t('settings.shortcutSettings.volumeUpDesc'),
    volumeDown: t('settings.shortcutSettings.volumeDownDesc'),
    toggleFavorite: t('settings.shortcutSettings.toggleFavoriteDesc'),
    toggleWindow: t('settings.shortcutSettings.toggleWindowDesc')
  };

  return descriptions[action];
}

function getIssueLabel(action: ShortcutAction) {
  const issue = shortcutIssueMap.value.get(action);
  if (!issue) {
    return '';
  }

  if (issue.reason === 'invalid') {
    return t('settings.shortcutSettings.issueInvalid');
  }

  if (issue.reason === 'reserved') {
    return t('settings.shortcutSettings.issueReserved');
  }

  return t('settings.shortcutSettings.shortcutConflict');
}

function getRegistrationFailureLabel(reason: ShortcutRegistrationFailureReason) {
  return reason === 'occupied'
    ? t('settings.shortcutSettings.registrationOccupied')
    : t('settings.shortcutSettings.registrationInvalid');
}

function formatShortcut(shortcut: string) {
  return formatShortcutForDisplay(shortcut, platform.value);
}

function stopRecording() {
  recordingAction.value = null;
}

function startRecording(action: ShortcutAction) {
  recordingAction.value = action;

  nextTick(() => {
    recorderRefs.value[action]?.focus();
  });
}

function handleRecorderBlur(action: ShortcutAction) {
  if (recordingAction.value === action) {
    stopRecording();
  }
}

function handleRecorderKeydown(event: KeyboardEvent, action: ShortcutAction) {
  if (recordingAction.value !== action) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    stopRecording();
    return;
  }

  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    stopRecording();
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    draftShortcuts.value[action].enabled = false;
    stopRecording();
    message.info(t('settings.shortcutSettings.messages.clearToDisable'));
    return;
  }

  const accelerator = keyboardEventToAccelerator(event);
  if (!accelerator || isModifierOnlyShortcut(accelerator)) {
    message.warning(t('settings.shortcutSettings.messages.invalidShortcut'));
    return;
  }

  draftShortcuts.value[action].key = accelerator;
  draftShortcuts.value[action].enabled = true;
  stopRecording();
}

function resetShortcuts() {
  draftShortcuts.value = cloneDeep(defaultShortcuts);
  message.success(t('settings.shortcutSettings.messages.resetSuccess'));
}

function resetSingleShortcut(action: ShortcutAction) {
  draftShortcuts.value[action] = cloneDeep(defaultShortcuts[action]);
}

function disableAllShortcuts() {
  Object.values(draftShortcuts.value).forEach((shortcut) => {
    shortcut.enabled = false;
  });
  message.info(t('settings.shortcutSettings.messages.disableAll'));
}

function enableAllShortcuts() {
  Object.values(draftShortcuts.value).forEach((shortcut) => {
    shortcut.enabled = true;
  });
  message.info(t('settings.shortcutSettings.messages.enableAll'));
}

async function loadShortcutsFromMain() {
  if (!isDesktopRuntime) {
    const defaults = createDefaultShortcuts();
    storedShortcuts.value = cloneDeep(defaults);
    draftShortcuts.value = cloneDeep(defaults);
    return;
  }

  const platformValue = window.electron.ipcRenderer.sendSync('get-platform');
  if (platformValue === 'darwin' || platformValue === 'win32' || platformValue === 'linux') {
    platform.value = platformValue;
  }

  try {
    const shortcuts = await window.electron.ipcRenderer.invoke('shortcuts:get-config');
    const normalized = normalizeShortcutsConfig(shortcuts);
    storedShortcuts.value = cloneDeep(normalized);
    draftShortcuts.value = cloneDeep(normalized);
    return;
  } catch (error) {
    console.error('[ShortcutSettings] 获取快捷键配置失败:', error);
  }

  const stored = window.electron.ipcRenderer.sendSync('get-store-value', 'shortcuts');
  const normalized = normalizeShortcutsConfig(stored);
  storedShortcuts.value = cloneDeep(normalized);
  draftShortcuts.value = cloneDeep(normalized);
}

async function handleOpen() {
  serverIssues.value = [];
  registrationFailures.value = [];
  stopRecording();

  if (isDesktopRuntime) {
    setAppShortcutsSuspended(true);
    window.electron.ipcRenderer.send('disable-shortcuts');
  }

  await loadShortcutsFromMain();
}

function resumeShortcutRuntime() {
  setAppShortcutsSuspended(false);

  if (isDesktopRuntime) {
    window.electron.ipcRenderer.send('enable-shortcuts');
  }
}

function handleClose() {
  stopRecording();
  draftShortcuts.value = cloneDeep(storedShortcuts.value);
  resumeShortcutRuntime();
}

async function handleSave() {
  if (hasLocalBlockingIssue.value) {
    message.error(t('settings.shortcutSettings.messages.saveValidationError'));
    return;
  }

  saving.value = true;

  try {
    const shortcutsPayload = normalizeShortcutsConfig(
      JSON.parse(JSON.stringify(draftShortcuts.value)) as ShortcutsConfig
    );

    if (!isDesktopRuntime) {
      storedShortcuts.value = cloneDeep(shortcutsPayload);
      message.success(t('settings.shortcutSettings.messages.saveSuccess'));
      emit('change', storedShortcuts.value);
      visible.value = false;
      return;
    }

    const result = (await window.electron.ipcRenderer.invoke(
      'shortcuts:save',
      shortcutsPayload
    )) as ShortcutSaveResult;

    if (!result?.ok) {
      serverIssues.value = result?.validation?.issues ?? [];
      message.error(t('settings.shortcutSettings.messages.saveValidationError'));
      return;
    }

    const normalizedShortcuts = normalizeShortcutsConfig(result.validation.shortcuts);
    storedShortcuts.value = cloneDeep(normalizedShortcuts);
    draftShortcuts.value = cloneDeep(normalizedShortcuts);
    emit('change', normalizedShortcuts);

    registrationFailures.value = result.registration.failed ?? [];
    if (registrationFailures.value.length > 0) {
      message.warning(t('settings.shortcutSettings.messages.partialRegistered'));
      return;
    }

    message.success(t('settings.shortcutSettings.messages.saveSuccess'));
    visible.value = false;
  } catch (error) {
    console.error('[ShortcutSettings] 保存快捷键失败:', error);
    message.error(t('settings.shortcutSettings.messages.saveError'));
  } finally {
    saving.value = false;
  }
}

function handleCancel() {
  visible.value = false;
}

onUnmounted(() => {
  resumeShortcutRuntime();
});
</script>

<style lang="scss" scoped>
:deep(.shortcut-modal .n-card) {
  border-radius: 10px;
  max-height: min(86vh, 920px);
  overflow: hidden;
}

:deep(.shortcut-modal .n-card-header) {
  padding: 18px 22px 12px;
  border-bottom: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
}

:deep(.shortcut-modal .n-card-header .n-card-header__main) {
  font-size: 19px;
  font-weight: 700;
  color: var(--qqm-text, #111827);
}

:deep(.shortcut-modal .n-card__content) {
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.shortcut-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: min(72vh, 740px);
  max-height: calc(100vh - 180px);
}

.shortcut-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--qqm-surface, #ffffff);
  gap: 12px;
  margin-bottom: 12px;
}

.shortcut-panel__summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--qqm-text, #111827);
  margin: 0;
}

.shortcut-panel__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.shortcut-panel__tips {
  font-size: 12px;
  color: var(--qqm-muted, #64748b);
  line-height: 1.4;
}

.shortcut-panel__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 94%, var(--qqm-bg, #f7f8fa));
}

.shortcut-scrollbar {
  height: 100%;
}

:deep(.shortcut-scrollbar .n-scrollbar-content) {
  padding: 12px;
}

.shortcut-section {
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--qqm-surface, #ffffff);
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: none;
}

.shortcut-section:last-child {
  margin-bottom: 0;
}

.shortcut-section__title {
  padding: 10px 13px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--qqm-text, #111827) 76%, var(--qqm-muted, #64748b));
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 94%, var(--qqm-bg, #f7f8fa));
  border-bottom: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
}

.shortcut-row {
  display: grid;
  grid-template-columns: minmax(170px, 1fr) minmax(280px, 1.35fr) 170px auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px dashed
    color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 88%, transparent);
}

.shortcut-row:last-child {
  border-bottom: none;
}

.shortcut-row--error {
  background: color-mix(in srgb, #f97316 8%, var(--qqm-surface, #ffffff));
}

.shortcut-row__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--qqm-text, #111827);
}

.shortcut-row__desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--qqm-muted, #64748b);
}

.shortcut-row__editor {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-recorder {
  width: 100%;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--qqm-surface, #ffffff);
  text-align: left;
  transition: all 0.2s ease;
}

.shortcut-recorder:hover,
.shortcut-recorder:focus-visible {
  border-color: color-mix(
    in srgb,
    var(--qqm-primary, #22c55e) 36%,
    var(--qqm-border, rgba(15, 23, 42, 0.08))
  );
  box-shadow: none;
  outline: none;
}

.shortcut-recorder--recording {
  border-color: var(--qqm-primary, #22c55e);
  box-shadow: none;
}

.shortcut-recorder__value {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--qqm-text, #111827);
}

.shortcut-recorder__hint {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--qqm-muted, #64748b);
}

.shortcut-row__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-row__status {
  min-width: 96px;
  display: flex;
  justify-content: flex-end;
}

.shortcut-panel__footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
}

.shortcut-warning-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

:deep(.shortcut-count-tag) {
  border-radius: 8px;
  color: var(--qqm-primary, #22c55e);
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, transparent);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, transparent);
}

:deep(.toolbar-btn.n-button),
:deep(.footer-btn.n-button) {
  border: none;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

:deep(.toolbar-btn .n-button__border),
:deep(.toolbar-btn .n-button__state-border),
:deep(.footer-btn .n-button__border),
:deep(.footer-btn .n-button__state-border) {
  display: none;
}

:deep(.toolbar-btn--neutral.n-button) {
  color: var(--qqm-text, #111827);
  background: color-mix(
    in srgb,
    var(--qqm-surface, #ffffff) 88%,
    var(--qqm-border, rgba(15, 23, 42, 0.08))
  );
}

:deep(.toolbar-btn--neutral.n-button:hover) {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface, #ffffff));
}

:deep(.toolbar-btn--danger.n-button) {
  color: #fff;
  background: var(--qqm-danger, #ef4444);
}

:deep(.toolbar-btn--danger.n-button:hover) {
  background: color-mix(in srgb, var(--qqm-danger, #ef4444) 88%, #7f1d1d);
}

:deep(.toolbar-btn--success.n-button) {
  color: #fff;
  background: var(--qqm-primary, #22c55e);
}

:deep(.toolbar-btn--success.n-button:hover) {
  background: var(--qqm-primary-strong, #16a34a);
}

:deep(.footer-btn--cancel.n-button) {
  color: color-mix(in srgb, var(--qqm-text, #111827) 76%, var(--qqm-muted, #64748b));
  background: color-mix(
    in srgb,
    var(--qqm-surface, #ffffff) 88%,
    var(--qqm-border, rgba(15, 23, 42, 0.08))
  );
}

:deep(.footer-btn--cancel.n-button:hover) {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface, #ffffff));
}

:deep(.footer-btn--primary.n-button) {
  color: #fff;
  background: var(--qqm-primary-strong, #16a34a);
}

:deep(.footer-btn--primary.n-button:hover) {
  background: var(--qqm-primary-strong, #16a34a);
}

:deep(.footer-btn--primary.n-button.n-button--disabled) {
  color: color-mix(in srgb, #ffffff 76%, var(--qqm-primary, #22c55e));
  background: color-mix(in srgb, var(--qqm-muted, #64748b) 58%, var(--qqm-surface, #ffffff));
  box-shadow: none;
}

:deep(.dark) .shortcut-panel__summary {
  color: var(--qqm-text, #f5f5f5);
}

:deep(.dark) .shortcut-panel__tips {
  color: var(--qqm-muted, #a3a3a3);
}

:deep(.dark) .shortcut-modal .n-card {
  background: var(--qqm-surface, #101112);
}

:deep(.dark) .shortcut-modal .n-card-header {
  border-bottom-color: color-mix(in srgb, #ffffff 10%, transparent);
}

:deep(.dark) .shortcut-modal .n-card-header .n-card-header__main {
  color: var(--qqm-text, #f5f5f5);
}

:deep(.dark) .shortcut-modal .n-card__content {
  background: var(--qqm-surface, #101112);
}

:deep(.dark) .shortcut-panel__header {
  border-color: color-mix(in srgb, #ffffff 10%, transparent);
  background: var(--qqm-surface, #101112);
}

:deep(.dark) .shortcut-panel__content {
  border-color: color-mix(in srgb, #ffffff 10%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #101112) 94%, #ffffff 3%);
}

:deep(.dark) .shortcut-section {
  border-color: color-mix(in srgb, #ffffff 10%, transparent);
  background: var(--qqm-surface, #101112);
}

:deep(.dark) .shortcut-section__title {
  color: color-mix(in srgb, var(--qqm-text, #f5f5f5) 76%, var(--qqm-muted, #a3a3a3));
  background: color-mix(in srgb, var(--qqm-surface, #101112) 84%, var(--qqm-primary, #22c55e) 5%);
  border-bottom-color: color-mix(in srgb, #ffffff 10%, transparent);
}

:deep(.dark) .shortcut-row {
  border-bottom-color: color-mix(in srgb, #ffffff 10%, transparent);
}

:deep(.dark) .shortcut-row--error {
  background: rgba(127, 29, 29, 0.24);
}

:deep(.dark) .shortcut-row__name,
:deep(.dark) .shortcut-recorder__value {
  color: var(--qqm-text, #f5f5f5);
}

:deep(.dark) .shortcut-row__desc,
:deep(.dark) .shortcut-recorder__hint {
  color: var(--qqm-muted, #a3a3a3);
}

:deep(.dark) .shortcut-recorder {
  border-color: color-mix(in srgb, #ffffff 12%, transparent);
  background: color-mix(in srgb, var(--qqm-surface, #101112) 92%, #ffffff 4%);
  box-shadow: none;
}

:deep(.dark) .shortcut-panel__footer {
  border-top-color: color-mix(in srgb, #ffffff 10%, transparent);
}

:deep(.dark) .toolbar-btn--neutral.n-button {
  color: var(--qqm-text, #f5f5f5);
  background: color-mix(in srgb, var(--qqm-surface, #101112) 92%, #ffffff 6%);
}

:deep(.dark) .toolbar-btn--neutral.n-button:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #101112));
}

:deep(.dark) .footer-btn--cancel.n-button {
  color: var(--qqm-text, #f5f5f5);
  background: color-mix(in srgb, var(--qqm-surface, #101112) 92%, #ffffff 6%);
}

:deep(.dark) .footer-btn--cancel.n-button:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #101112));
}

:deep(.dark) .shortcut-count-tag {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 10%, transparent);
  color: var(--qqm-primary, #22c55e);
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 28%, transparent);
}

:deep(.dark) .footer-btn--primary.n-button.n-button--disabled {
  color: color-mix(in srgb, var(--qqm-text, #f5f5f5) 76%, var(--qqm-muted, #a3a3a3));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface, #101112));
}

@media (max-width: 900px) {
  .shortcut-panel {
    height: min(76vh, 690px);
    max-height: calc(100vh - 128px);
  }

  .shortcut-panel__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .shortcut-panel__tips {
    font-size: 11px;
  }

  .shortcut-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .shortcut-row__status {
    justify-content: flex-start;
  }
}

@media (max-height: 760px) {
  .shortcut-panel {
    height: calc(100vh - 120px);
    max-height: calc(100vh - 120px);
  }
}
</style>
