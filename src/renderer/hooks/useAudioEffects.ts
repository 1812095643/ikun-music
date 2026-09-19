import { onMounted, onUnmounted, shallowRef } from 'vue';

import { audioService } from '@/services/audioService';

export const useAudioEffects = () => {
  const state = shallowRef(audioService.getEffectsState());
  const refresh = () => {
    state.value = audioService.getEffectsState();
  };
  onMounted(() => {
    audioService.on('effects-change', refresh);
    audioService.on('load', refresh);
    refresh();
  });
  onUnmounted(() => {
    audioService.off('effects-change', refresh);
    audioService.off('load', refresh);
  });
  return state;
};
