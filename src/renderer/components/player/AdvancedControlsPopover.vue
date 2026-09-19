<template>
  <n-dropdown
    :show="showDropdown"
    :options="dropdownOptions"
    trigger="hover"
    :z-index="9999999"
    @select="handleSelect"
    placement="top"
    @update:show="(show) => (showDropdown = show)"
  >
    <n-tooltip trigger="hover" :z-index="9999999">
      <template #trigger>
        <button type="button" class="advanced-controls-btn" aria-label="播放设置">
          <i class="iconfont ri-settings-3-line"></i>

          <!-- 激活状态的小标记 -->
          <div v-if="hasActiveSettings" class="active-indicator">
            <span v-if="hasActiveSleepTimer" class="timer-badge">
              <i class="ri-time-line"></i>
            </span>
          </div>
        </button>
      </template>
      {{ t('player.playBar.advancedControls') }}
    </n-tooltip>
  </n-dropdown>

  <!-- EQ 均衡器弹窗 -->
  <n-modal
    v-model:show="showEQModal"
    :mask-closable="true"
    :unstable-show-mask="false"
    :z-index="9999999"
  >
    <div class="eq-modal-content">
      <div class="modal-close" @click="showEQModal = false">
        <i class="ri-close-line"></i>
      </div>
      <eq-control />
    </div>
  </n-modal>

  <!-- 音效设置弹窗 -->
  <n-modal
    v-model:show="showAudioEffectsModal"
    :mask-closable="true"
    :unstable-show-mask="false"
    :z-index="9999999"
  >
    <audio-effects-panel @close="showAudioEffectsModal = false" />
  </n-modal>

  <!-- 定时关闭弹窗 -->
  <n-modal
    v-model:show="playerStore.showSleepTimer"
    :mask-closable="true"
    :unstable-show-mask="false"
    :z-index="9999999"
  >
    <div class="timer-modal-content">
      <div class="modal-close" @click="playerStore.showSleepTimer = false">
        <i class="ri-close-line"></i>
      </div>
      <sleep-timer />
    </div>
  </n-modal>

  <!-- 播放速度设置弹窗 -->
  <n-modal
    v-model:show="showSpeedModal"
    :mask-closable="true"
    :unstable-show-mask="false"
    :z-index="9999999"
  >
    <div class="speed-modal-content">
      <div class="modal-close" @click="showSpeedModal = false">
        <i class="ri-close-line"></i>
      </div>
      <h3>{{ t('player.playBar.playbackSpeed') }} ({{ playbackRate }}x)</h3>
      <div class="speed-controls">
        <div class="speed-options">
          <div
            v-for="option in playbackRateOptions"
            :key="option.key"
            class="speed-option"
            :class="{ active: playbackRate === option.key }"
            @click="selectSpeed(option.key)"
          >
            {{ option.label }}
          </div>
        </div>
        <div class="speed-slider">
          <n-slider
            :value="playbackRate"
            :min="0.25"
            :max="2.0"
            :step="0.01"
            @update:value="selectSpeed"
          />
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script lang="ts" setup>
import { DropdownOption, NSlider } from 'naive-ui';
import { computed, h, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import EqControl from '@/components/EQControl.vue';
import AudioEffectsPanel from '@/components/player/AudioEffectsPanel.vue';
import SleepTimer from '@/components/player/SleepTimer.vue';
import { useAudioEffects } from '@/hooks/useAudioEffects';
import { usePlayerStore } from '@/store/modules/player';

const { t } = useI18n();
const playerStore = usePlayerStore();

// 下拉菜单状态
const showDropdown = ref(false);
const showEQModal = ref(false);
const showAudioEffectsModal = ref(false);
const showSpeedModal = ref(false);
const isEQVisible = ref(false);
const effectsState = useAudioEffects();
const currentEffectPreset = computed(() => effectsState.value.preset);

// 监听弹窗状态，确保互斥
watch(showEQModal, (newValue) => {
  if (newValue) {
    // 如果EQ弹窗打开，关闭其他弹窗
    playerStore.showSleepTimer = false;
    showSpeedModal.value = false;
    showAudioEffectsModal.value = false;
  }
});

watch(showAudioEffectsModal, (newValue) => {
  if (newValue) {
    showEQModal.value = false;
    playerStore.showSleepTimer = false;
    showSpeedModal.value = false;
  }
});

watch(
  () => playerStore.showSleepTimer,
  (newValue) => {
    if (newValue) {
      // 如果睡眠定时器弹窗打开，关闭其他弹窗
      showEQModal.value = false;
      showSpeedModal.value = false;
      showAudioEffectsModal.value = false;
    }
  }
);

watch(showSpeedModal, (newValue) => {
  if (newValue) {
    // 如果播放速度弹窗打开，关闭其他弹窗
    showEQModal.value = false;
    playerStore.showSleepTimer = false;
    showAudioEffectsModal.value = false;
  }
});

// 播放速度状态
const playbackRate = computed(() => playerStore.playbackRate);

// 播放速度选项
const playbackRateOptions = [
  { label: '0.5x', key: 0.5 },
  { label: '0.75x', key: 0.75 },
  { label: '1.0x', key: 1.0 },
  { label: '1.25x', key: 1.25 },
  { label: '1.5x', key: 1.5 },
  { label: '2.0x', key: 2.0 }
];

// 是否有激活的睡眠定时器
const hasActiveSleepTimer = computed(() => playerStore.hasSleepTimerActive);

// 检查是否有任何高级设置是激活状态
const hasActiveSettings = computed(() => {
  return (
    playbackRate.value !== 1.0 ||
    hasActiveSleepTimer.value ||
    isEQVisible.value ||
    currentEffectPreset.value !== 'off'
  );
});

// 下拉菜单选项
const dropdownOptions = computed<DropdownOption[]>(() => [
  {
    label: t('player.playBar.eq'),
    key: 'eq',
    icon: () => h('i', { class: 'ri-equalizer-line' })
  },
  {
    label: t('player.playBar.effects'),
    key: 'effects',
    icon: () => h('i', { class: 'ri-surround-sound-line' }),
    suffix: () =>
      currentEffectPreset.value !== 'off'
        ? h('span', { class: 'active-option-mark' }, '已开')
        : null
  },
  {
    label: t('player.sleepTimer.title'),
    key: 'timer',
    icon: () => h('i', { class: 'ri-timer-line' }),
    // 如果有激活的定时器，添加标记
    suffix: () => (hasActiveSleepTimer.value ? h('span', { class: 'active-option-mark' }) : null)
  },
  {
    label: t('player.playBar.playbackSpeed') + `(${playbackRate.value}x)`,
    key: 'speed',
    icon: () => h('i', { class: 'ri-speed-line' }),
    // 如果播放速度不是1.0，添加标记
    suffix: () =>
      playbackRate.value !== 1.0
        ? h('span', { class: 'active-option-mark' }, `${playbackRate.value}x`)
        : null
  }
]);

// 处理菜单选择
const handleSelect = (key: string) => {
  // 先关闭所有弹窗
  showEQModal.value = false;
  playerStore.showSleepTimer = false;
  showSpeedModal.value = false;
  showAudioEffectsModal.value = false;

  // 然后仅打开所选弹窗
  switch (key) {
    case 'eq':
      showEQModal.value = true;
      break;
    case 'effects':
      showAudioEffectsModal.value = true;
      break;
    case 'timer':
      playerStore.showSleepTimer = true;
      break;
    case 'speed':
      showSpeedModal.value = true;
      break;
  }
};

// 选择播放速度
const selectSpeed = (speed: number) => {
  playerStore.setPlaybackRate(speed);
};
</script>

<style lang="scss" scoped>
.sleep-timer-countdown {
  @apply fixed top-0 left-1/2 transform -translate-x-1/2 py-1 px-3 rounded-b-lg text-white text-sm flex items-center;
  background-color: var(--qqm-primary, #22c55e);
  box-shadow: none;
  z-index: 9998;
  min-width: 80px;
  text-align: center;
  animation: fadeInDown 0.22s var(--qqm-ease, ease-out);

  @keyframes fadeInDown {
    from {
      transform: translate(-50%, -100%);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }

  span {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
    font-weight: 500;
  }
}

.advanced-controls-btn {
  @apply cursor-pointer mx-2 relative;
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 10px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;

  .iconfont {
    @apply text-xl transition;
  }

  &:hover {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 7%, var(--qqm-surface));
    color: var(--qqm-primary, #22c55e);
  }

  .active-indicator {
    @apply absolute -top-1 -right-1 flex;

    .timer-badge,
    .speed-badge {
      @apply flex items-center justify-center text-xs text-white rounded-md;
      background-color: var(--qqm-primary, #22c55e);
      height: 16px;
      min-width: 16px;
      padding: 0 3px;
      font-weight: 600;
      font-size: 10px;

      i {
        font-size: 10px;
      }
    }

    .timer-badge + .speed-badge {
      @apply -ml-2 z-10;
    }
  }
}

.eq-modal-content,
.effects-modal-content,
.timer-modal-content,
.speed-modal-content {
  @apply p-6;
  border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(20, 24, 31, 0.08)) 78%, #fff 22%);
  border-radius: 12px;
  background: color-mix(in srgb, var(--qqm-surface, #fff) 92%, transparent);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--qqm-text, #1f2329) 7%, transparent);
  backdrop-filter: blur(14px) saturate(1.12);
  max-width: 600px;
  margin: 0 auto;
}

.eq-modal-content {
  @apply p-10 max-w-[800px];
}

.speed-modal-content {
  h3 {
    @apply text-lg font-medium mb-4 text-center;
  }

  .speed-controls {
    @apply my-8 mx-4;
  }
  .speed-options {
    @apply flex flex-wrap justify-center gap-2;
  }
  .speed-slider {
    @apply mt-4;
  }
  .speed-option {
    @apply cursor-pointer transition-colors;
    min-width: 68px;
    padding: 8px 14px;
    border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
    border-radius: 10px;
    background: var(--qqm-surface);
    &:hover {
      background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 10%, transparent);
    }
  }
  .speed-option.active {
    background-color: var(--qqm-primary, #22c55e);
    color: white;
  }
}

.active-option-mark {
  @apply ml-2 text-xs text-white py-0.5 px-1.5 rounded-md;
  background-color: var(--qqm-primary, #22c55e);
  font-weight: 500;
}

.modal-close {
  @apply absolute top-4 right-4 cursor-pointer;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  &:hover {
    color: var(--qqm-primary, #22c55e);
  }
  i {
    @apply text-2xl;
  }
}
</style>
