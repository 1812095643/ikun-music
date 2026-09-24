<script setup lang="ts">
import { usePlaylistImport } from '@/composables/usePlaylistImport';
const {
  text,
  name,
  working,
  completed,
  results,
  selected,
  visibleResults,
  shown,
  detectedShareUrl,
  unsupportedShareUrl,
  sharePlaylist,
  selectedShareIndexes,
  selectedShareCount,
  allShareSelected,
  shareSongs,
  shareTitle,
  sharePlatformLabel,
  shareFilteredCount,
  visibleShareSongs,
  shareShown,
  shareLoading,
  shareError,
  paste,
  identify,
  toggle,
  toggleShare,
  toggleAllShare,
  showMoreShareSongs,
  retrySharePreview,
  importSelected,
  stop
} = usePlaylistImport();
</script>
<template>
  <scroll-view scroll-y class="content-scroll import-page">
    <view class="import-form">
      <text class="import-title">把文字变成歌单</text>
      <text class="import-description">
        支持粘贴 QQ 音乐、网易云、酷我分享链接自动预览，也可粘贴歌名列表识别。
      </text>
      <input v-model="name" class="field-input" placeholder="歌单名称" :maxlength="40" />
      <textarea
        v-model="text"
        :maxlength="-1"
        class="import-input"
        placeholder="粘贴从手机传来的歌单文字或歌单分享链接"
      />
      <view v-if="detectedShareUrl" class="detected-banner" role="status">
        <text class="ri-flashlight-line" /><text v-if="shareLoading">正在自动读取完整歌单…</text
        ><text v-else-if="sharePlaylist">已读取 {{ shareSongs.length }} 首歌曲，可先勾选再匹配</text
        ><text v-else>检测到歌单链接，正在准备读取</text>
      </view>
      <view class="import-actions">
        <button role="button" class="text-button" @click="paste">粘贴剪贴板</button>
        <button v-if="working" role="button" class="text-button" @click="stop">停止识别</button>
        <button
          role="button"
          class="primary-button"
          :disabled="
            working ||
            shareLoading ||
            unsupportedShareUrl ||
            (detectedShareUrl ? !sharePlaylist || !selectedShareCount : !text.trim())
          "
          @click="identify"
        >
          {{
            working
              ? `正在匹配 ${completed}/${results.length}`
              : sharePlaylist
                ? `匹配并核对 ${selectedShareCount} 首`
                : detectedShareUrl
                  ? '正在读取歌单'
                  : '识别歌曲'
          }}
        </button>
      </view>
    </view>
    <view v-if="shareLoading" class="share-status" role="status">
      <text class="ri-loader-4-line share-spinner" />正在读取完整歌单，请稍候…
    </view>
    <view v-else-if="shareError" class="share-status share-error" role="alert">
      <text>{{ shareError }}</text
      ><button v-if="detectedShareUrl" role="button" class="text-button" @click="retrySharePreview">
        重试
      </button>
    </view>
    <view v-else-if="shareSongs.length" class="share-preview">
      <view class="share-heading">
        <view
          ><text class="share-title">{{ shareTitle }}</text
          ><text class="share-summary"
            >{{ sharePlatformLabel }} · {{ shareSongs.length }} 首可导入<template
              v-if="shareFilteredCount"
            >
              · 平台过滤 {{ shareFilteredCount }} 首</template
            ></text
          ></view
        >
        <button
          role="checkbox"
          :aria-checked="allShareSelected"
          class="share-select-all"
          @click="toggleAllShare"
        >
          {{ allShareSelected ? '取消全选' : '全选' }}
        </button>
      </view>
      <text class="share-selection-count"
        >已选 {{ selectedShareCount }} / {{ shareSongs.length }} 首</text
      >
      <scroll-view scroll-y class="share-song-list">
        <button
          v-for="(song, index) in visibleShareSongs"
          :key="`${song.name}-${song.artist}-${index}`"
          role="checkbox"
          :aria-checked="selectedShareIndexes.has(index)"
          class="share-song-row"
          @click="toggleShare(index)"
        >
          <text
            :class="
              selectedShareIndexes.has(index)
                ? 'ri-checkbox-circle-fill share-checked'
                : 'ri-checkbox-blank-circle-line share-unchecked'
            "
          />
          <text class="share-song-index">{{ String(index + 1).padStart(2, '0') }}</text>
          <view class="share-song-info"
            ><text class="share-song-name">{{ song.name }}</text
            ><text class="share-song-meta"
              >{{ song.artist }}<template v-if="song.album"> · {{ song.album }}</template></text
            ></view
          >
          <text v-if="song.duration" class="share-song-duration"
            >{{ Math.floor(song.duration / 60000) }}:{{
              String(Math.floor(song.duration / 1000) % 60).padStart(2, '0')
            }}</text
          >
        </button>
        <button
          v-if="shareShown < shareSongs.length"
          role="button"
          class="text-button share-more"
          @click="showMoreShareSongs"
        >
          继续查看剩余 {{ shareSongs.length - shareShown }} 首
        </button>
      </scroll-view>
    </view>
    <view v-if="results.length" class="import-results"
      ><view class="import-result-heading"
        ><text>核对识别结果</text
        ><button
          role="button"
          class="primary-button"
          :disabled="!selected.length || working"
          @click="importSelected"
        >
          导入 {{ selected.length }} 首
        </button></view
      ><text class="import-note">已自动勾选匹配的歌曲；其他候选请核对歌手与版本后手动勾选。</text
      ><scroll-view scroll-y class="import-result-list"
        ><button
          v-for="(item, index) in visibleResults"
          :key="index"
          role="checkbox"
          :aria-checked="item.selected"
          :disabled="!item.track"
          class="import-row"
          @click="toggle(index)"
        >
          <text
            :class="
              item.selected ? 'ri-checkbox-circle-fill selected' : 'ri-checkbox-blank-circle-line'
            "
          /><view
            ><text>{{
              item.track ? `${item.track.title} · ${item.track.artist}` : item.source
            }}</text
            ><text class="import-source">{{
              item.track
                ? `原文：${item.source}`
                : working
                  ? '正在识别，请稍候'
                  : '尚无匹配结果，可修改文字后重试'
            }}</text></view
          ></button
        ><button
          role="button"
          v-if="shown < results.length"
          class="text-button"
          @click="shown += 60"
        >
          继续查看剩余 {{ results.length - shown }} 首
        </button></scroll-view
      ></view
    ><view class="content-bottom"
  /></scroll-view>
</template>
<style scoped>
.import-form {
  box-sizing: border-box;
  width: 100%;
  padding: 25px var(--page-gutter);
  max-width: 960px;
  margin: 0 auto;
}
.field-input,
.import-input {
  box-sizing: border-box;
  max-width: 100%;
}
.import-title {
  display: block;
  font-size: calc(24px + var(--font-size-adjustment));
  font-weight: 600;
}
.import-description {
  display: block;
  font-size: 13px;
  color: var(--qqm-muted);
  line-height: 1.9;
  margin: 14px 0 20px;
}
.import-input {
  width: 100%;
  height: 230px;
  background: var(--qqm-surface);
  border-radius: 16px;
  padding: 18px;
  margin-top: 14px;
  font-size: 15px;
  line-height: 1.8;
}
.detected-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--qqm-primary-soft);
  color: var(--qqm-accent-text);
  font-size: 11px;
  line-height: 1.5;
}
.import-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 17px;
}
.import-actions .primary-button {
  min-width: 150px;
  flex: 1 1 150px;
}
.share-status {
  margin: 0 var(--page-gutter) 18px;
  padding: 14px 16px;
  border: 1px solid var(--qqm-border);
  border-radius: 12px;
  color: var(--qqm-muted);
  font-size: 13px;
}
.share-status .text-button {
  margin-left: 12px;
  color: var(--qqm-accent-text);
}
.share-spinner {
  display: inline-block;
  margin-right: 9px;
  animation: share-spin 1s linear infinite;
}
.share-error {
  color: #c04453;
}
.share-preview {
  box-sizing: border-box;
  width: 100%;
  padding: 0 var(--page-gutter);
  max-width: 1000px;
  margin: 0 auto;
}
.share-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.share-title {
  display: block;
  font-size: 17px;
  font-weight: 600;
}
.share-summary,
.share-selection-count {
  display: block;
  margin-top: 6px;
  color: var(--qqm-muted);
  font-size: 11px;
}
.share-select-all {
  padding: 7px 12px !important;
  color: var(--qqm-accent-text);
  font-size: 12px;
}
.share-selection-count {
  margin: 14px 0 2px;
}
.share-song-list,
.import-result-list {
  box-sizing: border-box;
  width: 100%;
  height: 320px;
  max-height: 43vh;
  min-height: 220px;
  overflow: hidden;
  border-top: 1px solid var(--qqm-border);
  border-bottom: 1px solid var(--qqm-border);
}
.share-song-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 60px;
  padding: 10px 2px !important;
  text-align: left;
  border-bottom: 1px solid var(--qqm-border);
}
.share-song-row > text:first-child {
  flex: 0 0 21px;
  font-size: 20px;
}
.share-checked {
  color: var(--qqm-accent-text);
}
.share-unchecked,
.share-song-index,
.share-song-duration {
  color: var(--qqm-muted);
}
.share-song-index {
  flex: 0 0 23px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.share-song-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
.share-song-name,
.share-song-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-song-name {
  font-size: 13px;
}
.share-song-meta,
.share-song-duration {
  font-size: 10px;
}
.share-song-duration {
  flex: 0 0 42px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.share-more {
  display: block;
  margin: 16px auto;
}
.share-preview + .import-results {
  margin-top: 24px;
}
@keyframes share-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .share-spinner {
    animation: none;
  }
}
.import-results {
  box-sizing: border-box;
  width: 100%;
  padding: 0 var(--page-gutter);
  max-width: 1000px;
  margin: 24px auto 0;
}
.import-result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 600;
}
.import-note {
  display: block;
  font-size: 12px;
  color: var(--qqm-muted);
  line-height: 1.9;
  margin: 15px 0;
}
.import-row {
  width: 100%;
  display: flex;
  align-items: center;
  text-align: left;
  gap: 15px;
  padding: 15px 4px !important;
}
.import-row > text {
  font-size: 23px;
  color: var(--qqm-muted);
}
.import-row > text.selected {
  color: var(--qqm-accent-text);
}
.import-row > view {
  min-width: 0;
  flex: 1;
  font-size: 14px;
}
.import-source {
  display: block;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.7;
  margin-top: 6px;
}
@media (min-width: 768px) {
  .import-form,
  .share-preview,
  .import-results {
    padding-left: clamp(28px, 5vw, 72px);
    padding-right: clamp(28px, 5vw, 72px);
  }
  .import-input {
    height: 170px;
  }
  .share-song-list,
  .import-result-list {
    height: 380px;
    max-height: 46vh;
  }
}
@media (max-width: 420px) {
  .import-actions {
    align-items: stretch;
  }
  .import-actions .primary-button {
    width: 100%;
    flex-basis: 100%;
  }
  .share-heading,
  .import-result-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }
  .share-select-all {
    align-self: flex-end;
  }
}
</style>
