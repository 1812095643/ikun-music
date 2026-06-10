<template>
  <Teleport to="body">
    <Transition name="settings-drawer">
      <div
        v-if="visible"
        class="mobile-player-settings fixed inset-0 z-[99999] flex items-end justify-center"
        @click.self="close"
      >
        <!-- 遮罩层 -->
        <div class="absolute inset-0 bg-black/30" @click="close"></div>

        <!-- 弹窗内容 -->
        <div
          class="mobile-player-settings-panel relative w-full max-w-lg rounded-t-lg overflow-hidden max-h-[85vh] flex flex-col"
        >
          <!-- 顶部拖拽条 -->
          <div class="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div class="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
          </div>

          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-5 pb-4 flex-shrink-0">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
              {{ t('player.settings.title') }}
            </h2>
            <button
              @click="close"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-primary/5 hover:text-primary dark:text-neutral-400 dark:hover:bg-primary/10"
            >
              <i class="ri-close-line text-xl"></i>
            </button>
          </div>

          <!-- 内容区域 -->
          <div
            class="flex-1 overflow-y-auto px-5 pb-6"
            :style="{ paddingBottom: `calc(24px + var(--safe-area-inset-bottom, 0px))` }"
          >
            <!-- 播放速度 -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  {{ t('player.settings.playbackSpeed') }}
                </span>
                <span class="text-sm text-primary font-medium">{{ playbackRate }}x</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in speedOptions"
                  :key="option"
                  @click="setSpeed(option)"
                  class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="
                    playbackRate === option
                      ? 'bg-primary text-white'
                      : 'mobile-setting-chip text-neutral-600 hover:text-primary dark:text-neutral-300'
                  "
                >
                  {{ option }}x
                </button>
              </div>
            </div>

            <!-- 分隔线 -->
            <div class="mobile-setting-divider h-px my-5"></div>

            <!-- 定时关闭 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  {{ t('player.sleepTimer.title') }}
                </span>
                <span v-if="hasTimerActive" class="text-sm text-primary font-medium">
                  {{ timerStatusText }}
                </span>
              </div>

              <!-- 已激活状态 -->
              <div v-if="hasTimerActive" class="space-y-3">
                <div class="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <i class="ri-timer-line text-primary text-xl"></i>
                      <span class="text-primary">
                        {{ timerDisplayText }}
                      </span>
                    </div>
                    <button
                      @click="cancelTimer"
                      class="px-3 py-1 rounded-lg text-sm mobile-setting-chip text-neutral-600 hover:text-primary dark:text-neutral-300"
                    >
                      {{ t('player.sleepTimer.cancel') }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- 未激活状态 - 设置选项 -->
              <div v-else class="space-y-4">
                <!-- 按时间 -->
                <div>
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 mb-2">
                    {{ t('player.sleepTimer.timeMode') }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="minutes in [15, 30, 60, 90]"
                      :key="minutes"
                      @click="setTimeTimer(minutes)"
                      class="px-4 py-2 rounded-lg text-sm font-medium mobile-setting-chip text-neutral-600 hover:text-primary dark:text-neutral-300"
                    >
                      {{ minutes }}{{ t('player.sleepTimer.minutes') }}
                    </button>
                  </div>
                  <!-- 自定义时间 -->
                  <div class="flex items-center gap-2 mt-3">
                    <div
                      class="mobile-setting-input flex items-center flex-1 rounded-lg overflow-hidden"
                    >
                      <button
                        @click="decreaseMinutes"
                        class="w-10 h-10 flex items-center justify-center text-neutral-500 hover:bg-primary/5 hover:text-primary active:bg-primary/10 dark:text-neutral-400"
                      >
                        <i class="ri-subtract-line text-lg"></i>
                      </button>
                      <input
                        v-model="customMinutes"
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        placeholder="分钟"
                        class="flex-1 px-2 py-2 text-sm text-center bg-transparent text-neutral-700 border-0 outline-none placeholder-neutral-400 dark:text-neutral-200"
                        @input="handleMinutesInput"
                      />
                      <button
                        @click="increaseMinutes"
                        class="w-10 h-10 flex items-center justify-center text-neutral-500 hover:bg-primary/5 hover:text-primary active:bg-primary/10 dark:text-neutral-400"
                      >
                        <i class="ri-add-line text-lg"></i>
                      </button>
                    </div>
                    <button
                      @click="setCustomTimeTimer"
                      :disabled="!customMinutes || Number(customMinutes) < 1"
                      class="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{ t('player.sleepTimer.set') }}
                    </button>
                  </div>
                </div>

                <!-- 按歌曲数 -->
                <div>
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 mb-2">
                    {{ t('player.sleepTimer.songsMode') }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="songs in [1, 3, 5, 10]"
                      :key="songs"
                      @click="setSongsTimer(songs)"
                      class="px-4 py-2 rounded-lg text-sm font-medium mobile-setting-chip text-neutral-600 hover:text-primary dark:text-neutral-300"
                    >
                      {{ songs }}{{ t('player.sleepTimer.songs') }}
                    </button>
                  </div>
                </div>

                <!-- 播放列表结束 -->
                <button
                  @click="setPlaylistEndTimer"
                  class="w-full py-3 rounded-lg text-sm font-medium mobile-setting-chip text-neutral-600 hover:text-primary dark:text-neutral-300"
                >
                  {{ t('player.sleepTimer.playlistEnd') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store/modules/player';

const { t } = useI18n();
const playerStore = usePlayerStore();
const { sleepTimer, playbackRate } = storeToRefs(playerStore);

// Props & Emits
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

// 播放速度选项
const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// 自定义时间
const customMinutes = ref<number | string>(30);

// 定时器相关
const refreshTrigger = ref(0);
let timerInterval: number | null = null;

const hasTimerActive = computed(() => playerStore.hasSleepTimerActive);

const timerStatusText = computed(() => {
  if (sleepTimer.value.type === 'time') return t('player.sleepTimer.timeMode');
  if (sleepTimer.value.type === 'songs') return t('player.sleepTimer.songsMode');
  if (sleepTimer.value.type === 'end') return t('player.sleepTimer.afterPlaylist');
  return '';
});

const timerDisplayText = computed(() => {
  void refreshTrigger.value;

  if (sleepTimer.value.type === 'time' && sleepTimer.value.endTime) {
    const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (sleepTimer.value.type === 'songs') {
    return t('player.sleepTimer.songsRemaining', { count: sleepTimer.value.remainingSongs || 0 });
  }

  if (sleepTimer.value.type === 'end') {
    return t('player.sleepTimer.afterPlaylist');
  }

  return '';
});

// 方法
const close = () => {
  emit('update:visible', false);
};

const setSpeed = (speed: number) => {
  playerStore.setPlaybackRate(speed);
};

const setTimeTimer = (minutes: number) => {
  playerStore.setSleepTimerByTime(minutes);
};

const setCustomTimeTimer = () => {
  const minutes =
    typeof customMinutes.value === 'number'
      ? customMinutes.value
      : parseInt(String(customMinutes.value) || '0', 10);
  if (minutes >= 1) {
    playerStore.setSleepTimerByTime(minutes);
    customMinutes.value = 30;
  }
};

const increaseMinutes = () => {
  const current = Number(customMinutes.value) || 0;
  customMinutes.value = Math.min(300, current + 1);
};

const decreaseMinutes = () => {
  const current = Number(customMinutes.value) || 0;
  customMinutes.value = Math.max(1, current - 1);
};

const handleMinutesInput = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const value = input.value.replace(/[^0-9]/g, '');
  if (value) {
    customMinutes.value = Math.min(300, Math.max(1, parseInt(value, 10)));
  } else {
    customMinutes.value = '';
  }
};

const setSongsTimer = (songs: number) => {
  playerStore.setSleepTimerBySongs(songs);
};

const setPlaylistEndTimer = () => {
  playerStore.setSleepTimerAtPlaylistEnd();
};

const cancelTimer = () => {
  playerStore.clearSleepTimer();
};

// 定时刷新倒计时
const startTimerUpdate = () => {
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    refreshTrigger.value = Date.now();
  }, 500);
};

const stopTimerUpdate = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

watch(
  () => [hasTimerActive.value, sleepTimer.value.type],
  ([active, type]) => {
    if (active && type === 'time') {
      startTimerUpdate();
    } else {
      stopTimerUpdate();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (hasTimerActive.value && sleepTimer.value.type === 'time') {
    startTimerUpdate();
  }
});

onUnmounted(() => {
  stopTimerUpdate();
});
</script>

<style scoped>
/* 弹窗动画 */
.settings-drawer-enter-active,
.settings-drawer-leave-active {
  transition: opacity 0.18s ease;
}

.settings-drawer-enter-active > div:last-child,
.settings-drawer-leave-active > div:last-child {
  transition: transform 0.18s ease;
}

.settings-drawer-enter-from,
.settings-drawer-leave-to {
  opacity: 0;
}

.settings-drawer-enter-from > div:last-child,
.settings-drawer-leave-to > div:last-child {
  transform: translateY(16px);
}

.mobile-player-settings-panel,
.mobile-setting-chip,
.mobile-setting-input {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.mobile-player-settings-panel {
  border-bottom: 0;
}

.mobile-setting-chip:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}

.mobile-setting-divider {
  background: var(--qqm-border);
}
</style>
