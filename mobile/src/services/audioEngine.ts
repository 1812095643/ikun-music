import { NativeAudio } from './nativeAudio';
// #ifdef H5
import { WebAudio } from './webAudio';
// #endif
export interface MusicAudio {
  destroy?(): void;
  src: string;
  trackId?: string;
  title?: string;
  singer?: string;
  epname?: string;
  coverImgUrl?: string;
  startTime?: number;
  currentTime: number;
  duration: number;
  paused: boolean;
  play(): void;
  pause(): void;
  stop(): void;
  seek(position: number): void;
  onPlay(callback: () => void): void;
  onPause(callback: () => void): void;
  onStop(callback: () => void): void;
  onEnded(callback: () => void): void;
  onError(callback: (error: unknown) => void): void;
  onWaiting(callback: () => void): void;
  onCanplay(callback: () => void): void;
  onTimeUpdate(callback: () => void): void;
  onNext?(callback: () => void): void;
  onPrev?(callback: () => void): void;
  onPlaybackIntent?(callback: (playing: boolean) => void): void;
  setNavigation?(previous: boolean, next: boolean): void;
  synchronize?(): void;
}

export function createMusicAudio(): MusicAudio {
  // #ifdef APP-PLUS
  // Android 必须由原生媒体服务播放，初始化暂未就绪时允许重试，不能静默降级丢失系统控制。
  if (plus.os.name === 'Android') return new NativeAudio();
  return uni.getBackgroundAudioManager() as MusicAudio;
  // #endif
  // #ifndef APP-PLUS
  return new WebAudio();
  // #endif
}
