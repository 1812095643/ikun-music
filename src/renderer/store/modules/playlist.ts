import { debounce } from 'lodash';
import { createDiscreteApi } from 'naive-ui';
import { defineStore, storeToRefs } from 'pinia';
import { computed, ref, shallowRef, triggerRef } from 'vue';

import i18n from '@/../i18n/renderer';
import { useSongDetail } from '@/hooks/usePlayerHooks';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { preloadService } from '@/services/preloadService';
import type { SongResult } from '@/types/music';
import { getImgUrl, isAndroidRuntime } from '@/utils';
import { performShuffle, preloadCoverImage } from '@/utils/playerUtils';

import { useIntelligenceModeStore } from './intelligenceMode';
import { usePlayerCoreStore } from './playerCore';
import { useSleepTimerStore } from './sleepTimer';

// 延迟初始化 message，避免 chunk 循环依赖导致 TDZ 错误
let _message: ReturnType<typeof createDiscreteApi>['message'] | null = null;
const getMessage = () => {
  if (!_message) _message = createDiscreteApi(['message']).message;
  return _message;
};

/**
 * 精简 SongResult 对象，只保留持久化必要字段
 * 排除大体积字段：lyric, song, playMusicUrl, backgroundColor, primaryColor
 */
const minifySong = (s: SongResult) => ({
  id: s.id,
  name: s.name,
  picUrl: s.picUrl,
  ar: s.ar?.map((a) => ({ id: a.id, name: a.name })),
  al: s.al,
  source: s.source,
  dt: s.dt,
  localFilePath: s.localFilePath,
  onlineId: s.onlineId,
  lyricPath: s.lyricPath,
  playMusicUrl: s.playMusicUrl?.startsWith('local://') ? s.playMusicUrl : undefined
});

const minifySongList = (list: SongResult[] | undefined) => list?.map(minifySong) ?? [];

/**
 * 防抖 localStorage 包装，降低写入频率
 * 通过 pendingWrites 跟踪未写入数据，beforeunload 时刷新
 */
const pendingWrites = new Map<string, string>();

const flushPendingWrites = () => {
  pendingWrites.forEach((value, key) => {
    localStorage.setItem(key, value);
  });
  pendingWrites.clear();
};

const debouncedSetItem = debounce((key: string, value: string) => {
  localStorage.setItem(key, value);
  pendingWrites.delete(key);
}, 2000);

const debouncedLocalStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    pendingWrites.set(key, value);
    debouncedSetItem(key, value);
  }
};

// 正常关闭时刷新未写入的数据
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingWrites);
}

/**
 * 播放列表管理 Store
 * 负责：播放列表、索引、播放模式、预加载、上/下一首
 */
export const usePlaylistStore = defineStore(
  'playlist',
  () => {
    // ==================== 状态 ====================
    // 状态将由 pinia-plugin-persistedstate 自动从 localStorage 恢复
    const playList = shallowRef<SongResult[]>([]);
    const playListIndex = ref(0);
    const playMode = ref(0);
    const originalPlayList = shallowRef<SongResult[]>([]);
    const playListDrawerVisible = ref(false);

    const YOUTUBE_RECOMMEND_APPEND_LIMIT = 18;
    const youtubeRecommendLoading = ref(false);
    const youtubeRecommendSeedCache = new Set<string>();
    let navigationVersion = 0;
    let navigationTimer: ReturnType<typeof setTimeout> | undefined;
    let settleNavigation: (() => void) | undefined;

    const cancelNavigation = () => {
      navigationVersion++;
      clearTimeout(navigationTimer);
      navigationTimer = undefined;
      settleNavigation?.();
      settleNavigation = undefined;
    };

    // ==================== Computed ====================
    const currentPlayList = computed(() => playList.value);
    const currentPlayListIndex = computed(() => playListIndex.value);

    // ==================== Actions ====================

    const isYoutubeLikeSong = (song?: SongResult) =>
      song?.source === 'ytmusic' || song?.source === 'piped';

    const appendYoutubeRecommendations = async (seedSong?: SongResult) => {
      if (!isYoutubeLikeSong(seedSong) || !seedSong?.id || youtubeRecommendLoading.value) {
        return false;
      }

      const videoId = String(seedSong.id);
      if (youtubeRecommendSeedCache.has(videoId)) return false;

      try {
        youtubeRecommendLoading.value = true;
        const listSnapshot = playList.value;
        const { getYoutubeMusicNextSongs } = await import('@/api/youtubeMusic');
        const songs = await getYoutubeMusicNextSongs(videoId, YOUTUBE_RECOMMEND_APPEND_LIMIT);
        if (playList.value !== listSnapshot) return false;
        const existingKeys = new Set(
          playList.value.map((song) => `${song.source || 'netease'}-${String(song.id)}`)
        );
        const nextSongs = songs.filter((song) => {
          const key = `${song.source || 'netease'}-${String(song.id)}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        if (nextSongs.length === 0) {
          youtubeRecommendSeedCache.add(videoId);
          return false;
        }

        // 根因：接口文档里的 YouTube Music next 推荐接口之前没有接入播放队列，
        // 用户播放 YouTube/Piped 兜底歌曲时，队列播完就停，公开推荐能力没有真实入口。
        // 解决：只在外部音源队列接近末尾时按当前 videoId 追加推荐，且去重、不触碰
        // 酷我/网易等常规队列，避免改变用户已有播放模式语义。
        playList.value = [...playList.value, ...nextSongs];
        youtubeRecommendSeedCache.add(videoId);
        return true;
      } catch (error) {
        console.warn('YouTube Music 推荐列表读取失败，保留原播放队列。', error);
        youtubeRecommendSeedCache.add(videoId);
        return false;
      } finally {
        youtubeRecommendLoading.value = false;
      }
    };

    const ensureYoutubeRecommendationsNearEnd = async (currentIndex: number) => {
      const remainingCount = playList.value.length - currentIndex - 1;
      if (remainingCount > 2) return;
      await appendYoutubeRecommendations(playList.value[currentIndex]);
    };

    /**
     * 获取歌曲详情并预加载
     */
    const fetchSongs = async (startIndex: number, endIndex: number) => {
      try {
        const listSnapshot = playList.value;
        const requestId = playbackRequestManager.getCurrentRequestId();
        const songs = playList.value.slice(
          Math.max(0, startIndex),
          Math.min(endIndex, playList.value.length)
        );
        const { getSongDetail } = useSongDetail();

        const detailedSongs = await Promise.all(
          songs.map(async (song: SongResult) => {
            try {
              if (!song.playMusicUrl || (song.source === 'netease' && !song.backgroundColor)) {
                return await getSongDetail({ ...song }, requestId || undefined);
              }
              return song;
            } catch (error) {
              console.error('获取歌曲详情失败:', error);
              return song;
            }
          })
        );

        const nextSong = detailedSongs[0];
        if (
          playList.value !== listSnapshot ||
          requestId !== playbackRequestManager.getCurrentRequestId()
        )
          return;

        detailedSongs.forEach((song, index) => {
          if (
            song &&
            startIndex + index < playList.value.length &&
            playList.value[startIndex + index]?.id === song.id
          ) {
            playList.value[startIndex + index] = song;
          }
        });
        // 触发 shallowRef 响应式更新（直接修改元素不会自动触发）
        triggerRef(playList);

        // 预加载下一首歌曲的音频和封面
        if (nextSong) {
          if (nextSong.playMusicUrl) {
            void preloadService.load(nextSong).catch((error) => {
              console.warn('预加载下一首音频失败，播放时会重新加载:', error);
            });
          }
          if (nextSong.picUrl) {
            preloadCoverImage(nextSong.picUrl, getImgUrl);
          }
        }
      } catch (error) {
        console.error('获取歌曲列表失败:', error);
      }
    };

    /**
     * 智能预加载下一首歌曲
     */
    const preloadNextSongs = (currentIndex: number) => {
      // Android 第一阶段优先保证当前歌曲稳定播放，先不并发预加载下一首音频。
      if (isAndroidRuntime) return;
      if (playList.value.length <= 1) return;

      let nextIndex: number;

      if (playMode.value === 0) {
        // 顺序播放模式
        if (currentIndex >= playList.value.length - 1) {
          return;
        }
        nextIndex = currentIndex + 1;
      } else {
        // 循环播放和随机播放模式
        nextIndex = (currentIndex + 1) % playList.value.length;
      }

      const endIndex = Math.min(nextIndex + 2, playList.value.length);

      if (nextIndex < playList.value.length) {
        fetchSongs(nextIndex, endIndex);

        // 循环模式且接近列表末尾，预加载列表开头
        if (
          (playMode.value === 1 || playMode.value === 2) &&
          nextIndex + 1 >= playList.value.length &&
          playList.value.length > 2
        ) {
          setTimeout(() => {
            fetchSongs(0, 1);
          }, 1000);
        }
      }
    };

    /**
     * 应用随机播放
     */
    const shufflePlayList = () => {
      console.log('[PlaylistStore] shufflePlayList called');
      if (playList.value.length === 0) return;

      // 保存原始列表
      if (originalPlayList.value.length === 0) {
        console.log('[PlaylistStore] Saving original list, length:', playList.value.length);
        originalPlayList.value = [...playList.value];
      }

      const currentSong = playList.value[playListIndex.value];
      console.log('[PlaylistStore] Current song before shuffle:', currentSong?.name);

      // 执行洗牌
      const shuffled = performShuffle([...playList.value], currentSong);
      // 确保触发 shallowRef 的响应式
      playList.value = [...shuffled];
      playListIndex.value = 0;

      console.log('[PlaylistStore] List shuffled, new length:', playList.value.length);
      console.log('[PlaylistStore] New first song:', playList.value[0]?.name);
    };

    /**
     * 恢复原始播放列表顺序
     */
    const restoreOriginalOrder = () => {
      console.log('[PlaylistStore] restoreOriginalOrder called');
      if (originalPlayList.value.length === 0) return;

      const currentSong = playList.value[playListIndex.value];
      console.log('[PlaylistStore] Current song before restore:', currentSong?.name);

      playList.value = [...originalPlayList.value];
      originalPlayList.value = [];

      // 找到当前歌曲在原始列表中的索引
      if (currentSong) {
        const index = playList.value.findIndex((s) => s.id === currentSong.id);
        if (index !== -1) {
          playListIndex.value = index;
        }
      }
      console.log('[PlaylistStore] Original order restored, new index:', playListIndex.value);
    };

    /**
     * 设置播放列表
     */
    const setPlayList = (
      list: SongResult[],
      keepIndex: boolean = false,
      fromIntelligenceMode: boolean = false
    ) => {
      cancelNavigation();
      // 如果不是从心动模式调用，清除心动模式状态并切换播放模式
      if (!fromIntelligenceMode) {
        const intelligenceStore = useIntelligenceModeStore();
        console.log('[PlaylistStore.setPlayList] 检查心动模式状态:', {
          isIntelligenceMode: intelligenceStore.isIntelligenceMode,
          currentPlayMode: playMode.value,
          fromIntelligenceMode
        });

        if (intelligenceStore.isIntelligenceMode) {
          console.log('[PlaylistStore] 退出心动模式，切换播放模式为顺序播放');
          playMode.value = 0;
          // 清除心动模式状态
          intelligenceStore.clearIntelligenceMode(true);
          console.log('[PlaylistStore] 心动模式已退出，新的播放模式:', playMode.value);
        }
      }

      // 当新播放列表长度>1时，清除FM模式标志（FM播放列表只有1首）
      if (list.length > 1) {
        const playerCore = usePlayerCoreStore();
        playerCore.isFmPlaying = false;
      }

      if (list.length === 0) {
        playList.value = [];
        playListIndex.value = 0;
        originalPlayList.value = [];
        return;
      }

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      // 根据当前播放模式处理新的播放列表
      if (playMode.value === 2) {
        // 随机模式
        console.log('随机模式下设置新播放列表，保存原始顺序并洗牌');

        originalPlayList.value = [...list];

        const currentSong = playMusic.value;
        const shuffledList = performShuffle(list, currentSong);

        if (currentSong && currentSong.id) {
          const currentSongIndex = shuffledList.findIndex((song) => song.id === currentSong.id);
          playListIndex.value =
            currentSongIndex !== -1 ? 0 : keepIndex ? Math.max(0, playListIndex.value) : 0;
        } else {
          playListIndex.value = keepIndex ? Math.max(0, playListIndex.value) : 0;
        }

        playList.value = shuffledList;
      } else {
        console.log('顺序/循环模式下设置新播放列表');
        if (originalPlayList.value.length > 0) {
          originalPlayList.value = [];
        }

        if (!keepIndex) {
          const foundIndex = list.findIndex((item) => item.id === playMusic.value.id);
          playListIndex.value = foundIndex !== -1 ? foundIndex : 0;
        }

        playList.value = list;
      }
      // pinia-plugin-persistedstate 会自动保存状态
    };

    /**
     * 添加到下一首播放
     */
    const addToNextPlay = (song: SongResult) => {
      const list = [...playList.value];
      const currentIndex = playListIndex.value;

      // 如果歌曲已在播放列表中，先移除
      const existingIndex = list.findIndex((item) => item.id === song.id);
      if (existingIndex !== -1) {
        list.splice(existingIndex, 1);
        if (existingIndex <= currentIndex) {
          playListIndex.value = Math.max(0, playListIndex.value - 1);
        }
      }

      // 插入到当前播放歌曲的下一个位置
      const insertIndex = playListIndex.value + 1;
      list.splice(insertIndex, 0, song);

      setPlayList(list, true);
    };

    /**
     * 从播放列表移除歌曲
     */
    const removeFromPlayList = (id: number | string) => {
      const index = playList.value.findIndex((item) => item.id === id);
      if (index === -1) return;

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      const removedCurrent = id === playMusic.value.id;

      const newPlayList = [...playList.value];
      newPlayList.splice(index, 1);
      setPlayList(newPlayList);
      if (removedCurrent) {
        const nextSong = newPlayList[Math.min(index, newPlayList.length - 1)];
        if (nextSong) void setPlay(nextSong);
        else void clearPlayAll();
      }
    };

    /**
     * 清空播放列表
     */
    const clearPlayAll = async () => {
      cancelNavigation();
      playbackRequestManager.cancelAllRequests();
      const { audioService } = await import('@/services/audioService');
      const playerCore = usePlayerCoreStore();

      audioService.pause();
      {
        playerCore.playMusic = {} as SongResult;
        playerCore.playMusicUrl = '';
        playList.value = [];
        playListIndex.value = 0;
        originalPlayList.value = [];
        // 只清除 playerCore 的 localStorage（这些由 playerCore store 管理）
        localStorage.removeItem('currentPlayMusic');
        localStorage.removeItem('currentPlayMusicUrl');
        // playlist 状态由 pinia-plugin-persistedstate 自动管理
      }
    };

    /**
     * 切换播放模式
     */
    const togglePlayMode = async () => {
      const wasRandom = playMode.value === 2;
      const wasIntelligence = playMode.value === 3;

      // 心动模式(3)不参与循环切换，仅通过 SearchBar 入口进入
      // 如果当前是心动模式，切换回顺序播放
      const newMode = wasIntelligence ? 0 : (playMode.value + 1) % 3;

      const isRandom = newMode === 2;

      console.log(`[PlaylistStore] togglePlayMode: ${playMode.value} -> ${newMode}`);
      playMode.value = newMode;

      // 切换到随机模式时洗牌
      if (isRandom && !wasRandom && playList.value.length > 0) {
        shufflePlayList();
        console.log('切换到随机模式，洗牌播放列表');
      }

      // 从随机模式切换出去时恢复原始顺序
      if (!isRandom && wasRandom) {
        restoreOriginalOrder();
        console.log('切换出随机模式，恢复原始顺序');
      }

      // 从心动模式切换出去
      if (wasIntelligence) {
        console.log('退出心动模式');
        const intelligenceStore = useIntelligenceModeStore();
        intelligenceStore.clearIntelligenceMode(true);
      }
    };

    /** 快速点击只加载最后选择的歌曲，旧请求和失败重试不能改写新目标。 */
    const requestNavigation = (direction: 1 | -1): Promise<void> => {
      if (!playList.value.length) return Promise.resolve();
      const playerCore = usePlayerCoreStore();
      const fromIndex = playListIndex.value;
      const atEnd =
        direction === 1 && playMode.value === 0 && fromIndex >= playList.value.length - 1;
      if (atEnd && (navigationTimer || playerCore.playMusic.playLoading)) return Promise.resolve();
      cancelNavigation();
      playbackRequestManager.cancelAllRequests();
      playerCore.userPlayIntent = true;
      const version = navigationVersion;
      const targetIndex = atEnd
        ? fromIndex
        : (fromIndex + direction + playList.value.length) % playList.value.length;
      playListIndex.value = targetIndex;
      const target = playList.value[targetIndex];
      return new Promise<void>((resolve) => {
        settleNavigation = resolve;
        navigationTimer = setTimeout(() => {
          navigationTimer = undefined;
          void (async () => {
            try {
              if (version !== navigationVersion || !playerCore.userPlayIntent) return;
              if (atEnd) {
                const appended = await appendYoutubeRecommendations(target);
                if (version !== navigationVersion) return;
                if (appended) {
                  void requestNavigation(1);
                  return;
                }
                await playerCore.handlePause();
                const sleepTimer = useSleepTimerStore();
                if (sleepTimer.sleepTimer.type === 'end') sleepTimer.stopPlayback();
                return;
              }
              const success = await playerCore.handlePlayMusic({ ...target }, true);
              if (version !== navigationVersion) return;
              if (success) {
                void ensureYoutubeRecommendationsNearEnd(targetIndex);
                useSleepTimerStore().handleSongChange();
              }
            } catch (error) {
              if (version === navigationVersion) console.warn('切歌暂未完成：', error);
            } finally {
              if (version === navigationVersion) settleNavigation = undefined;
              resolve();
            }
          })();
        }, 100);
      });
    };

    const nextPlay = () => requestNavigation(1);
    const prevPlay = () => requestNavigation(-1);

    /**
     * 设置播放列表抽屉显示状态
     */
    const setPlayListDrawerVisible = (value: boolean) => {
      playListDrawerVisible.value = value;
    };

    /**
     * 设置播放（兼容旧API）
     */
    const setPlay = async (song: SongResult) => {
      cancelNavigation();
      try {
        const playerCore = usePlayerCoreStore();

        // 检查URL是否已过期
        if (song.expiredAt && song.expiredAt < Date.now()) {
          // 本地音乐（local:// 协议）不会过期
          if (!song.playMusicUrl?.startsWith('local://')) {
            console.info(`歌曲URL已过期，重新获取: ${song.name}`);
            song.playMusicUrl = undefined;
            song.expiredAt = undefined;
          }
        }
        if (
          playerCore.playMusic.id === song.id &&
          playerCore.playMusic.source === song.source &&
          playerCore.playMusic.playLoading &&
          !song.isFirstPlay
        ) {
          await playerCore.handlePause();
          return true;
        }

        // 如果是当前正在播放的音乐，则切换播放/暂停状态
        if (
          playerCore.playMusic.id === song.id &&
          playerCore.playMusic.source === song.source &&
          !playerCore.playMusic.playLoading &&
          playerCore.playMusic.playMusicUrl === song.playMusicUrl &&
          !song.isFirstPlay
        ) {
          if (playerCore.play) {
            playerCore.setPlayMusic(false);
            const { audioService } = await import('@/services/audioService');
            audioService.pause();
            playerCore.userPlayIntent = false;
          } else {
            playerCore.setPlayMusic(true);
            playerCore.userPlayIntent = true;
            const { audioService } = await import('@/services/audioService');
            const sound = audioService.getCurrentSound();
            if (sound) {
              audioService.resume();
              // 在恢复播放时也进行状态检测，防止URL已过期导致无声
              playerCore.checkPlaybackState(playerCore.playMusic);
            } else {
              console.warn('[PlaylistStore.setPlay] 无可用音频实例，尝试重建播放链路');
              const recoverSong = {
                ...playerCore.playMusic,
                isFirstPlay: true,
                playMusicUrl: playerCore.playMusic.playMusicUrl?.startsWith('local://')
                  ? playerCore.playMusic.playMusicUrl
                  : undefined
              };
              const recovered = await playerCore.handlePlayMusic(recoverSong, true);
              if (!recovered) {
                playerCore.setIsPlay(false);
                getMessage().error(i18n.global.t('player.playFailed'));
              }
            }
          }
          return;
        }

        if (song.isFirstPlay) {
          song.isFirstPlay = false;
        }

        // 查找歌曲在播放列表中的索引
        const songIndex = playList.value.findIndex(
          (item: SongResult) => item.id === song.id && item.source === song.source
        );

        // 更新播放索引
        if (songIndex !== -1 && songIndex !== playListIndex.value) {
          console.log('歌曲索引不匹配，更新为:', songIndex);
          playListIndex.value = songIndex;
        }

        const success = await playerCore.handlePlayMusic(song);

        // playerCore 的状态由其自己的 store 管理

        return success;
      } catch (error) {
        console.error('设置播放失败:', error);
        return false;
      }
    };

    /**
     * 初始化播放列表
     * 注意：状态已由 pinia-plugin-persistedstate 自动恢复
     * 这里只需要处理特殊逻辑（如随机模式的恢复）
     */
    const initializePlaylist = async () => {
      // 重启后恢复随机播放状态
      if (playMode.value === 2 && playList.value.length > 0) {
        if (originalPlayList.value.length === 0) {
          console.log('重启后恢复随机播放模式，重新洗牌播放列表');
          shufflePlayList();
        } else {
          console.log('重启后恢复随机播放模式，播放列表已是洗牌状态');
        }
      }
    };

    return {
      // 状态
      playList,
      playListIndex,
      playMode,
      originalPlayList,
      playListDrawerVisible,

      // Computed
      currentPlayList,
      currentPlayListIndex,

      // Actions
      setPlayList,
      addToNextPlay,
      removeFromPlayList,
      clearPlayAll,
      togglePlayMode,
      shufflePlayList,
      restoreOriginalOrder,
      preloadNextSongs,
      nextPlay,
      prevPlay,
      setPlayListDrawerVisible,
      setPlay,
      initializePlaylist,
      fetchSongs,
      updateSong: (song: SongResult) => {
        const index = playList.value.findIndex(
          (item) => item.id === song.id && item.source === song.source
        );
        if (index !== -1) {
          playList.value[index] = song;
          // 触发响应式更新
          playList.value = [...playList.value];
        }
      }
    };
  },
  {
    // 配置 pinia-plugin-persistedstate（精简序列化 + 防抖写入）
    persist: {
      key: 'playlist-store',
      storage: debouncedLocalStorage,
      pick: ['playList', 'playListIndex', 'playMode', 'originalPlayList'],
      serializer: {
        serialize: (state: any) => {
          return JSON.stringify({
            ...state,
            playList: minifySongList(state.playList),
            originalPlayList: minifySongList(state.originalPlayList)
          });
        },
        deserialize: JSON.parse
      }
    }
  }
);
