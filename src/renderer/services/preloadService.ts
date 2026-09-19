import { Howl, Howler } from 'howler';

import type { SongResult } from '@/types/music';

import { prepareAudioTransport } from './audioTransport';

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
  private cancelLoads = new Map<string, () => void>();

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
    const loadPromise = this._performLoad(song, cacheKey);
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
  private async _performLoad(song: SongResult, cacheKey: string): Promise<Howl> {
    console.log(`[PreloadService] 开始加载歌曲: ${song.name}`);

    if (!song.playMusicUrl) {
      throw new Error('歌曲没有 URL');
    }

    // 创建初始音频实例
    let sound: Howl;
    try {
      sound = await this._createSound(song.playMusicUrl, cacheKey);
    } catch (error) {
      if (
        (error as Error)?.name === 'AbortError' ||
        this.canceledKeys.has(cacheKey) ||
        !/^https?:\/\//i.test(song.playMusicUrl)
      )
        throw error;
      // 少数音源不接受 Range。原生通道不可用时退回直出，保留播放，音效面板显示实际状态。
      sound = await this._createSound(song.playMusicUrl, cacheKey, true);
    }

    // 检查时长
    const duration = sound.duration();
    const expectedDuration = (song.dt || song.duration || 0) / 1000;

    if (expectedDuration > 0 && duration > 0) {
      const durationDiff = Math.abs(duration - expectedDuration);
      // 部分接口把多首受限歌曲都指向同一段提示音，必须在出声前拒绝，不能只记录警告。
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
        sound.unload();
        throw new Error('音源返回的音频时长与歌曲不符，请切换音源或稍后重试');
      } else if (durationDiff > 5) {
        console.warn(
          `[PreloadService] 时长差异警告：实际 ${duration.toFixed(1)}s, 预期 ${expectedDuration.toFixed(1)}s (${song.name})`
        );
      }
    }

    return sound;
  }

  private async _createSound(url: string, cacheKey: string, direct = false): Promise<Howl> {
    const transport = await prepareAudioTransport(url, direct);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelLoads.delete(cacheKey);
        if (error) {
          sound.unload();
          reject(error);
        } else resolve(sound);
      };
      const sound = new Howl({
        src: [transport.url],
        format: [url.split('?')[0].match(/\.(mp3|aac|flac|ogg|m4a|wav|opus)$/i)?.[1] || 'mp3'],
        html5: true,
        preload: false,
        autoplay: false,
        onload: () => finish(),
        onloaderror: (_, err) => finish(err || new Error('音频暂时无法加载'))
      });
      const unload = sound.unload.bind(sound);
      sound.unload = () => {
        transport.release();
        const result = unload();
        // 接入过 WebAudio 的媒体元素永远不能恢复直出，不能让 Howler 把它复用给原声回退。
        const pool = (Howler as any)._html5AudioPool as HTMLAudioElement[] | undefined;
        if (pool) (Howler as any)._html5AudioPool = pool.filter((node) => !(node as any).source);
        return result;
      };
      this.cancelLoads.set(cacheKey, () =>
        finish(new DOMException('播放请求已取消', 'AbortError'))
      );
      const timer = setTimeout(() => finish(new Error('音频加载超时，请稍后重试')), 20000);
      sound.load();
      const node = (sound as any)._sounds?.[0]?._node as HTMLAudioElement | undefined;
      if (node) {
        const useCors =
          transport.url.includes('musicstream.localhost') ||
          transport.url.startsWith('musicstream:') ||
          url.startsWith('local:///');
        node.crossOrigin = useCors ? 'anonymous' : null;
        node.load();
      }
    });
  }

  /**
   * 取消特定歌曲的预加载（如果可能）
   * 卸载加载中的 Howl 并结束等待，后续请求无需等待旧音频超时。
   */
  public cancel(songId: string | number) {
    const cacheKeys = this.songKeyMap.get(songId);
    cacheKeys?.forEach((cacheKey) => {
      this.cancelLoads.get(cacheKey)?.();
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
    this.cancelLoads.forEach((cancel) => cancel());
    this.cancelLoads.clear();
    this.preloadedSounds.forEach((sound) => sound.unload());
    this.preloadedSounds.clear();
    this.loadingPromises.clear();
    this.songKeyMap.clear();
    this.canceledKeys.clear();
    this.cacheGenerations.clear();
  }
}

export const preloadService = new PreloadService();
