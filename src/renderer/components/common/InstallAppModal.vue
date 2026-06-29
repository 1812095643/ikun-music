<template>
  <n-modal
    v-model:show="showModal"
    preset="dialog"
    :show-icon="false"
    :mask-closable="true"
    class="install-app-modal"
  >
    <div class="modal-content">
      <div class="modal-header">
        <div class="app-icon">
          <img src="@/assets/logo.png" alt="App Icon" />
        </div>
        <div class="app-info">
          <h2 class="app-name">ikun音乐 {{ config.version }}</h2>
          <p class="app-desc mb-2">{{ t('comp.installApp.description') }}</p>
          <n-checkbox v-model:checked="noPrompt">{{ t('comp.installApp.noPrompt') }}</n-checkbox>
        </div>
      </div>
      <div class="modal-actions">
        <n-button class="cancel-btn" @click="closeModal">{{
          t('comp.installApp.cancel')
        }}</n-button>
        <n-button type="primary" class="install-btn" @click="handleInstall">{{
          t('comp.installApp.install')
        }}</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { isTauriRuntime } from '@/utils';

import config from '../../../../package.json';

const { t } = useI18n();

const showModal = ref(false);
const noPrompt = ref(false);

const closeModal = () => {
  showModal.value = false;
  if (noPrompt.value) {
    localStorage.setItem('installPromptDismissed', 'true');
  }
};

onMounted(async () => {
  // Tauri 应用内不显示 Web 安装提示，Android App 第一阶段只保留基础播放链路。
  if (isTauriRuntime) {
    return;
  }

  // 检查是否已经点击过"暂不安装"
  const isDismissed = localStorage.getItem('installPromptDismissed') === 'true';
  if (isDismissed) {
    return;
  }
  showModal.value = true;
});

const handleInstall = async (): Promise<void> => {
  closeModal();
};
</script>

<style lang="scss" scoped>
.install-app-modal {
  :deep(.n-modal) {
    @apply max-w-sm;
  }
  .modal-content {
    @apply p-4 pb-0;
    .modal-header {
      @apply flex items-center mb-6;
      .app-icon {
        @apply w-20 h-20 mr-4 rounded-lg overflow-hidden;
        img {
          @apply w-full h-full object-cover;
        }
      }
      .app-info {
        @apply flex-1;
        .app-name {
          @apply text-xl font-bold mb-1;
        }
        .app-desc {
          @apply text-sm text-neutral-400;
        }
      }
    }
    .modal-actions {
      @apply flex gap-3 mt-4;
      .n-button {
        @apply flex-1;
      }
      .cancel-btn {
        @apply bg-neutral-900 text-neutral-300 border-none;
        &:hover {
          @apply bg-neutral-700;
        }
      }
      .install-btn {
        @apply border-none;
        background-color: var(--qqm-primary, #22c55e);
        &:hover {
          background-color: var(--qqm-primary, #22c55e);
        }
      }
    }
  }
}
</style>
