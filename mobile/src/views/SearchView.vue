<script setup lang="ts">
import TrackList from '@/components/TrackList.vue';
import type { Track } from '@/services/musicApi';
import {
  clearSearch,
  search,
  searched,
  searchError,
  searchLoading,
  searchQuery,
  searchResults,
  searchTotal,
  submittedQuery,
  switchTab
} from '@/stores/browse';
import { clearSearchHistory, history, recentSearches } from '@/stores/library';
import { playTracks } from '@/stores/player';
const emit = defineEmits<{ more: [track: Track] }>();
function submit() {
  uni.hideKeyboard();
  void search();
}
</script>
<template>
  <view class="search-view"
    ><view class="search-top"
      ><button
        role="button"
        class="button-icon search-back"
        aria-label="返回发现"
        @click="switchTab('discover')"
      >
        <text class="ri-arrow-left-line" /></button
      ><view class="search-field"
        ><text class="ri-search-line" /><input
          v-model="searchQuery"
          class="search-input"
          placeholder="搜索歌曲、歌手"
          confirm-type="search"
          @confirm="submit" /><button
          v-if="searchQuery"
          role="button"
          class="clear-search"
          aria-label="清除搜索"
          @click="clearSearch"
        >
          <text class="ri-close-circle-fill" /></button></view
      ><button role="button" class="search-submit" @click="submit">搜索</button></view
    ><scroll-view scroll-y class="search-content" @scrolltolower="search(submittedQuery, true)"
      ><template v-if="!searched"
        ><view v-if="recentSearches.length" class="search-history"
          ><view class="section-heading"
            ><text class="section-title">最近搜索</text
            ><button
              role="button"
              class="button-icon muted"
              aria-label="清空搜索记录"
              @click="clearSearchHistory"
            >
              <text class="ri-delete-bin-6-line" /></button></view
          ><view class="history-chips"
            ><button v-for="word in recentSearches" :key="word" role="button" @click="search(word)">
              {{ word }}
            </button></view
          ></view
        ><view class="section-heading"><text class="section-title">从喜欢的歌手开始</text></view
        ><view class="suggested-searches"
          ><button
            v-for="word in ['孙燕姿', '周杰伦', '陈奕迅', '林俊杰', '王菲', '许嵩']"
            :key="word"
            role="button"
            @click="search(word)"
          >
            <text>{{ word }}</text
            ><text class="ri-arrow-right-up-line" /></button></view
        ><template v-if="history.length"
          ><view class="section-heading"><text class="section-title">最近听过</text></view
          ><track-list
            :tracks="history"
            :limit="5"
            compact
            @more="emit('more', $event)" /></template></template
      ><template v-else
        ><view class="result-tabs"
          ><text class="result-tab">单曲</text
          ><text class="result-total">{{
            searchTotal ? `${searchTotal} 个结果` : '搜索音乐'
          }}</text></view
        ><view v-if="searchResults.length" class="result-toolbar"
          ><button role="button" class="play-all" @click="playTracks(searchResults)">
            <view class="play-all-icon"><text class="ri-play-fill" /></view><text>播放全部</text
            ><text class="loaded-count">（{{ searchResults.length }}）</text>
          </button></view
        ><track-list :tracks="searchResults" @more="emit('more', $event)" /><view
          v-if="searchLoading"
          class="state-box"
          ><text class="spinner" /><view>正在查找歌曲</view></view
        ><view v-else-if="searchError" class="state-box"
          >{{ searchError
          }}<button role="button" class="text-button" @click="search()">重新搜索</button></view
        ><view v-else-if="!searchResults.length" class="state-box"
          ><text class="empty-symbol ri-search-eye-line" /><view>没有找到相关歌曲</view
          ><view class="empty-search-tip">试试歌名或歌手名，少输入几个字也可以。</view></view
        ><button
          v-else-if="searchResults.length < searchTotal"
          role="button"
          class="load-more"
          @click="search(submittedQuery, true)"
        >
          加载更多歌曲<text class="ri-arrow-down-s-line" /></button
        ><view v-else class="results-end">已经看到全部结果</view></template
      ><view class="content-bottom" /></scroll-view
  ></view>
</template>
<style scoped>
.search-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.search-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 20px 13px 12px;
  flex-shrink: 0;
  height: 68px;
}
.search-back {
  width: 29px !important;
  font-size: 23px !important;
}
.search-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  background: rgba(129, 149, 139, 0.1);
  height: 43px;
  border-radius: 24px;
  padding: 0 12px;
}
.search-field > .ri-search-line {
  font-size: 19px;
  color: var(--qqm-muted);
}
.search-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  font-size: calc(15px + var(--font-size-adjustment));
}
.clear-search {
  width: 26px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--qqm-muted) !important;
  font-size: 17px !important;
}
.search-submit {
  font-size: calc(15px + var(--font-size-adjustment)) !important;
  color: var(--qqm-accent-text) !important;
  min-height: 40px;
}
.search-content {
  flex: 1;
  min-height: 0;
}
.search-history .section-heading {
  margin-top: 12px;
  margin-bottom: 10px;
}
.search-history .button-icon {
  font-size: 19px !important;
}
.history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 11px 9px;
  padding: 0 20px;
}
.history-chips button {
  background: var(--qqm-surface-muted) !important;
  padding: 8px 14px !important;
  border-radius: 20px !important;
  font-size: calc(13px + var(--font-size-adjustment)) !important;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggested-searches {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 27px;
  padding: 0 20px;
}
.suggested-searches button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 !important;
  font-size: calc(16px + var(--font-size-adjustment)) !important;
  text-align: left;
  border-bottom: 1px solid var(--qqm-border);
}
.suggested-searches button > text:last-child {
  color: var(--qqm-muted);
  font-size: 18px;
}
.result-tabs {
  height: 49px;
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 5px 21px 0;
  border-bottom: 1px solid var(--qqm-border);
}
.result-tab {
  color: var(--qqm-accent-text);
  font-weight: 600;
  font-size: calc(17px + var(--font-size-adjustment));
  position: relative;
  height: 43px;
}
.result-tab::after {
  content: '';
  position: absolute;
  bottom: 8px;
  left: 8px;
  width: 19px;
  height: 3px;
  border-radius: 3px;
  background: var(--qqm-primary);
}
.result-total {
  font-size: calc(12px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  padding-top: 4px;
}
.result-toolbar {
  padding: 17px 20px 8px;
}
.play-all {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: calc(16px + var(--font-size-adjustment)) !important;
  font-weight: 550 !important;
}
.play-all-icon {
  height: 37px;
  width: 37px;
  border-radius: 50%;
  background: var(--qqm-primary);
  color: #123b26;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23px;
}
.loaded-count {
  font-size: calc(14px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-left: -7px;
  font-weight: 400;
}
.load-more {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  padding: 20px !important;
  width: 100%;
  color: var(--qqm-muted) !important;
  font-size: calc(13px + var(--font-size-adjustment)) !important;
}
.empty-search-tip {
  font-size: calc(12px + var(--font-size-adjustment));
  margin-top: 8px;
}
.results-end {
  text-align: center;
  padding: 22px;
  color: var(--qqm-muted);
  font-size: calc(12px + var(--font-size-adjustment));
}
</style>
