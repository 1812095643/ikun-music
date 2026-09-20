import type { MusicAudio } from './audioEngine';
import { nativeDevice } from './nativeDevice';

interface NativeAudioState {
  src?: string;
  position?: number;
  duration?: number;
  playing?: boolean;
  playWhenReady?: boolean;
  state?: number;
  error?: string;
  events?: { id: number; type: string }[];
}

export class NativeAudio implements MusicAudio {
  private value = nativeDevice();
  private registration = uni.requireNativePlugin('Ikun-DeviceKit');
  private source = '';
  private nativeSource = '';
  private timer: ReturnType<typeof setInterval>;
  private listeners = new Map<string, ((data?: unknown) => void)[]>();
  private lastState = 0;
  private error = '';
  private eventId = 0;
  private playbackIntent = false;
  private awaitingLoad = false;
  private previous = false;
  private next = false;
  trackId = '';
  title = '';
  singer = '';
  epname = '';
  coverImgUrl = '';
  startTime = 0;
  currentTime = 0;
  duration = 0;
  paused = true;
  constructor() {
    const state: NativeAudioState = JSON.parse(this.value.audioState());
    this.eventId = state.events?.[state.events.length - 1]?.id || 0;
    this.registration.observeAudio((snapshot: string) => this.accept(JSON.parse(snapshot)));
    this.timer = setInterval(() => this.synchronize(), 250);
  }
  get src() {
    return this.source;
  }
  set src(value: string) {
    this.source = value;
    // Media3 不认识 5+ 的私有目录别名；保留业务源地址，只给原生引擎传真实路径。
    this.nativeSource = /^_(doc|documents|downloads|www)\//.test(value)
      ? plus.io.convertLocalFileSystemURL(value)
      : value;
    this.load(this.startTime);
  }
  private load(position: number) {
    this.lastState = 0;
    this.error = '';
    this.awaitingLoad = true;
    this.currentTime = Math.max(0, position || 0);
    this.duration = 0;
    this.send({
      type: 'load',
      src: this.nativeSource,
      id: this.trackId,
      title: this.title,
      artist: this.singer,
      album: this.epname,
      artwork: this.coverImgUrl,
      position: this.currentTime
    });
    this.setNavigation(this.previous, this.next);
  }
  private send(value: Record<string, unknown>) {
    this.value.audioCommand(JSON.stringify(value));
  }
  private emit(event: string, data?: unknown) {
    this.listeners.get(event)?.forEach((listener) => listener(data));
  }
  private on(event: string, callback: (data?: unknown) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), callback]);
  }
  synchronize() {
    try {
      this.accept(JSON.parse(this.value.audioState()));
    } catch (error) {
      this.emit('error', error);
    }
  }
  private accept(state: NativeAudioState) {
    for (const event of state.events || []) {
      if (event.id <= this.eventId) continue;
      this.eventId = event.id;
      this.emit(event.type);
    }
    if (!this.source) return;
    if (state.src !== this.nativeSource) {
      if (state.error && state.error !== this.error) {
        this.error = state.error;
        this.awaitingLoad = false;
        this.emit('error', state.error);
      }
      // 服务被系统回收后保留进度，清除过期的播放状态；再次播放时重建当前音源。
      if (!state.src && !this.awaitingLoad) {
        this.lastState = 0;
        if (!this.paused) {
          this.paused = true;
          this.emit('pause');
        }
      }
      return;
    }
    this.awaitingLoad = false;
    this.currentTime = state.position || 0;
    this.duration = state.duration || 0;
    if (state.playWhenReady !== this.playbackIntent) {
      this.playbackIntent = Boolean(state.playWhenReady);
      this.emit('intent', this.playbackIntent);
    }
    if (state.error && state.error !== this.error) {
      this.error = state.error;
      this.emit('error', state.error);
    }
    if (state.state !== this.lastState) {
      this.lastState = state.state || 0;
      if (state.state === 2) this.emit('waiting');
      if (state.state === 3) this.emit('canplay');
      if (state.state === 4) this.emit('ended');
    }
    if (state.playing === this.paused) {
      this.paused = !state.playing;
      this.emit(state.playing ? 'play' : 'pause');
    }
    this.emit('timeupdate');
  }
  play() {
    if (!this.source) return;
    const state: NativeAudioState = JSON.parse(this.value.audioState());
    if (!this.awaitingLoad && state.src !== this.nativeSource) this.load(this.currentTime);
    this.send({ type: 'play' });
  }
  pause() {
    this.send({ type: 'pause' });
  }
  stop() {
    this.send({ type: 'stop' });
    this.source = '';
    this.nativeSource = '';
    this.awaitingLoad = false;
    this.paused = true;
    this.emit('stop');
  }
  seek(position: number) {
    this.send({ type: 'seek', position });
  }
  destroy() {
    this.stop();
    this.registration.unobserveAudio();
    clearInterval(this.timer);
    this.listeners.clear();
  }
  onPlay(cb: () => void) {
    this.on('play', cb);
  }
  onPause(cb: () => void) {
    this.on('pause', cb);
  }
  onStop(cb: () => void) {
    this.on('stop', cb);
  }
  onEnded(cb: () => void) {
    this.on('ended', cb);
  }
  onError(cb: (error: unknown) => void) {
    this.on('error', cb);
  }
  onWaiting(cb: () => void) {
    this.on('waiting', cb);
  }
  onCanplay(cb: () => void) {
    this.on('canplay', cb);
  }
  onTimeUpdate(cb: () => void) {
    this.on('timeupdate', cb);
  }
  onNext(cb: () => void) {
    this.on('next', cb);
  }
  onPrev(cb: () => void) {
    this.on('previous', cb);
  }
  onPlaybackIntent(cb: (playing: boolean) => void) {
    this.on('intent', (value) => cb(Boolean(value)));
  }
  setNavigation(previous: boolean, next: boolean) {
    this.previous = previous;
    this.next = next;
    if (this.source) this.send({ type: 'navigation', previous, next });
  }
}
