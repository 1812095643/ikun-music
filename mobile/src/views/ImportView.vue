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
  paste,
  identify,
  toggle,
  importSelected,
  stop
} = usePlaylistImport();
</script>
<template>
  <scroll-view scroll-y class="content-scroll"
    ><view class="import-form"
      ><text class="import-title">把文字变成歌单</text
      ><text class="import-description"
        >每行一首，推荐“歌名 - 歌手”。识别后核对结果，再勾选导入。</text
      ><input v-model="name" class="field-input" placeholder="歌单名称" :maxlength="40" /><textarea
        v-model="text"
        :maxlength="-1"
        class="import-input"
        placeholder="粘贴从手机传来的歌单文字"
      /><view class="import-actions"
        ><button role="button" class="text-button" @click="paste">粘贴剪贴板</button
        ><button role="button" v-if="working" class="text-button" @click="stop">停止识别</button
        ><button
          role="button"
          class="primary-button"
          :disabled="!text.trim() || working"
          @click="identify"
        >
          {{ working ? `正在识别 ${completed}/${results.length}` : '识别歌曲' }}
        </button></view
      ></view
    >
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
      ><text class="import-note">仅歌名与歌手都匹配时自动勾选，其余候选请手动确认。</text
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
          ><text>{{ item.track ? `${item.track.title} · ${item.track.artist}` : item.source }}</text
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
        @click="shown += 100"
      >
        继续查看识别结果
      </button></view
    ><view class="content-bottom"
  /></scroll-view>
</template>
<style scoped>
.import-form {
  padding: 25px var(--page-gutter);
  max-width: 960px;
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
.import-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 17px;
}
.import-results {
  padding: 0 var(--page-gutter);
  max-width: 1000px;
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
  padding: 17px 4px !important;
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
</style>
