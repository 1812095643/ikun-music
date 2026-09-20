<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import SheetFrame from '@/components/SheetFrame.vue';
import {
  checkForAppUpdate,
  supportsAppUpdate,
  updateInfo,
  updateProgress,
  updateStatus
} from '@/services/appUpdate';
import {
  getBackgroundPlaybackGuide,
  openBackgroundPlaybackSettings
} from '@/services/backgroundPlayback';
import { qualities } from '@/services/musicApi';
import {
  type PlaybackNotificationStatus,
  playbackNotificationStatus,
  requestPlaybackNotifications
} from '@/services/playbackNotifications';
import { openReleaseDownloads } from '@/services/releases';
import {
  detectedMode,
  type DisplayMode,
  displayMode,
  modeNames,
  setDisplayMode
} from '@/stores/device';
import { lyricFontSize, setLyricFontSize, setTheme, theme } from '@/stores/library';
import { mode, quality, setMode } from '@/stores/player';

import { version } from '../../package.json';
const emit = defineEmits<{ quality: [] }>();
const appearance = shallowRef(false);
const modeSettings = shallowRef(false);
const lyricSettings = shallowRef(false);
const displaySettings = shallowRef(false);
const backgroundSettings = shallowRef(false);
const notificationSettings = shallowRef(false);
const notificationStatus = shallowRef<PlaybackNotificationStatus | null>(
  playbackNotificationStatus()
);
function showNotificationSettings() {
  notificationStatus.value = playbackNotificationStatus();
  notificationSettings.value = true;
}
const backgroundGuide = getBackgroundPlaybackGuide();
const appUpdateSupported = supportsAppUpdate();
const qualityLabel = computed(
  () => qualities.find((item) => item.key === quality.value)?.label || '高品质'
);
const fontLabel = computed(() =>
  lyricFontSize.value <= 22 ? '标准' : lyricFontSize.value >= 30 ? '大字' : '舒适'
);
</script>
<template>
  <scroll-view scroll-y class="content-scroll"
    ><view class="settings-group-label">播放</view
    ><view class="settings-group"
      ><button role="button" class="settings-row" @click="emit('quality')">
        <text>播放音质</text><text class="settings-value">{{ qualityLabel }}</text
        ><text class="ri-arrow-right-s-line" /></button
      ><button role="button" class="settings-row" @click="modeSettings = true">
        <text>播放方式</text
        ><text class="settings-value">{{
          { sequence: '顺序播放', repeat: '单曲循环', shuffle: '随机播放' }[mode]
        }}</text
        ><text class="ri-arrow-right-s-line" /></button
      ><button
        v-if="notificationStatus"
        role="button"
        class="settings-row"
        @click="showNotificationSettings"
      >
        <text>通知栏与锁屏播放</text><text class="settings-value">系统播放卡片</text
        ><text class="ri-arrow-right-s-line" /></button
      ><button
        v-if="backgroundGuide"
        role="button"
        class="settings-row"
        @click="backgroundSettings = true"
      >
        <text>后台播放设置</text><text class="settings-value">{{ backgroundGuide.brand }}</text
        ><text class="ri-arrow-right-s-line" /></button></view
    ><view class="settings-group-label">外观与歌词</view
    ><view class="settings-group"
      ><button role="button" class="settings-row" @click="appearance = true">
        <text>界面外观</text
        ><text class="settings-value">{{ theme === 'light' ? '浅色' : '深色' }}</text
        ><text class="ri-arrow-right-s-line" /></button
      ><button role="button" class="settings-row" @click="lyricSettings = true">
        <text>歌词字号</text><text class="settings-value">{{ fontLabel }}</text
        ><text class="ri-arrow-right-s-line" /></button></view
    ><view class="settings-group-label">设备与显示</view
    ><view class="settings-group">
      <button role="button" class="settings-row" @click="displaySettings = true">
        <text>显示模式</text><text class="settings-value">{{ modeNames[displayMode] }}</text
        ><text class="ri-arrow-right-s-line" />
      </button> </view
    ><view class="settings-note"
      >当前识别为{{
        modeNames[detectedMode]
      }}。横竖屏会自动重排；未正确识别的车机可手动选择。设置会保存在本机。</view
    ><view class="settings-group-label">版本与下载</view>
    <view class="settings-group">
      <button
        v-if="appUpdateSupported"
        role="button"
        class="settings-row"
        @click="checkForAppUpdate(true)"
      >
        <text>检查更新</text
        ><text class="settings-value">{{
          updateStatus === 'downloading'
            ? `下载中 ${updateProgress}%`
            : updateStatus === 'checking'
              ? '正在检查…'
              : updateInfo
                ? `发现 ${updateInfo.version}`
                : `当前 ${version}`
        }}</text>
        <text class="ri-arrow-right-s-line" />
      </button>
      <button role="button" class="settings-row" @click="openReleaseDownloads">
        <text>下载桌面版</text><text class="settings-value">Windows</text>
        <text class="ri-arrow-right-s-line" />
      </button>
      <button role="button" class="settings-row" @click="openReleaseDownloads">
        <text>所有版本下载</text><text class="settings-value">GitHub 发行版</text>
        <text class="ri-arrow-right-s-line" />
      </button>
    </view>
    <view class="settings-about"
      ><image src="/static/brand.png" /><text class="about-name">ikun 音乐</text
      ><text class="about-version">{{ version }}</text
      ><text class="about-motto">让生活充满音乐</text></view
    ></scroll-view
  ><sheet-frame
    v-if="notificationSettings && notificationStatus"
    title="通知栏与锁屏播放"
    @close="notificationSettings = false"
  >
    <view class="settings-note"
      >播放音乐时，系统播放卡片会同步歌名、歌手、封面和播放进度，可暂停及切换歌曲。</view
    >
    <view class="settings-note">{{
      notificationStatus.published
        ? '当前播放信息已提交给系统。'
        : notificationStatus.sessionActive
          ? '播放服务已连接，开始播放后同步系统卡片。'
          : '播放一首歌曲后，自动连接系统播放卡片。'
    }}</view>
    <view
      v-if="
        notificationStatus.notificationsEnabled === false ||
        notificationStatus.channelEnabled === false
      "
      class="settings-note"
      >系统通知或“音乐播放”类别被关闭。若下拉栏没有显示，请打开通知和锁屏显示。</view
    >
    <view class="settings-note"
      >澎湃和 OriginOS
      的控制中心、锁屏可能还有独立的媒体卡片开关；可在系统通知设置中调整。这里的设置不影响 App
      内听歌。</view
    >
    <button role="button" class="sheet-row" @click="requestPlaybackNotifications(true)">
      <text>打开播放通知设置</text><text class="sheet-row-end ri-arrow-right-s-line" />
    </button> </sheet-frame
  ><sheet-frame
    v-if="backgroundSettings && backgroundGuide"
    title="后台播放设置"
    @close="backgroundSettings = false"
  >
    <view class="settings-note">如果锁屏或切到其他应用后仍然停播，可以调整系统的后台限制。</view>
    <view class="settings-note"
      >{{ backgroundGuide.detail }}不同系统版本的选项名称可能略有不同。</view
    >
    <view class="settings-note">也可在最近任务中锁定 ikun音乐，减少一键清理造成的中断。</view>
    <button role="button" class="sheet-row" @click="openBackgroundPlaybackSettings()">
      <text>打开应用设置</text><text class="sheet-row-end ri-arrow-right-s-line" />
    </button>
    <button role="button" class="sheet-row" @click="openBackgroundPlaybackSettings(true)">
      <text>打开电池优化设置</text><text class="sheet-row-end ri-arrow-right-s-line" />
    </button> </sheet-frame
  ><sheet-frame v-if="displaySettings" title="显示模式" @close="displaySettings = false">
    <button
      v-for="(label, key) in modeNames"
      :key="key"
      role="button"
      class="sheet-row"
      @click="
        setDisplayMode(key as DisplayMode);
        displaySettings = false;
      "
    >
      <text>{{ label }}</text
      ><text v-if="displayMode === key" class="sheet-row-end ri-check-line" />
    </button> </sheet-frame
  ><sheet-frame v-if="appearance" title="界面外观" @close="appearance = false"
    ><view class="appearance-options"
      ><button
        v-for="item in [
          { key: 'light', label: '浅色' },
          { key: 'dark', label: '深色' }
        ]"
        :key="item.key"
        role="button"
        :class="['appearance-option', item.key, { selected: theme === item.key }]"
        @click="setTheme(item.key as typeof theme)"
      >
        <view class="theme-preview"
          ><view class="theme-preview-heading" /><view class="theme-preview-picture" /><view
            class="theme-preview-line" /><view class="theme-preview-line short" /><view
            class="theme-preview-bar" /></view
        ><view class="appearance-caption"
          ><text>{{ item.label }}</text
          ><text
            :class="
              theme === item.key ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'
            "
        /></view></button></view></sheet-frame
  ><sheet-frame v-if="lyricSettings" title="歌词字号" @close="lyricSettings = false"
    ><view class="lyric-preview"
      ><text :style="{ fontSize: `calc(${lyricFontSize}px + var(--font-size-adjustment))` }"
        >让生活充满音乐</text
      ><text class="lyric-preview-caption">歌词预览</text></view
    ><view class="font-options"
      ><button
        v-for="item in [
          { size: 22, label: '标准' },
          { size: 26, label: '舒适' },
          { size: 30, label: '大字' }
        ]"
        :key="item.size"
        role="button"
        :class="{ selected: lyricFontSize === item.size }"
        @click="setLyricFontSize(item.size)"
      >
        {{ item.label }}
      </button></view
    ></sheet-frame
  ><sheet-frame v-if="modeSettings" title="播放方式" @close="modeSettings = false"
    ><button
      v-for="item in [
        { key: 'sequence', label: '顺序播放', icon: 'ri-order-play-line' },
        { key: 'shuffle', label: '随机播放', icon: 'ri-shuffle-line' },
        { key: 'repeat', label: '单曲循环', icon: 'ri-repeat-one-line' }
      ]"
      :key="item.key"
      role="button"
      class="sheet-row"
      @click="
        setMode(item.key as typeof mode);
        modeSettings = false;
      "
    >
      <text :class="['sheet-row-icon', item.icon]" /><text>{{ item.label }}</text
      ><text
        v-if="mode === item.key"
        class="sheet-row-end ri-check-line"
        style="color: var(--qqm-accent-text)"
      /></button
  ></sheet-frame>
</template>
<style scoped>
.settings-group-label {
  padding: 20px 24px 10px;
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.settings-group {
  background: var(--qqm-surface);
  border-radius: 14px;
  margin: 0 20px;
  overflow: hidden;
}
.settings-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 21px 17px !important;
  min-height: 65px;
  font-size: calc(16px + var(--font-size-adjustment)) !important;
  text-align: left;
}
.settings-row + .settings-row {
  position: relative;
}
.settings-row + .settings-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 17px;
  right: 17px;
  height: 1px;
  background: var(--qqm-border);
}
.settings-value {
  margin-left: auto;
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.settings-row > .ri-arrow-right-s-line {
  font-size: 20px;
  color: var(--qqm-muted);
}
.settings-note {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  padding: 16px 24px;
}
.settings-about {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px 28px;
  gap: 9px;
}
.settings-about image {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  margin-bottom: 3px;
}
.about-name {
  font-size: calc(15px + var(--font-size-adjustment));
  font-weight: 600;
}
.about-version {
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
}
.about-motto {
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  letter-spacing: 2px;
  margin-top: 6px;
}
.appearance-options {
  display: flex;
  gap: 20px;
  padding: 10px 24px 18px;
}
.appearance-option {
  flex: 1;
  min-width: 0;
}
.theme-preview {
  height: 166px;
  border-radius: 13px;
  background: #f1f5f3;
  padding: 18px 14px;
  position: relative;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.dark .theme-preview {
  background: #17201b;
}
.theme-preview-heading {
  width: 44%;
  height: 7px;
  background: #6e8477;
  border-radius: 3px;
}
.theme-preview-picture {
  height: 47px;
  background: #b3d5be;
  border-radius: 8px;
  margin: 16px 0 13px;
}
.dark .theme-preview-picture {
  background: #3f6b50;
}
.theme-preview-line {
  height: 5px;
  background: #c5d2c9;
  border-radius: 3px;
  width: 87%;
  margin-top: 8px;
}
.dark .theme-preview-line {
  background: #506257;
}
.theme-preview-line.short {
  width: 59%;
}
.theme-preview-bar {
  height: 13px;
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 15px;
  background: #dfe9e2;
  border-radius: 4px;
}
.dark .theme-preview-bar {
  background: #2b3c31;
}
.appearance-caption {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 9px;
  padding: 15px 0 0;
  font-size: calc(14px + var(--font-size-adjustment));
}
.appearance-caption > text:last-child {
  font-size: 19px;
  color: var(--qqm-muted);
}
.selected .appearance-caption > text:last-child {
  color: var(--qqm-primary-strong);
}
.selected .theme-preview {
  box-shadow: 0 0 0 2px var(--qqm-primary);
}
.lyric-preview {
  margin: 8px 22px 20px;
  min-height: 128px;
  background: #183426;
  border-radius: 14px;
  color: #f2fff4;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  text-align: center;
  font-weight: 600;
}
.lyric-preview-caption {
  font-size: calc(11px + var(--font-size-adjustment));
  color: #a5bcae;
  font-weight: 400;
}
.font-options {
  display: flex;
  gap: 12px;
  padding: 0 22px 15px;
}
.font-options button {
  flex: 1;
  padding: 12px 0 !important;
  background: var(--qqm-surface-muted) !important;
  border-radius: 12px !important;
  font-size: calc(14px + var(--font-size-adjustment)) !important;
}
.font-options button.selected {
  background: var(--qqm-primary-soft) !important;
  color: var(--qqm-accent-text) !important;
}
</style>
