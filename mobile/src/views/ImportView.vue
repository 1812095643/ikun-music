<script setup lang="ts">
import { shallowRef, watch } from 'vue';

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

const sourceEditing = shallowRef(true);
const stage = shallowRef<'songs' | 'matches'>('songs');

watch(sharePlaylist, (playlist) => {
  if (playlist) sourceEditing.value = false;
});

watch(results, (items) => {
  if (items.length) stage.value = 'matches';
  else if (!sharePlaylist.value) stage.value = 'songs';
});

function editSource() {
  text.value = '';
  sourceEditing.value = true;
  stage.value = 'songs';
}

function startMatching() {
  stage.value = 'matches';
  void identify();
}

function focusResults() {
  if (results.value.length) stage.value = 'matches';
  else startMatching();
}
</script>

<template>
  <view class="content-scroll import-page">
    <view class="import-form" :class="{ 'has-status': shareLoading || shareError }">
      <view class="source-card" :class="{ collapsed: Boolean(sharePlaylist) && !sourceEditing }">
        <view class="source-heading">
          <view class="source-heading-copy">
            <text class="source-eyebrow">STEP 1 · 导入来源</text>
            <text class="source-title">{{
              sharePlaylist && !sourceEditing ? shareTitle : '导入歌单'
            }}</text>
            <text v-if="sharePlaylist && !sourceEditing" class="source-description">
              {{ sharePlatformLabel }} · {{ shareSongs.length }} 首歌曲<template
                v-if="shareFilteredCount"
              >
                · 平台过滤 {{ shareFilteredCount }} 首</template
              >
            </text>
            <text v-else class="source-description">
              粘贴分享链接或歌曲文字，识别后只保留你需要的歌曲。
            </text>
          </view>
          <button
            v-if="sharePlaylist && !sourceEditing"
            class="source-edit"
            role="button"
            @click="editSource"
          >
            更换来源
          </button>
        </view>

        <template v-if="!sharePlaylist || sourceEditing">
          <input v-model="name" class="field-input" placeholder="歌单名称" :maxlength="40" />
          <textarea
            v-model="text"
            :maxlength="-1"
            class="import-input"
            placeholder="粘贴从手机传来的歌单文字或歌单分享链接"
          />
          <view v-if="detectedShareUrl" class="detected-banner" role="status">
            <text class="ri-flashlight-line" />
            <text v-if="shareLoading">正在自动读取完整歌单…</text>
            <text v-else-if="sharePlaylist">已读取 {{ shareSongs.length }} 首歌曲，可开始核对</text>
            <text v-else>检测到歌单链接，正在准备读取</text>
          </view>
          <view class="source-actions">
            <button role="button" class="text-button" @click="paste">粘贴剪贴板</button>
            <button v-if="working" role="button" class="text-button" @click="stop">停止识别</button>
            <button
              role="button"
              class="primary-button source-primary"
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
                  ? '正在匹配 ' + completed + '/' + results.length
                  : sharePlaylist
                    ? '匹配并核对 ' + selectedShareCount + ' 首'
                    : detectedShareUrl
                      ? '正在读取歌单'
                      : '识别歌曲'
              }}
            </button>
          </view>
        </template>
        <view v-if="sharePlaylist && !sourceEditing" class="source-wide-summary">
          <view class="source-summary-stats">
            <view
              ><text class="source-stat-number">{{ shareSongs.length }}</text
              ><text>首歌曲</text></view
            >
            <view
              ><text class="source-stat-number">{{ selectedShareCount }}</text
              ><text>首已选</text></view
            >
            <view v-if="shareFilteredCount"
              ><text class="source-stat-number">{{ shareFilteredCount }}</text
              ><text>首过滤</text></view
            >
          </view>
          <view class="source-flow">
            <view class="source-flow-item done"
              ><text class="ri-checkbox-circle-fill" /><view
                ><text>读取歌单</text><text>已读取完整歌曲清单</text></view
              ></view
            >
            <view class="source-flow-line" />
            <view class="source-flow-item active"
              ><text class="ri-search-eye-line" /><view
                ><text>匹配歌曲</text><text>核对歌手和版本</text></view
              ></view
            >
            <view class="source-flow-line" />
            <view class="source-flow-item"
              ><text class="ri-save-3-line" /><view
                ><text>保存到本机</text><text>生成你的本地歌单</text></view
              ></view
            >
          </view>
          <button class="primary-button source-wide-action" @click="focusResults">
            {{ results.length ? '查看匹配结果' : '匹配并核对' }}
          </button>
        </view>
      </view>

      <view v-if="shareLoading" class="status-card" role="status">
        <text class="ri-loader-4-line status-icon share-spinner" />
        <view>
          <text class="status-title">正在读取完整歌单</text>
          <text class="status-description">平台歌曲较多时会分批加载，请稍候。</text>
        </view>
      </view>
      <view v-else-if="shareError" class="status-card status-error" role="alert">
        <text class="ri-error-warning-line status-icon" />
        <view>
          <text class="status-title">暂时无法读取</text>
          <text class="status-description">{{ shareError }}</text>
        </view>
        <button
          v-if="detectedShareUrl"
          role="button"
          class="text-button"
          @click="retrySharePreview"
        >
          重试
        </button>
      </view>

      <view v-if="shareSongs.length || results.length" class="import-stage">
        <view v-if="shareSongs.length && results.length" class="stage-tabs" role="tablist">
          <button
            role="tab"
            :aria-selected="stage === 'songs'"
            :class="{ active: stage === 'songs' }"
            @click="stage = 'songs'"
          >
            歌曲清单 <text>{{ shareSongs.length }}</text>
          </button>
          <button
            role="tab"
            :aria-selected="stage === 'matches'"
            :class="{ active: stage === 'matches' }"
            @click="stage = 'matches'"
          >
            匹配结果 <text>{{ results.length }}</text>
          </button>
        </view>

        <view v-if="stage === 'songs' && shareSongs.length" class="results-card">
          <view class="results-heading">
            <view>
              <text class="results-eyebrow">STEP 2 · 歌曲清单</text>
              <text class="results-title">{{ shareTitle }}</text>
            </view>
            <button
              role="checkbox"
              :aria-checked="allShareSelected"
              class="select-all-button"
              @click="toggleAllShare"
            >
              {{ allShareSelected ? '取消全选' : '全选' }}
            </button>
          </view>
          <view class="selection-line">
            <text>已选 {{ selectedShareCount }} / {{ shareSongs.length }} 首</text>
            <text>列表可上下滑动</text>
          </view>
          <scroll-view scroll-y class="song-list">
            <button
              v-for="(song, index) in visibleShareSongs"
              :key="index"
              role="checkbox"
              :aria-checked="selectedShareIndexes.has(index)"
              class="song-row"
              @click="toggleShare(index)"
            >
              <text
                :class="
                  selectedShareIndexes.has(index)
                    ? 'ri-checkbox-circle-fill row-check selected'
                    : 'ri-checkbox-blank-circle-line row-check'
                "
              />
              <text class="row-index">{{ String(index + 1).padStart(2, '0') }}</text>
              <view class="row-info">
                <text class="row-title">{{ song.name }}</text>
                <text class="row-meta"
                  >{{ song.artist }}<template v-if="song.album"> · {{ song.album }}</template></text
                >
              </view>
              <text v-if="song.duration" class="row-duration"
                >{{ Math.floor(song.duration / 60000) }}:{{
                  String(Math.floor(song.duration / 1000) % 60).padStart(2, '0')
                }}</text
              >
            </button>
            <button
              v-if="shareShown < shareSongs.length"
              role="button"
              class="list-more"
              @click="showMoreShareSongs"
            >
              继续查看剩余 {{ shareSongs.length - shareShown }} 首
            </button>
          </scroll-view>
          <view class="stage-action-bar">
            <view
              ><text class="action-count">{{ selectedShareCount }}</text
              ><text>首待匹配</text></view
            >
            <button
              class="primary-button"
              :disabled="!selectedShareCount || working"
              @click="startMatching"
            >
              {{ working ? '正在匹配 ' + completed + '/' + results.length : '匹配并核对' }}
            </button>
          </view>
        </view>

        <view
          v-if="stage === 'matches' || (!shareSongs.length && results.length)"
          class="results-card"
        >
          <view class="results-heading">
            <view>
              <text class="results-eyebrow">STEP 3 · 核对结果</text>
              <text class="results-title">确认要保存的歌曲</text>
            </view>
            <button
              class="primary-button result-import-button"
              :disabled="!selected.length || working"
              @click="importSelected"
            >
              导入 {{ selected.length }} 首
            </button>
          </view>
          <input
            v-model="name"
            class="playlist-name-input"
            placeholder="歌单名称"
            :maxlength="40"
          />
          <text class="import-note"
            >已自动勾选匹配的歌曲；其他候选请核对歌手与版本后手动勾选。</text
          >
          <scroll-view scroll-y class="song-list result-list">
            <button
              v-for="(item, index) in visibleResults"
              :key="index"
              role="checkbox"
              :aria-checked="item.selected"
              :disabled="!item.track"
              class="song-row result-row"
              @click="toggle(index)"
            >
              <text
                :class="
                  item.selected
                    ? 'ri-checkbox-circle-fill row-check selected'
                    : 'ri-checkbox-blank-circle-line row-check'
                "
              />
              <view class="row-info">
                <text class="row-title">{{
                  item.track ? item.track.title + ' · ' + item.track.artist : item.source
                }}</text>
                <text class="row-meta">{{
                  item.track
                    ? '原文：' + item.source
                    : working
                      ? '正在识别，请稍候'
                      : '尚无匹配结果，可修改文字后重试'
                }}</text>
              </view>
            </button>
            <button
              v-if="shown < results.length"
              role="button"
              class="list-more"
              @click="shown += 60"
            >
              继续查看剩余 {{ results.length - shown }} 首
            </button>
          </scroll-view>
          <view v-if="working" class="matching-progress"
            ><text class="ri-loader-4-line share-spinner" />正在匹配 {{ completed }} /
            {{ results.length }}</view
          >
        </view>
      </view>

      <view v-else class="import-empty">
        <view class="empty-icon"><text class="ri-file-list-3-line" /></view>
        <text class="empty-title">识别后在这里核对歌曲</text>
        <text class="empty-description">歌单很长也没关系，歌曲会收进固定高度的滚动面板。</text>
      </view>
      <view class="content-bottom" />
    </view>
  </view>
</template>
<style scoped>
.import-page {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
}
.import-form {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 16px var(--page-gutter) 0;
  max-width: 960px;
  margin: 0 auto;
}
.source-card,
.results-card,
.status-card,
.import-empty {
  box-sizing: border-box;
  width: 100%;
  border-radius: 18px;
  background: var(--qqm-surface);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--qqm-border) 66%, transparent),
    0 10px 24px rgba(15, 32, 24, 0.045);
}
.source-card {
  padding: 16px;
}
.source-card.collapsed {
  padding-bottom: 15px;
}
.source-wide-summary {
  display: none;
}
.source-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.source-heading-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.source-eyebrow,
.results-eyebrow {
  display: block;
  margin-bottom: 5px;
  color: var(--qqm-accent-text);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.1em;
}
.source-title,
.results-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 650;
}
.source-description {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-edit,
.select-all-button {
  flex: 0 0 auto;
  padding: 7px 0 !important;
  color: var(--qqm-accent-text);
  font-size: 12px;
}
.field-input,
.import-input {
  box-sizing: border-box;
  max-width: 100%;
}
.field-input {
  width: 100%;
  height: 42px;
  margin-top: 14px;
  padding: 0 12px;
  border: 1px solid var(--qqm-border);
  border-radius: 11px;
  background: var(--qqm-bg);
  color: var(--qqm-text);
  font-size: 13px;
}
.import-input {
  width: 100%;
  height: 132px;
  margin-top: 10px;
  padding: 13px;
  border: 1px solid var(--qqm-border);
  border-radius: 13px;
  background: var(--qqm-bg);
  font-size: 14px;
  line-height: 1.7;
}
.source-actions {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.source-primary {
  min-width: 0;
}
.detected-banner {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  align-items: center;
  gap: 7px;
  margin-top: 9px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--qqm-primary-soft);
  color: var(--qqm-accent-text);
  font-size: 11px;
  line-height: 1.5;
}
.status-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px var(--page-gutter) 0;
  padding: 13px 14px;
}
.status-icon {
  flex: 0 0 auto;
  color: var(--qqm-accent-text);
  font-size: 21px;
}
.status-card > view {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
.status-title {
  font-size: 13px;
  font-weight: 600;
}
.status-description {
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.5;
}
.status-error {
  color: #b03d4d;
}
.import-stage {
  margin-top: 16px;
}
.stage-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-bottom: 10px;
  padding: 4px;
  border-radius: 12px;
  background: var(--qqm-surface-muted);
}
.stage-tabs button {
  padding: 9px 8px !important;
  border-radius: 9px;
  color: var(--qqm-muted);
  font-size: 12px;
}
.stage-tabs button.active {
  background: var(--qqm-surface);
  color: var(--qqm-accent-text);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(15, 32, 24, 0.06);
}
.stage-tabs button text {
  margin-left: 4px;
  font-size: 10px;
  opacity: 0.8;
}
.results-card {
  padding: 16px;
}
.results-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}
.results-heading > view {
  min-width: 0;
}
.playlist-name-input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  margin-top: 13px;
  padding: 0 11px;
  border: 1px solid var(--qqm-border);
  border-radius: 10px;
  background: var(--qqm-bg);
  color: var(--qqm-text);
  font-size: 12px;
}
.selection-line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 12px 0 8px;
  color: var(--qqm-muted);
  font-size: 11px;
}
.song-list {
  box-sizing: border-box;
  width: 100%;
  height: 360px;
  height: clamp(220px, calc(100dvh - var(--safe-top) - var(--bar-height) - 420px), 560px);
  max-height: none;
  min-height: 240px;
  overflow: hidden;
  border-top: 1px solid var(--qqm-border);
  border-bottom: 1px solid var(--qqm-border);
}
.song-row {
  display: flex;
  width: 100%;
  min-height: 58px;
  align-items: center;
  gap: 9px;
  padding: 9px 2px !important;
  text-align: left;
  border-bottom: 1px solid var(--qqm-border);
}
.row-check {
  flex: 0 0 22px;
  color: var(--qqm-muted);
  font-size: 19px;
}
.row-check.selected {
  color: var(--qqm-accent-text);
}
.row-index {
  flex: 0 0 23px;
  color: var(--qqm-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.row-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.row-title,
.row-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-title {
  font-size: 13px;
}
.row-meta {
  color: var(--qqm-muted);
  font-size: 10px;
}
.row-duration {
  flex: 0 0 38px;
  color: var(--qqm-muted);
  font-size: 10px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.list-more {
  display: block;
  margin: 13px auto;
  color: var(--qqm-accent-text);
  font-size: 12px;
}
.stage-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--qqm-border);
  color: var(--qqm-muted);
  font-size: 11px;
}
.stage-action-bar > view {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.action-count {
  color: var(--qqm-text);
  font-size: 19px;
  font-weight: 650;
}
.stage-action-bar .primary-button {
  min-width: 126px;
}
.result-import-button {
  flex: 0 0 auto;
  min-width: 108px;
}
.import-note {
  display: block;
  margin: 10px 0;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.7;
}
.matching-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: var(--qqm-accent-text);
  font-size: 11px;
}
.import-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  min-height: 220px;
  margin-top: 16px;
  padding: 28px 20px;
  text-align: center;
}
.empty-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  margin-bottom: 12px;
  border-radius: 14px;
  background: var(--qqm-primary-soft);
  color: var(--qqm-accent-text);
  font-size: 23px;
}
.empty-title {
  font-size: 14px;
  font-weight: 600;
}
.empty-description {
  max-width: 250px;
  margin-top: 7px;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.7;
}
.content-bottom {
  height: calc(var(--bar-height) + var(--safe-bottom));
}
@media (min-width: 768px) {
  .import-form {
    padding: 26px clamp(28px, 5vw, 72px) 0;
  }
  .source-card,
  .results-card,
  .status-card,
  .import-empty {
    max-width: 920px;
    margin-left: auto;
    margin-right: auto;
  }
  .song-list,
  .result-list {
    height: clamp(280px, calc(100dvh - var(--safe-top) - var(--bar-height) - 270px), 680px);
    max-height: none;
  }
}

:global(.mobile-app.layout-wide:not(.device-phone) .import-form) {
  display: grid;
  grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.5fr);
  grid-template-rows: auto auto 1fr auto;
  align-items: start;
  gap: 16px 20px;
  max-width: 1440px;
  padding: 24px 28px 0;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-card) {
  grid-column: 1;
  grid-row: 1 / span 2;
  position: sticky;
  top: 16px;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-card.collapsed) {
  min-height: calc(100dvh - var(--safe-top) - var(--bar-height) - 150px);
  display: flex;
  flex-direction: column;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-wide-summary) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  padding-top: 28px;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-summary-stats) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 13px 0;
  border-top: 1px solid var(--qqm-border);
  border-bottom: 1px solid var(--qqm-border);
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-summary-stats > view) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  color: var(--qqm-muted);
  font-size: 10px;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-stat-number) {
  color: var(--qqm-text);
  font-size: 21px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow) {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item) {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--qqm-muted);
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item > text:first-child) {
  flex: 0 0 26px;
  color: var(--qqm-border);
  font-size: 22px;
  text-align: center;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item.done > text:first-child),
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item.active > text:first-child) {
  color: var(--qqm-accent-text);
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item > view) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item > view > text:first-child) {
  color: var(--qqm-text);
  font-size: 13px;
  font-weight: 600;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-item > view > text:last-child) {
  color: var(--qqm-muted);
  font-size: 10px;
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-flow-line) {
  width: 1px;
  height: 18px;
  margin-left: 13px;
  background: var(--qqm-border);
}
:global(.mobile-app.layout-wide:not(.device-phone) .source-wide-action) {
  width: 100%;
}
:global(.mobile-app.layout-wide:not(.device-phone) .status-card) {
  grid-column: 2;
  grid-row: 1;
  width: auto;
  margin: 0;
}
:global(.mobile-app.layout-wide:not(.device-phone) .import-stage),
:global(.mobile-app.layout-wide:not(.device-phone) .import-empty) {
  grid-column: 2;
  grid-row: 1 / span 3;
  min-width: 0;
  margin-top: 0;
}
:global(.mobile-app.layout-wide:not(.device-phone) .has-status .import-stage) {
  grid-row: 2 / span 2;
}
:global(.mobile-app.layout-wide:not(.device-phone) .import-empty) {
  min-height: 360px;
  margin-top: 0;
}
:global(.mobile-app.layout-wide:not(.device-phone) .content-bottom) {
  grid-column: 1 / -1;
  grid-row: 4;
}
:global(.mobile-app.layout-wide:not(.device-phone) .song-list),
:global(.mobile-app.layout-wide:not(.device-phone) .result-list) {
  height: clamp(280px, calc(100dvh - var(--safe-top) - var(--bar-height) - 330px), 700px);
  max-height: none;
}

@media (min-width: 720px) and (max-height: 560px) {
  :global(.mobile-app.layout-wide:not(.device-phone) .import-form) {
    grid-template-columns: minmax(240px, 0.65fr) minmax(0, 1.7fr);
    gap: 12px 16px;
    padding: 14px 20px 0;
  }
  :global(.mobile-app.layout-wide:not(.device-phone) .song-list),
  :global(.mobile-app.layout-wide:not(.device-phone) .result-list) {
    height: clamp(220px, calc(100dvh - var(--safe-top) - var(--bar-height) - 260px), 480px);
  }
}
@media (max-width: 420px) {
  .source-actions {
    grid-template-columns: auto auto;
  }
  .source-primary {
    grid-column: 1 / -1;
    width: 100%;
  }
  .results-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .result-import-button {
    width: 100%;
  }
  .selection-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .share-spinner {
    animation: none;
  }
}
</style>
