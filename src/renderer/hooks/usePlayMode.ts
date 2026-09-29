import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store/modules/player';

import { desktopPlaybackMode, playbackModeInfo } from '../../shared/playbackMode';

/**
 * 播放模式相关的 Hook
 * 提供播放模式的图标、文本和切换功能
 */
export function usePlayMode() {
  const { t } = useI18n();
  const playerStore = usePlayerStore();

  // 当前播放模式
  const playMode = computed(() => playerStore.playMode);

  // 播放模式图标（心动模式已移至 SearchBar，不参与循环切换）
  const playModeIcon = computed(() => playbackModeInfo(desktopPlaybackMode(playMode.value)).icon);

  // 播放模式文本
  const playModeText = computed(() => t(`player.playMode.${desktopPlaybackMode(playMode.value)}`));

  // 切换播放模式
  const togglePlayMode = () => {
    playerStore.togglePlayMode();
  };

  return {
    playMode,
    playModeIcon,
    playModeText,
    togglePlayMode
  };
}
