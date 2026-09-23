<script setup lang="ts">
const query = defineModel<string>('query', { required: true });
const sort = defineModel<string>('sort', { required: true });
const selecting = defineModel<boolean>('selecting', { required: true });
const density = defineModel<string>('density', { required: true });
withDefaults(
  defineProps<{
    count: number;
    total?: number;
    loading?: boolean;
    currentVisible?: boolean;
    defaultOrder?: string;
    history?: boolean;
    favorites?: boolean;
  }>(),
  { defaultOrder: '默认排序' }
);
defineEmits<{ play: []; locate: [] }>();
</script>

<template>
  <div class="music-list-toolbar">
    <div class="music-list-main-actions">
      <button
        class="music-list-button music-list-button--primary"
        :disabled="!count || loading"
        @click="$emit('play')"
      >
        <i class="ri-play-fill" aria-hidden="true" />播放全部
      </button>
      <slot name="actions" />
      <button
        class="music-list-button"
        :class="{ 'is-active': selecting }"
        :aria-pressed="selecting"
        :disabled="!count"
        @click="selecting = !selecting"
      >
        <i
          :class="selecting ? 'ri-check-line' : 'ri-checkbox-multiple-line'"
          aria-hidden="true"
        />{{ selecting ? '完成选择' : '批量操作' }}
      </button>
      <span class="music-list-count" aria-live="polite">{{
        query
          ? `找到 ${count} 首`
          : total && total > count
            ? `已加载 ${count} / ${total} 首`
            : `${count} 首歌曲`
      }}</span>
    </div>
    <div class="music-list-tools">
      <select v-model="sort" aria-label="歌曲排序">
        <option value="original">{{ defaultOrder }}</option>
        <option v-if="favorites" value="oldest">最早收藏</option>
        <option v-if="history" value="count">播放次数</option>
        <option value="title">歌曲名称</option>
        <option value="duration">歌曲时长</option>
      </select>
      <label class="music-list-search">
        <i class="ri-search-line" aria-hidden="true" />
        <input
          v-model="query"
          placeholder="搜索此列表"
          aria-label="搜索此列表"
          @keydown.esc="query = ''"
        />
        <button v-if="query" aria-label="清空列表搜索" @click="query = ''">
          <i aria-hidden="true" class="ri-close-line" />
        </button>
      </label>
      <button
        v-if="currentVisible"
        class="music-list-icon"
        title="定位正在播放"
        aria-label="定位正在播放"
        @click="$emit('locate')"
      >
        <i aria-hidden="true" class="ri-focus-3-line" />
      </button>
      <button
        class="music-list-icon"
        :aria-pressed="density === 'compact'"
        :title="density === 'compact' ? '切换为舒展列表' : '切换为紧凑列表'"
        :aria-label="density === 'compact' ? '切换为舒展列表' : '切换为紧凑列表'"
        @click="density = density === 'compact' ? 'normal' : 'compact'"
      >
        <i aria-hidden="true" :class="density === 'compact' ? 'ri-list-check-2' : 'ri-menu-line'" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.music-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 22px 0 20px;
}
.music-list-main-actions,
.music-list-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}
.music-list-tools {
  margin-left: auto;
  gap: 8px;
}
.music-list-count {
  color: var(--qqm-muted);
  font-size: 12px;
  margin-left: 4px;
  white-space: nowrap;
}
.music-list-tools select {
  max-width: 106px;
  font-size: 12px;
  color: var(--qqm-muted);
  border: 0;
  background: var(--qqm-bg);
  cursor: pointer;
}
.music-list-search {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  width: 180px;
  height: 36px;
  background: var(--qqm-surface-muted);
  border-radius: 20px;
  color: var(--qqm-muted);
}
.music-list-search input {
  width: 100%;
  min-width: 0;
  font-size: 12px;
  color: var(--qqm-text);
  background: transparent;
  border: 0;
  outline: none;
}
.music-list-search:focus-within {
  box-shadow: 0 0 0 1px var(--qqm-primary);
}
.music-list-search button {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
@container music-tracks (max-width: 850px) {
  .music-list-toolbar {
    gap: 12px;
  }
  .music-list-main-actions {
    flex: 1 0 100%;
  }
  .music-list-tools {
    flex: 1;
    margin: 0;
  }
  .music-list-search {
    margin-left: auto;
  }
}
@container music-tracks (max-width: 460px) {
  .music-list-count {
    flex: 1 0 100%;
  }
  .music-list-search {
    flex: 1;
    width: 120px;
  }
}
</style>
