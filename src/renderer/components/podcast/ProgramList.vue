<script setup lang="ts">
import { usePlayerStore } from '@/store';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import type { SongResult } from '@/types/music';
import type { DjProgram } from '@/types/podcast';
import { formatNumber, getImgUrl, secondToMinute } from '@/utils';

defineProps<{
  programs: DjProgram[];
  loading?: boolean;
}>();

const playerStore = usePlayerStore();
const playHistoryStore = usePlayHistoryStore();

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const playProgram = async (program: DjProgram) => {
  try {
    const songData: SongResult = {
      id: program.mainSong.id,
      name: program.mainSong.name || program.name || '播客节目',
      duration: program.mainSong.duration,
      picUrl: program.coverUrl,
      ar: [
        {
          id: program.radio.id,
          name: program.radio.name,
          picId: 0,
          img1v1Id: 0,
          briefDesc: '',
          picUrl: '',
          img1v1Url: '',
          albumSize: 0,
          alias: [],
          trans: '',
          musicSize: 0,
          topicPerson: 0
        }
      ],
      al: {
        id: program.radio.id,
        name: program.radio.name,
        picUrl: program.coverUrl,
        type: '',
        size: 0,
        picId: 0,
        blurPicUrl: '',
        companyId: 0,
        pic: 0,
        picId_str: '',
        publishTime: 0,
        description: '',
        tags: '',
        company: '',
        briefDesc: '',
        artist: {
          id: 0,
          name: '',
          picUrl: '',
          alias: [],
          albumSize: 0,
          picId: 0,
          img1v1Url: '',
          img1v1Id: 0,
          trans: '',
          briefDesc: '',
          musicSize: 0,
          topicPerson: 0
        },
        songs: [],
        alias: [],
        status: 0,
        copyrightId: 0,
        commentThreadId: '',
        artists: [],
        subType: '',
        onSale: false,
        mark: 0
      },
      source: 'netease',
      count: 0
    };

    await playerStore.setPlay(songData);
    playHistoryStore.addPodcast(program);
  } catch (error) {
    console.error('播放节目失败:', error);
  }
};
</script>

<template>
  <div class="program-list">
    <n-spin :show="loading">
      <div v-if="programs.length === 0" class="program-empty">
        <i class="ri-broadcast-line"></i>
        <span>暂无节目</span>
      </div>

      <div v-else class="program-list-body">
        <div
          v-for="program in programs"
          :key="program.id"
          class="program-row flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group"
          @click="playProgram(program)"
        >
          <div class="program-cover relative h-14 w-14 flex-shrink-0">
            <img
              :src="getImgUrl(program.coverUrl, '100y100')"
              :alt="program.mainSong.name"
              class="h-full w-full rounded-md object-cover"
            />
            <div
              class="program-play-mask absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
            >
              <i class="ri-play-fill text-xl text-white"></i>
            </div>
          </div>

          <div class="program-main min-w-0 flex-1">
            <h4
              class="program-title truncate text-sm font-medium text-neutral-900 transition-colors group-hover:text-primary dark:text-neutral-100"
            >
              {{ program.mainSong.name || program.name }}
            </h4>
            <p class="program-desc mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {{ program.description }}
            </p>
            <div class="program-meta mt-1 text-xs text-neutral-400">
              {{ formatDate(program.createTime) }} ·
              {{ secondToMinute(program.mainSong.duration / 1000) }}
            </div>
          </div>

          <div class="program-stats flex-shrink-0 text-xs text-neutral-400">
            <span>
              <i class="ri-headphone-line"></i>
              {{ formatNumber(program.listenerCount) }}
            </span>
            <span>
              <i class="ri-message-2-line"></i>
              {{ formatNumber(program.commentCount) }}
            </span>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>
<style scoped>
.program-list {
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 12px;
  background: color-mix(in srgb, var(--qqm-surface, #fff) 86%, transparent);
  overflow: hidden;
}

.program-list-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.program-row {
  position: relative;
  min-height: 72px;
  border: 1px solid transparent;
  border-radius: 0;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.program-row:hover {
  border-color: transparent;
  background-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface, #fff));
}

.program-row::after {
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 82px;
  height: 1px;
  background: var(--qqm-border);
  content: '';
  opacity: 0.72;
}

.program-row:last-child::after,
.program-row:hover::after {
  opacity: 0;
}

.program-cover img {
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 5%);
}

.program-play-mask {
  background: rgb(0 0 0 / 32%);
}

.program-desc {
  max-width: min(680px, 72vw);
}

.program-meta {
  letter-spacing: 0.01em;
}

.program-stats {
  display: flex;
  width: 132px;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.program-stats span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: color-mix(in srgb, currentColor 84%, transparent);
  white-space: nowrap;
}

.program-stats i {
  font-size: 14px;
  color: color-mix(in srgb, var(--qqm-primary) 54%, currentColor);
}

.program-empty {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--qqm-muted, #7a828c);
  font-size: 13px;
  font-weight: 500;
}

.program-empty i {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 18%, var(--qqm-border));
  border-radius: 14px;
  background: color-mix(in srgb, var(--qqm-primary-soft) 34%, transparent);
  color: var(--qqm-primary);
  font-size: 22px;
}

@media (max-width: 768px) {
  .program-stats {
    display: none;
  }

  .program-row::after {
    left: 76px;
  }
}
</style>
