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
          <div>
            <p>本机歌单工具</p>
            <h1>导入歌单</h1>
            <span>粘贴分享链接或歌曲文字，自动读取后只保留你想要的歌曲。</span>
          </div>
          <span class="import-heading-badge"><i class="ri-flashlight-line" />自动识别</span>
        </header>
        <div class="import-workspace">
          <section class="import-source-panel">
            <div class="panel-heading">
              <span class="panel-step">STEP 1</span>
              <h2>选择导入方式</h2>
              <p>链接会自动读取歌单，文字列表会先生成可核对的预览。</p>
            </div>
            <div class="import-tabs" role="tablist" aria-label="导入方式">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                role="tab"
                :aria-selected="mode === tab.id"
                :class="{ active: mode === tab.id }"
                @click="mode = tab.id"
              >
                <i
                  :class="
                    tab.id === 'link' ? 'ri-link-m' : tab.id === 'text' ? 'ri-text' : 'ri-edit-line'
                  "
                />
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
                  />
                  <input
                    v-model="item.artist"
                    :aria-label="`第 ${index + 1} 首歌手`"
                    placeholder="歌手名称"
                  />
                  <input
                    v-model="item.album"
                    :aria-label="`第 ${index + 1} 首专辑`"
                    placeholder="专辑（可省略）"
                  />
                  <button
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
                <div class="hint-copy">
                  <i
                    :class="
                      platforms && mode === 'link'
                        ? 'ri-checkbox-circle-fill'
                        : 'ri-information-line'
                    "
                  />
                  <span>{{
                    platforms && mode === 'link'
                      ? `已识别 ${platforms}，正在读取完整歌单`
                      : mode === 'link'
                        ? '支持公开歌单完整链接；单曲、主页和私密歌单暂不支持。'
                        : '保留歌曲原顺序，匹配后可以再次核对。'
                  }}</span>
                </div>
                <div class="hint-actions">
                  <button v-if="!busy" @click="preview">
                    {{ mode === 'link' ? '重新读取' : '预览歌曲' }}
                  </button>
                  <button v-else @click="stop">停止识别</button>
                </div>
              </div>
            </section>
            <p v-if="error" class="import-error" role="alert">
              <i class="ri-error-warning-line" />{{ error }}<button @click="preview">重试</button>
            </p>
          </section>
          <section class="import-preview-section" :class="{ empty: !(songs.length || busy) }">
            <template v-if="songs.length || busy">
              <div class="preview-heading">
                <div>
                  <span class="panel-step">STEP 2</span>
                  <h2>{{ sourceTitle || '核对歌曲' }}</h2>
                </div>
                <span v-if="phase === 'matching'" class="preview-progress" role="status"
                  >匹配中 {{ completed }} / {{ songs.length }}</span
                >
                <span v-else-if="phase === 'reading'" class="preview-progress" role="status"
                  ><i class="ri-loader-4-line spin" />正在读取</span
                >
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
            </template>
            <div v-else class="preview-empty">
              <div class="preview-empty-icon"><i class="ri-file-list-3-line" /></div>
              <h2>识别结果会显示在这里</h2>
              <p>先在左侧粘贴歌单链接或歌曲文字，100 首歌也会收进固定高度的预览区。</p>
            </div>
          </section>
        </div>
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
  box-sizing: border-box;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(20px, 3vw, 42px) clamp(20px, 4vw, 52px) 80px;
}
.import-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}
.import-heading p {
  margin: 0 0 8px;
  color: var(--qqm-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
}
.import-heading h1 {
  margin: 0 0 8px;
  font-size: clamp(24px, 2.4vw, 30px);
  font-weight: 650;
  letter-spacing: -0.03em;
}
.import-heading > div > span {
  color: var(--qqm-muted);
  font-size: 12px;
}
.import-heading-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 8px 11px;
  border-radius: 999px;
  background: var(--qqm-primary-soft);
  color: var(--qqm-primary-strong);
  font-size: 11px;
  white-space: nowrap;
}
.import-workspace {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.65fr);
  align-items: start;
  gap: 18px;
}
.import-source-panel,
.import-preview-section {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--qqm-border) 76%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--qqm-surface) 94%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--qqm-border) 24%, transparent),
    0 12px 30px color-mix(in srgb, var(--qqm-text) 6%, transparent);
}
.panel-heading {
  padding: 22px 22px 16px;
}
.panel-step {
  display: block;
  margin-bottom: 7px;
  color: var(--qqm-primary-strong);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.12em;
}
.panel-heading h2 {
  margin: 0 0 7px;
  font-size: 17px;
  font-weight: 650;
}
.panel-heading p {
  margin: 0;
  color: var(--qqm-muted);
  font-size: 12px;
  line-height: 1.7;
}
.import-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  margin: 0 20px;
  padding: 5px;
  border-radius: 12px;
  background: var(--qqm-surface-muted);
}
.import-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 9px 6px;
  border-radius: 9px;
  color: var(--qqm-muted);
  font-size: 12px;
  white-space: nowrap;
  transition:
    color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}
.import-tabs button i {
  font-size: 15px;
}
.import-tabs button.active {
  background: var(--qqm-surface);
  color: var(--qqm-primary-strong);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--qqm-text) 7%, transparent);
}
.import-tabs button:not(.active):hover {
  color: var(--qqm-text);
}
.import-input-section {
  padding: 20px;
}
.field-label {
  display: block;
  margin-bottom: 9px;
  font-size: 12px;
  font-weight: 600;
}
textarea,
.manual-songs input,
.import-save-bar input {
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: 100%;
  border: 1px solid var(--qqm-border);
  border-radius: 11px;
  outline: none;
  background: var(--qqm-surface);
  color: var(--qqm-text);
  font-size: 13px;
}
textarea {
  min-height: 100px;
  max-height: 220px;
  padding: 12px 13px;
  resize: vertical;
  line-height: 1.75;
}
textarea:focus,
input:focus,
select:focus {
  border-color: var(--qqm-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--qqm-primary) 12%, transparent);
}
.input-hint {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-top: 11px;
  color: var(--qqm-muted);
  font-size: 11px;
  line-height: 1.6;
}
.hint-copy {
  display: flex;
  min-width: 0;
  gap: 7px;
  align-items: flex-start;
}
.hint-copy i {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--qqm-primary-strong);
}
.hint-copy span {
  overflow-wrap: anywhere;
}
.hint-actions {
  flex: 0 0 auto;
}
.hint-actions button,
.import-error button {
  color: var(--qqm-primary-strong);
  white-space: nowrap;
}
.import-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 20px 20px;
  padding: 10px 11px;
  border-radius: 10px;
  background: color-mix(in srgb, #c04453 9%, transparent);
  color: #b03d4d;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.import-error i {
  flex: 0 0 auto;
  margin-top: 2px;
}
.import-error button {
  margin-left: auto;
}
.import-preview-section {
  position: sticky;
  top: 16px;
  min-height: 480px;
  padding: 22px;
}
.import-preview-section.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}
.preview-heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}
.preview-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 2px;
  color: var(--qqm-primary-strong);
  font-size: 11px;
  white-space: nowrap;
}
.import-note {
  min-height: 20px;
  margin: 8px 0 0;
  color: var(--qqm-muted);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.import-save-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--qqm-border);
}
.import-save-bar label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--qqm-muted);
  font-size: 12px;
}
.import-save-bar select {
  max-width: 140px;
  padding: 8px 10px;
  border: 1px solid var(--qqm-border);
  border-radius: 8px;
  outline: none;
  background: var(--qqm-surface);
  color: var(--qqm-text);
}
.import-save-bar input {
  flex: 1 1 180px;
  min-width: 0;
  max-width: 320px;
  padding: 8px 11px;
}
.import-save-bar > button {
  margin-left: auto;
}
.preview-empty {
  max-width: 300px;
  text-align: center;
}
.preview-empty-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 15px;
  background: var(--qqm-primary-soft);
  color: var(--qqm-primary-strong);
  font-size: 25px;
}
.preview-empty h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.preview-empty p {
  margin: 0;
  color: var(--qqm-muted);
  font-size: 12px;
  line-height: 1.8;
}
.import-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 13px;
  padding: 42px 20px 28px;
  text-align: center;
}
.import-success > i {
  color: var(--qqm-primary-strong);
  font-size: 44px;
}
.import-success h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.import-success p {
  margin: 0;
  color: var(--qqm-muted);
  font-size: 12px;
}
.manual-songs > div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 32px;
  gap: 8px;
  margin-bottom: 8px;
}
.manual-songs input {
  min-width: 0;
  padding: 10px 11px;
}
.manual-songs .music-list-button {
  margin-top: 3px;
}
button:focus-visible {
  outline: 2px solid var(--qqm-primary);
  outline-offset: 3px;
}
.spin {
  animation: import-spin 1s linear infinite;
}
@keyframes import-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 1100px) {
  .import-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .import-preview-section {
    position: static;
    min-height: 320px;
  }
  .import-preview-section.empty {
    min-height: 260px;
  }
}
@media (max-width: 640px) {
  .import-content {
    padding: 20px 14px 60px;
  }
  .import-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .import-heading-badge {
    align-self: flex-start;
  }
  .import-source-panel,
  .import-preview-section {
    border-radius: 14px;
  }
  .panel-heading,
  .import-input-section,
  .import-preview-section {
    padding: 17px;
  }
  .import-tabs {
    margin: 0 14px;
  }
  .import-tabs button {
    font-size: 11px;
  }
  .import-tabs button i {
    display: none;
  }
  .input-hint {
    flex-direction: column;
  }
  .hint-actions {
    align-self: flex-end;
  }
  .import-error {
    margin: 0 14px 14px;
  }
  .preview-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .import-save-bar > button {
    width: 100%;
    margin-left: 0;
  }
  .manual-songs > div {
    grid-template-columns: minmax(0, 1fr) 32px;
  }
  .manual-songs input:nth-child(3) {
    grid-column: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
}
</style>
