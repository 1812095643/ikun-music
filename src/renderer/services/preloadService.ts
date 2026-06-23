import { Howl } from 'howler';

import type { SongResult } from '@/types/music';

const getSongArtistText = (song: SongResult) => {
  const artists = song.ar?.length ? song.ar : song.artists || song.song?.artists || [];
  return artists
    .map((artist: any) => artist?.name)
    .filter(Boolean)
    .join('/');
};

const normalizeFingerprintText = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const buildPreloadKey = (song: SongResult) => {
  const source = song.source || 'netease';
  const title = normalizeFingerprintText(song.name);
  const artist = normalizeFingerprintText(getSongArtistText(song));
  const url = song.playMusicUrl || '';
  return [source, song.id, title, artist, url].join('|');
};

class PreloadService {
  private songKeyMap: Map<string | number, Set<string>> = new Map();
  private loadingPromises: Map<string, Promise<Howl>> = new Map();
  private preloadedSounds: Map<string, Howl> = new Map();
  private canceledKeys: Set<string> = new Set();
  private cacheGenerations: Map<string, number> = new Map();

  private bindSongKey(songId: string | number, cacheKey: string) {
    if (!this.songKeyMap.has(songId)) this.songKeyMap.set(songId, new Set());
    this.songKeyMap.get(songId)!.add(cacheKey);
  }

  private getCacheGeneration(cacheKey: string) {
    return this.cacheGenerations.get(cacheKey) || 0;
  }

  private bumpCacheGeneration(cacheKey: string) {
    this.cacheGenerations.set(cacheKey, this.getCacheGeneration(cacheKey) + 1);
  }

  /**
   * 加载并验证音频
   * 如果已经在加载中，返回现有的 Promise
   * 如果已经加载完成，返回缓存的 Howl 实例
   */
  public async load(song: SongResult): Promise<Howl> {
    if (!song || !song.id) {
      throw new Error('无效的歌曲对象');
    }

    // 1. 检查是否有正在进行的加载
    const cacheKey = buildPreloadKey(song);
    this.bindSongKey(song.id, cacheKey);
    this.canceledKeys.delete(cacheKey);
    const generation = this.getCacheGeneration(cacheKey);

    if (this.loadingPromises.has(cacheKey)) {
      console.log(`[PreloadService] 歌曲 ${song.name} 正在加载中，复用现有请求`);
      return this.loadingPromises.get(cacheKey)!;
    }

    // 2. 检查是否有已完成的缓存
    if (this.preloadedSounds.has(cacheKey)) {
      const sound = this.preloadedSounds.get(cacheKey)!;
      if (sound.state() === 'loaded') {
        console.log(`[PreloadService] 歌曲 ${song.name} 已预加载完成，直接使用`);
        return sound;
      } else {
        // 如果缓存的音频状态不正常，清理并重新加载
        this.preloadedSounds.delete(cacheKey);
      }
    }

    // 3. 开始新的加载过程
    const loadPromise = this._performLoad(song);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const sound = await loadPromise;
      if (this.canceledKeys.has(cacheKey) || generation !== this.getCacheGeneration(cacheKey)) {
        sound.unload();
        this.canceledKeys.delete(cacheKey);
        throw new Error(`预加载已取消: ${song.name}`);
      }
      this.preloadedSounds.set(cacheKey, sound);
      return sound;
    } finally {
      if (this.loadingPromises.get(cacheKey) === loadPromise) {
        this.loadingPromises.delete(cacheKey);
      }
    }
  }

  /**
   * 执行实际的加载和验证逻辑
   */
  private async _performLoad(song: SongResult): Promise<Howl> {
    console.log(`[PreloadService] 开始加载歌曲: ${song.name}`);

    if (!song.playMusicUrl) {
      throw new Error('歌曲没有 URL');
    }

    // 创建初始音频实例
    const sound = await this._createSound(song.playMusicUrl);

    // 检查时长
    const duration = sound.duration();
    const expectedDuration = (song.dt || 0) / 1000;

    if (expectedDuration > 0 && duration > 0) {
      const durationDiff = Math.abs(duration - expectedDuration);
      // 如果实际时长远小于预期（可能是试听版），记录警告
      if (duration < expectedDuration * 0.5 && durationDiff > 10) {
        console.warn(
          `[PreloadService] 时长严重不足：实际 ${duration.toFixed(1)}s, 预期 ${expectedDuration.toFixed(1)}s (${song.name})，可能是试听版`
        );
        // 通过自定义事件通知上层，可用于后续自动切换音源
        window.dispatchEvent(
          new CustomEvent('audio-duration-mismatch', {
            detail: {
              songId: song.id,
              songName: song.name,
              actualDuration: duration,
              expectedDuration
            }
          })
        );
      } else if (durationDiff > 5) {
        console.warn(
          `[PreloadService] 时长差异警告：实际 ${duration.toFixed(1)}s, 预期 ${expectedDuration.toFixed(1)}s (${song.name})`
        );
      }
    }

    return sound;
  }

  private _createSound(url: string): Promise<Howl> {
    return new Promise((resolve, reject) => {
      const sound = new Howl({
        src: [url],
        html5: true,
        preload: true,
        autoplay: false,
        onload: () => resolve(sound),
        onloaderror: (_, err) => reject(err)
      });
    });
  }

  /**
   * 取消特定歌曲的预加载（如果可能）
   * 注意：Promise 无法真正取消，但我们可以清理结果
   */
  public cancel(songId: string | number) {
    const cacheKeys = this.songKeyMap.get(songId);
    cacheKeys?.forEach((cacheKey) => {
      if (this.preloadedSounds.has(cacheKey)) {
        const sound = this.preloadedSounds.get(cacheKey)!;
        sound.unload();
        this.preloadedSounds.delete(cacheKey);
      }
      this.loadingPromises.delete(cacheKey);
      this.canceledKeys.add(cacheKey);
      this.bumpCacheGeneration(cacheKey);
    });
    this.songKeyMap.delete(songId);
    // loadingPromises 中的任务会继续执行，但因为 preloadedSounds 中没有记录，
    // 下次请求时会重新加载（或者我们可以让 _performLoad 检查一个取消标记，但这增加了复杂性）
  }

  /**
   * 获取已预加载的音频实例（如果存在）
   */
  public getPreloadedSound(songId: string | number): Howl | undefined {
    const cacheKeys = this.songKeyMap.get(songId);
    if (!cacheKeys) return undefined;

    for (const cacheKey of cacheKeys) {
      const sound = this.preloadedSounds.get(cacheKey);
      if (sound?.state() === 'loaded') return sound;
    }

    return undefined;
  }

  /**
   * 消耗（使用）已预加载的音频
   * 从缓存中移除但不 unload（由调用方管理生命周期）
   * @returns 预加载的 Howl 实例，如果没有则返回 undefined
   */
  public consume(song: SongResult): Howl | undefined {
    const cacheKey = buildPreloadKey(song);
    const sound = this.preloadedSounds.get(cacheKey);
    if (sound) {
      this.preloadedSounds.delete(cacheKey);
      console.log(`[PreloadService] 消耗预加载的歌曲: ${song.id}`);
      return sound;
    }
    return undefined;
  }

  /**
   * 清理所有预加载资源
   */
  public clearAll() {
    this.preloadedSounds.forEach((sound) => sound.unload());
    this.preloadedSounds.clear();
    this.loadingPromises.clear();
    this.songKeyMap.clear();
    this.canceledKeys.clear();
    this.cacheGenerations.clear();
  }
}

export const preloadService = new PreloadService();
