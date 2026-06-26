<template>
  <div>
    <setting-section :title="t('settings.sections.playback')">
      <setting-item
        :title="t('settings.playback.quality')"
        :description="t('settings.playback.qualityDesc')"
      >
        <s-select
          v-model="setData.musicQuality"
          :options="qualityOptions"
          width="w-40 max-md:w-full"
        />
      </setting-item>

      <setting-item v-if="isElectron" :title="t('settings.playback.musicSources')">
        <template #description>
          <div class="flex items-center gap-2">
            <n-switch v-model:value="setData.enableMusicUnblock">
              <template #checked>{{ t('common.on') }}</template>
              <template #unchecked>{{ t('common.off') }}</template>
            </n-switch>
            <span>{{ t('settings.playback.musicUnblockEnableDesc') }}</span>
          </div>
          <div v-if="setData.enableMusicUnblock" class="mt-2 text-sm">
            <span class="text-neutral-500">{{ t('settings.playback.selectedMusicSources') }}</span>
            <span v-if="musicSources.length > 0" class="text-neutral-400">{{
              musicSources.join(', ')
            }}</span>
            <span v-else class="text-neutral-400 text-xs">{{
              t('settings.playback.noMusicSources')
            }}</span>
          </div>
        </template>
        <s-btn :disabled="!setData.enableMusicUnblock" @click="showMusicSourcesModal = true">
          {{ t('settings.playback.configureMusicSources') }}
        </s-btn>
      </setting-item>

      <setting-item
        v-if="platform === 'darwin'"
        :title="t('settings.playback.showStatusBar')"
        :description="t('settings.playback.showStatusBarContent')"
      >
        <n-switch v-model:value="setData.showTopAction">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        :title="t('settings.playback.autoPlay')"
        :description="t('settings.playback.autoPlayDesc')"
      >
        <n-switch v-model:value="setData.autoPlay">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        :title="t('settings.playback.playbackFade')"
        :description="t('settings.playback.playbackFadeDesc')"
      >
        <n-switch v-model:value="setData.enablePlaybackFade">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="isElectron"
        :title="t('settings.playback.audioDevice')"
        :description="t('settings.playback.audioDeviceDesc')"
      >
        <audio-device-settings />
      </setting-item>
    </setting-section>

    <div class="playback-panel mt-6 p-4 rounded-lg">
      <div class="text-sm font-medium text-neutral-500 mb-3">支持正版</div>
      <div class="text-base text-neutral-900 dark:text-neutral-100 mb-4">
        大家还是需要支持正版，本软件只做开源探讨。各大音乐会员购买链接：
      </div>
      <div class="flex gap-3 flex-wrap">
        <a
          v-for="link in memberLinks"
          :key="link.url"
          class="playback-action px-4 py-2 rounded-lg text-primary hover:text-primary transition-colors"
          :href="link.url"
          target="_blank"
        >
          {{ link.name }} <i class="ri-external-link-line ml-1"></i>
        </a>
      </div>
    </div>

    <music-source-settings
      v-if="isElectron"
      v-model:show="showMusicSourcesModal"
      v-model:sources="musicSources"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AudioDeviceSettings from '@/components/settings/AudioDeviceSettings.vue';
import MusicSourceSettings from '@/components/settings/MusicSourceSettings.vue';
import { type Platform } from '@/types/music';
import { isElectron } from '@/utils';

import { SETTINGS_DATA_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const ALL_PLATFORMS: Platform[] = ['kuwo', 'migu', 'kugou', 'pyncmd', 'ytmusic', 'piped'];

const memberLinks = [
  { name: '网易云音乐会员', url: 'https://music.163.com/store/vip' },
  { name: 'QQ音乐会员', url: 'https://y.qq.com/portal/vipportal/' },
  { name: '酷狗音乐会员', url: 'https://vip.kugou.com/' }
];

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;
const platform = window.electron ? window.electron.ipcRenderer.sendSync('get-platform') : 'web';

const showMusicSourcesModal = ref(false);

const qualityOptions = computed(() => [
  { label: t('settings.playback.qualityOptions.standard'), value: 'standard' },
  { label: t('settings.playback.qualityOptions.higher'), value: 'higher' },
  { label: t('settings.playback.qualityOptions.exhigh'), value: 'exhigh' },
  { label: t('settings.playback.qualityOptions.lossless'), value: 'lossless' },
  { label: t('settings.playback.qualityOptions.hires'), value: 'hires' },
  { label: t('settings.playback.qualityOptions.jyeffect'), value: 'jyeffect' },
  { label: t('settings.playback.qualityOptions.sky'), value: 'sky' },
  { label: t('settings.playback.qualityOptions.dolby'), value: 'dolby' },
  { label: t('settings.playback.qualityOptions.jymaster'), value: 'jymaster' }
]);

const musicSources = computed({
  get: () => {
    if (!setData.value.enabledMusicSources) return ALL_PLATFORMS;
    return setData.value.enabledMusicSources as Platform[];
  },
  set: (newValue: Platform[]) => {
    // 根因：桌面端播放最终按 enabledMusicSources 顺序调用解析器，旧配置或界面操作
    // 把酷我移除/后置后，会导致“默认酷我音源”失效。这里在设置入口统一兜正顺序，
    // 保证用户不需要理解音源优先级也能默认走酷我，失败后再进入其它本地解析。
    const baseValues = newValue.length > 0 ? newValue : ALL_PLATFORMS;
    const valuesToSet = [...new Set(['kuwo', ...baseValues.filter((source) => source !== 'kuwo')])];
    setData.value = { ...setData.value, enabledMusicSources: valuesToSet };
  }
});
</script>
