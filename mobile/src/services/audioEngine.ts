import { NativeAudio } from './nativeAudio';
import { nativeDevice } from './nativeDevice';
// #ifdef H5
import { WebAudio } from './webAudio';
// #endif
export interface MusicAudio {
  destroy?(): void;
  src: string;
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
}

export function createMusicAudio(): MusicAudio {
  // #ifdef APP-PLUS
  if (nativeDevice()) return new NativeAudio();
  return uni.getBackgroundAudioManager() as MusicAudio;
  // #endif
  // #ifndef APP-PLUS
  return new WebAudio();
  // #endif
}
