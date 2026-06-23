import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { LyricCandidate, LyricCandidateResult } from '@/types/music';

export const useLyricStore = defineStore('lyric', () => {
  const lyric = ref({});
  const candidates = ref<LyricCandidate[]>([]);
  const activeCandidateKey = ref('');
  const loading = ref(false);
  const errorMessage = ref('');

  const setLyric = (newLyric: any) => {
    lyric.value = newLyric;
  };

  const activeCandidate = computed(
    () => candidates.value.find((item) => item.key === activeCandidateKey.value) || null
  );

  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  const setErrorMessage = (message: string) => {
    errorMessage.value = message;
  };

  const setCandidateResult = (result: LyricCandidateResult) => {
    candidates.value = result.candidates;
    activeCandidateKey.value = result.activeCandidate?.key || '';
    lyric.value = result.activeCandidate?.lyric || {};
    errorMessage.value = result.candidates.length > 0 ? '' : '没有匹配到可用歌词';
  };

  const selectCandidate = (key: string) => {
    const nextCandidate = candidates.value.find((item) => item.key === key);
    if (!nextCandidate) return null;
    activeCandidateKey.value = key;
    lyric.value = nextCandidate.lyric;
    errorMessage.value = '';
    return nextCandidate;
  };

  const clearCandidates = () => {
    candidates.value = [];
    activeCandidateKey.value = '';
    lyric.value = {};
    errorMessage.value = '';
    loading.value = false;
  };

  return {
    lyric,
    candidates,
    activeCandidateKey,
    activeCandidate,
    loading,
    errorMessage,
    setLyric,
    setLoading,
    setErrorMessage,
    setCandidateResult,
    selectCandidate,
    clearCandidates
  };
});
