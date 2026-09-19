<template>
  <n-dropdown
    v-if="isDesktopRuntime && hasSong && isKuwoSong"
    trigger="click"
    :options="qualityOptions"
    :z-index="9999999"
    @select="handleQualitySelect"
  >
    <button
      class="song-download-button"
      :class="[`song-download-button--${size}`, buttonClass]"
      :title="title"
      type="button"
      @click.stop
    >
      <i class="ri-download-line"></i>
    </button>
  </n-dropdown>

  <button
    v-else-if="isDesktopRuntime && hasSong"
    class="song-download-button"
    :class="[`song-download-button--${size}`, buttonClass]"
    :title="title"
    type="button"
    @click.stop="handleDefaultDownload"
  >
    <i class="ri-download-line"></i>
  </button>
</template>

<script setup lang="ts">
import { NDropdown } from 'naive-ui';
import { computed, h } from 'vue';

import type { SongResult } from '@/types/music';
import { isDesktopRuntime } from '@/utils';
import { DOWNLOAD_QUALITY_OPTIONS } from '@/utils/downloadQuality';

const props = withDefaults(
  defineProps<{
    item?: SongResult | null;
    size?: 'small' | 'medium';
    buttonClass?: string;
    title?: string;
  }>(),
  {
    item: null,
    size: 'medium',
    buttonClass: '',
    title: '下载歌曲'
  }
);

const hasSong = computed(() => Boolean(props.item?.id));
const isKuwoSong = computed(() => props.item?.source === 'kuwo');

const loadDownloadModule = async () => {
  const [{ useDownload }, { DOWNLOAD_QUALITY_OPTIONS, getDefaultDownloadQuality }] =
    await Promise.all([import('@/hooks/useDownload'), import('@/utils/downloadQuality')]);
  return {
    downloadMusic: useDownload().downloadMusic,
    qualityOptions: DOWNLOAD_QUALITY_OPTIONS,
    getDefaultDownloadQuality
  };
};

const qualityOptions = computed(() =>
  DOWNLOAD_QUALITY_OPTIONS.map((item) => ({
    label: `${item.label} · ${item.description}`,
    key: item.key,
    icon: () => h('i', { class: item.extension === 'flac' ? 'ri-disc-line' : 'ri-music-2-line' })
  }))
);

const handleQualitySelect = async (quality: string | number) => {
  if (!props.item) return;
  const { downloadMusic } = await loadDownloadModule();
  void downloadMusic(props.item, String(quality));
};

const handleDefaultDownload = async () => {
  if (!props.item) return;
  const { downloadMusic, getDefaultDownloadQuality } = await loadDownloadModule();
  void downloadMusic(props.item, getDefaultDownloadQuality().key);
};
</script>

<style lang="scss" scoped>
.song-download-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--qqm-muted, #8a9099) 34%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--qqm-muted, #8a9099);
  cursor: pointer;
  transition:
    background-color 180ms var(--qqm-ease, ease),
    border-color 180ms var(--qqm-ease, ease),
    color 180ms var(--qqm-ease, ease),
    transform 180ms var(--qqm-ease, ease);

  &:hover {
    border-color: var(--qqm-primary, #22c55e);
    color: var(--qqm-primary-strong, #0dbd62);
    background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, transparent);
    transform: translateY(-1px);
  }

  &--small {
    width: 34px;
    height: 34px;
    font-size: 17px;
  }

  &--medium {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }
}
</style>
