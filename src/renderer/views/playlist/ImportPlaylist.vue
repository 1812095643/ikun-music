<script setup lang="ts">
import { useRouter } from 'vue-router';

import ImportSongPreview from './ImportSongPreview.vue';
import { usePlaylistImport } from './usePlaylistImport';

const router = useRouter();
const {
  mode,
  input,
  name,
  destination,
  manual,
  songs,
  matches,
  selected,
  phase,
  error,
  note,
  completed,
  savedId,
  sourceTitle,
  platforms,
  busy,
  reviewing,
  allSelected,
  preview,
  matchSelected,
  toggle,
  toggleAll,
  save,
  stop
} = usePlaylistImport();
const tabs = [
  { id: 'link', title: '分享链接' },
  { id: 'text', title: '歌曲文字' },
  { id: 'manual', title: '逐首填写' }
] as const;
function openSaved() {
  void router.push(
    savedId.value
      ? { path: `/music-list/${savedId.value}`, query: { type: 'local' } }
      : { path: '/user', query: { tab: 'favorites' } }
  );
}
</script>
<template>
  <!-- 路由退出动画需要真实元素根节点；直接挂载滚动组件会让过渡无法结束，切页后白屏。 -->
  <div class="playlist-import-shell">
    <n-scrollbar class="playlist-import-page">
      <div class="import-content">
        <header class="import-heading">
          <p>把喜欢的音乐带过来</p>
          <h1>导入歌单</h1>
          <span>粘贴分享链接，核对歌曲后保存到本机歌单。</span>
        </header>
        <div class="import-tabs" role="tablist" aria-label="导入方式">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            role="tab"
            :aria-selected="mode === tab.id"
            :class="{ active: mode === tab.id }"
            @click="mode = tab.id"
          >
            {{ tab.title }}
          </button>
        </div>
        <section class="import-input-section">
          <template v-if="mode !== 'manual'">
            <label class="field-label" for="playlist-import-input">{{
              mode === 'link' ? '歌单分享链接' : '歌曲列表'
            }}</label>
            <textarea
              id="playlist-import-input"
              v-model="input"
              :rows="mode === 'link' ? 3 : 6"
              :placeholder="
                mode === 'link'
                  ? '粘贴 QQ 音乐、网易云或酷我的公开歌单链接，也可以粘贴完整分享文案'
                  : '每行一首，例如：歌名 - 歌手 - 专辑（专辑可省略）'
              "
            />
          </template>
          <div v-else class="manual-songs">
            <div v-for="(item, index) in manual" :key="index">
              <input
                v-model="item.name"
                :aria-label="`第 ${index + 1} 首歌名`"
                placeholder="歌曲名称"
              /><input
                v-model="item.artist"
                :aria-label="`第 ${index + 1} 首歌手`"
                placeholder="歌手名称"
              /><input
                v-model="item.album"
                :aria-label="`第 ${index + 1} 首专辑`"
                placeholder="专辑（可省略）"
              /><button
                v-if="manual.length > 1"
                class="music-list-icon"
                :aria-label="`移除第 ${index + 1} 行`"
                @click="manual.splice(index, 1)"
              >
                <i class="ri-close-line" />
              </button>
            </div>
            <button
              class="music-list-button"
              @click="manual.push({ name: '', artist: '', album: '' })"
            >
              <i class="ri-add-line" />再加一首
            </button>
          </div>
          <div class="input-hint">
            <span>{{
              platforms && mode === 'link'
                ? `已识别 ${platforms}，自动读取歌单`
                : mode === 'link'
                  ? '支持公开歌单完整链接；单曲、主页和需要登录的私密歌单暂不支持。'
                  : '保留歌曲原顺序，匹配后可以再次核对。'
            }}</span
            ><button v-if="!busy" @click="preview">
              {{ mode === 'link' ? '重新读取' : '预览歌曲' }}</button
            ><button v-else @click="stop">停止</button>
          </div>
        </section>
        <p v-if="error" class="import-error" role="alert">
          {{ error }}<button @click="preview">重试</button>
        </p>
        <section v-if="songs.length || busy" class="import-preview-section">
          <div class="preview-heading">
            <h2>{{ sourceTitle || '核对歌曲' }}</h2>
            <span v-if="phase === 'matching'" role="status"
              >匹配中 {{ completed }} / {{ songs.length }}</span
            ><span v-else-if="phase === 'reading'" role="status">正在读取…</span>
          </div>
          <p class="import-note" role="status">{{ note }}</p>
          <import-song-preview
            v-if="songs.length && phase !== 'saved'"
            :songs="songs"
            :matches="matches"
            :selected="selected"
            :all-selected="allSelected"
            :reviewing="reviewing"
            :busy="busy"
            :matching="phase === 'matching'"
            @toggle="toggle"
            @all="toggleAll"
          />
          <div v-if="phase !== 'saved'" class="import-save-bar">
            <label
              >保存到<select v-model="destination" :disabled="busy" aria-label="保存位置">
                <option value="playlist">我的歌单</option>
                <option value="favorites">我喜欢</option>
              </select></label
            >
            <input
              v-if="destination === 'playlist'"
              v-model="name"
              aria-label="歌单名称"
              placeholder="歌单名称"
              maxlength="80"
              :disabled="busy"
            />
            <button
              v-if="reviewing"
              class="music-list-button music-list-button--primary"
              :disabled="!selected.size || (destination === 'playlist' && !name.trim())"
              @click="save"
            >
              导入 {{ selected.size }} 首
            </button>
            <button
              v-else
              class="music-list-button music-list-button--primary"
              :disabled="busy || !selected.size"
              @click="matchSelected"
            >
              {{ phase === 'matching' ? '正在匹配…' : `匹配所选 ${selected.size} 首` }}
            </button>
          </div>
          <div v-else class="import-success">
            <i class="ri-checkbox-circle-line" aria-hidden="true" />
            <h2>已经放进你的音乐库</h2>
            <p>{{ note }}</p>
            <button class="music-list-button music-list-button--primary" @click="openSaved">
              打开歌单<i class="ri-arrow-right-line" />
            </button>
          </div>
        </section>
      </div>
    </n-scrollbar>
  </div>
</template>
<style scoped>
.playlist-import-shell {
  height: 100%;
  min-height: 0;
}
.playlist-import-page {
  height: 100%;
  color: var(--qqm-text);
}
.import-content {
  max-width: 1120px;
  margin: 0 auto;
  padding: 34px 4% 120px;
}
.import-heading p {
  color: var(--qqm-muted);
  font-size: 11px;
  margin-bottom: 8px;
}
.import-heading h1 {
  font-size: 30px;
  font-weight: 650;
  margin: 0 0 10px;
}
.import-heading > span {
  color: var(--qqm-muted);
  font-size: 12px;
}
.import-tabs {
  display: flex;
  gap: 30px;
  margin-top: 28px;
  border-bottom: 1px solid var(--qqm-border);
}
.import-tabs button {
  color: var(--qqm-muted);
  font-size: 15px;
  padding-bottom: 16px;
  position: relative;
}
.import-tabs button.active {
  color: var(--qqm-primary-strong);
  font-weight: 600;
}
.import-tabs button.active::after {
  content: '';
  height: 3px;
  width: 27px;
  background: var(--qqm-primary);
  position: absolute;
  bottom: 0;
  left: 0;
  border-radius: 2px;
}
.import-input-section {
  padding: 24px 0 20px;
}
.field-label {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
}
textarea,
.manual-songs input,
.import-save-bar input {
  width: 100%;
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
  border-radius: 10px;
  padding: 12px 14px;
  color: var(--qqm-text);
  font-size: 13px;
  outline: none;
}
textarea {
  resize: vertical;
  min-height: 88px;
  max-height: 240px;
  line-height: 1.8;
}
textarea:focus,
input:focus {
  border-color: var(--qqm-primary);
}
.input-hint {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  font-size: 11px;
  color: var(--qqm-muted);
  margin-top: 10px;
}
.input-hint button,
.import-error button {
  color: var(--qqm-primary-strong);
  white-space: nowrap;
}
.import-error {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  padding: 12px 0;
}
.import-preview-section {
  border-top: 1px solid var(--qqm-border);
  padding-top: 22px;
}
.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.preview-heading h2 {
  font-size: 17px;
  font-weight: 600;
}
.preview-heading span,
.import-note {
  color: var(--qqm-muted);
  font-size: 12px;
}
.import-note {
  margin-top: 8px;
  line-height: 1.8;
}
.import-save-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 0;
  border-top: 1px solid var(--qqm-border);
}
.import-save-bar label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--qqm-muted);
}
.import-save-bar select {
  background: var(--qqm-surface);
  color: var(--qqm-text);
  border-radius: 8px;
  padding: 8px;
}
.import-save-bar input {
  flex: 1;
  max-width: 340px;
  min-width: 160px;
  padding: 8px 12px;
}
.import-save-bar > button {
  margin-left: auto;
}
.import-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 36px 20px;
}
.import-success > i {
  color: var(--qqm-primary-strong);
  font-size: 44px;
}
.import-success h2 {
  font-size: 18px;
  font-weight: 500;
}
.import-success p {
  color: var(--qqm-muted);
  font-size: 12px;
}
.manual-songs > div {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.manual-songs input {
  min-width: 0;
}
button:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 3px;
}
</style>
