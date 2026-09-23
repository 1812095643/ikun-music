<script setup lang="ts">
import { useRouter } from 'vue-router';

import MusicTrackList from '@/components/common/music-list/MusicTrackList.vue';
import type { SongResult } from '@/types/music';

defineProps<{
  songs: SongResult[];
  kind: 'favorites' | 'history' | 'podcasts';
  loading?: boolean;
  missingCount?: number;
}>();
const emit = defineEmits<{ retry: []; remove: [song: SongResult] }>();
const router = useRouter();
</script>

<template>
  <music-track-list
    :songs="songs"
    :kind="kind"
    :loading="loading"
    :error="
      !loading && missingCount && !songs.length
        ? '收藏记录仍然保留，连接网络后可以重新加载。'
        : undefined
    "
    :default-order="kind === 'favorites' ? '最近收藏' : '最近播放'"
    scrollable
    @remove="emit('remove', $event)"
    @retry="emit('retry')"
  >
    <template #notice>
      <div v-if="missingCount && songs.length" class="library-notice" role="status">
        {{
          loading
            ? '正在补齐收藏歌曲信息…'
            : `${missingCount} 首收藏暂未加载，已有歌曲可以正常播放。`
        }}
        <button v-if="!loading" @click="emit('retry')">重新加载</button>
      </div>
    </template>
    <template #empty-action>
      <button class="music-list-button" @click="router.push('/')">
        去发现音乐<i class="ri-arrow-right-line" />
      </button>
    </template>
  </music-track-list>
</template>

<style scoped>
.library-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  color: var(--qqm-muted);
  font-size: 12px;
  padding: 12px 0;
}
.library-notice button {
  color: var(--qqm-primary-strong);
}
</style>
