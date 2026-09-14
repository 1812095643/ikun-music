<template>
  <div
    id="title-bar"
    class="flex justify-between px-6 py-2 select-none relative text-dark dark:text-white"
    @mousedown="drag"
  >
    <div id="title" class="flex items-center gap-2">
      <img src="@/assets/logo.png" alt="" class="h-4 w-4 rounded-[3px]" />
      ikun音乐
    </div>
    <div id="buttons" class="flex gap-4" @mousedown.stop>
      <div
        class="window-action text-neutral-600 dark:text-neutral-400 hover:text-primary"
        @mousedown.stop
        @click.stop="miniWindow"
      >
        <i class="iconfont ri-picture-in-picture-line"></i>
      </div>
      <div
        class="window-action text-neutral-600 dark:text-neutral-400 hover:text-primary"
        @mousedown.stop
        @click.stop="minimize"
      >
        <i class="iconfont icon-minisize"></i>
      </div>
      <div
        class="window-action text-neutral-600 dark:text-neutral-400 hover:text-primary"
        @mousedown.stop
        @click.stop="maximize"
      >
        <i class="iconfont ri-checkbox-blank-line"></i>
      </div>
      <div
        class="window-action text-neutral-600 dark:text-neutral-400 hover:text-primary"
        @mousedown.stop
        @click.stop="handleClose"
      >
        <i class="iconfont icon-close"></i>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showCloseModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35"
        @click.self="showCloseModal = false"
      >
        <div
          class="title-dialog-card relative w-[360px] transform overflow-hidden rounded-lg p-6 transition-opacity"
        >
          <!-- Close Icon -->
          <button
            class="title-dialog-close absolute top-4 right-4 p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors focus:outline-none"
            @click="showCloseModal = false"
          >
            <i class="ri-close-line text-xl leading-none"></i>
          </button>

          <h3 class="text-lg font-bold leading-6 text-neutral-900 dark:text-white mb-2">
            {{ t('comp.titleBar.closeApp') }}
          </h3>
          <div class="mt-2">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ t('comp.titleBar.closeTitle') }}
            </p>
          </div>

          <div
            class="mt-4 flex w-fit cursor-pointer items-center gap-2 group"
            @click="rememberChoice = !rememberChoice"
          >
            <div
              class="relative flex h-5 w-5 items-center justify-center transition-colors duration-200"
              :class="
                rememberChoice
                  ? 'text-green-500'
                  : 'text-neutral-400 group-hover:text-neutral-500 dark:text-neutral-500 dark:group-hover:text-neutral-400'
              "
            >
              <i
                class="text-xl"
                :class="
                  rememberChoice ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'
                "
              ></i>
            </div>
            <span
              class="select-none text-xs text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-300"
              :class="{ 'text-neutral-800 dark:text-neutral-200': rememberChoice }"
            >
              {{ t('comp.titleBar.rememberChoice') }}
            </span>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="title-dialog-secondary rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors focus:outline-none"
              @click="showCloseModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="title-dialog-secondary rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 transition-colors focus:outline-none"
              @click="handleAction('close')"
            >
              {{ t('comp.titleBar.exitApp') }}
            </button>
            <button
              class="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
              @click="handleAction('minimize')"
            >
              {{ t('comp.titleBar.minimizeToTray') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/store/modules/settings';
import { isDesktopRuntime } from '@/utils';

const { t } = useI18n();

const settingsStore = useSettingsStore();
const showCloseModal = ref(false);
const rememberChoice = ref(false);

const minimize = () => {
  if (!isDesktopRuntime) {
    return;
  }
  window.desktop.minimize();
};

const maximize = () => {
  if (!isDesktopRuntime) {
    return;
  }
  window.desktop.maximize();
};

const miniWindow = () => {
  if (!isDesktopRuntime) return;
  window.desktop.miniWindow();
};

const handleAction = (action: 'minimize' | 'close') => {
  if (!isDesktopRuntime) return;

  if (rememberChoice.value) {
    settingsStore.setSetData({
      ...settingsStore.setData,
      closeAction: action
    });
  }

  if (action === 'minimize') {
    showCloseModal.value = false;
    setTimeout(() => {
      window.desktop.miniTray();
    }, 200);
  } else {
    // Fix: Use quitApp instead of close to ensure app exits on macOS
    window.desktop.quitApp();
    showCloseModal.value = false;
  }
};

const handleClose = () => {
  if (!isDesktopRuntime) return;

  const { closeAction } = settingsStore.setData;

  if (closeAction === 'minimize') {
    window.desktop.miniTray();
  } else if (closeAction === 'close') {
    window.desktop.close();
  } else {
    showCloseModal.value = true;
  }
};

const drag = (event: MouseEvent) => {
  if (!isDesktopRuntime) {
    return;
  }

  const target = event.target as HTMLElement | null;
  // 根因：无边框窗口的拖拽区域覆盖了标题栏按钮，点击按钮时可能先触发拖拽，导致最小化、最大化、托盘操作被系统拖窗行为打断。
  // 解决：所有交互元素都明确排除拖拽，只让标题栏空白区域启动窗口拖动，保证桌面端窗口按钮响应稳定。
  if (target?.closest('#buttons, button, input, textarea, select, [data-no-drag]')) {
    return;
  }

  window.desktop.dragStart();
};
</script>

<style scoped lang="scss">
#title-bar {
  -webkit-app-region: drag;
  z-index: 3000;
  height: 40px;
  align-items: center;
  background: transparent;
}

#buttons {
  -webkit-app-region: no-drag;
}

.window-action {
  -webkit-app-region: no-drag;
  cursor: pointer;
}

.title-dialog-card,
.title-dialog-secondary {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.title-dialog-close:hover,
.title-dialog-secondary:hover {
  color: var(--qqm-primary, #22c55e);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface));
}
</style>
