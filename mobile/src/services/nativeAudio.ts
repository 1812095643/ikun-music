import type { MusicAudio } from './audioEngine';
import { nativeDevice } from './nativeDevice';

export class NativeAudio implements MusicAudio {
  private value = nativeDevice();
  private source = '';
  private timer: ReturnType<typeof setInterval>;
  private listeners = new Map<string, ((data?: unknown) => void)[]>();
  private lastState = 0;
  private error = '';
  title = '';
  singer = '';
  epname = '';
  coverImgUrl = '';
  startTime = 0;
  currentTime = 0;
  duration = 0;
  paused = true;
  constructor() {
    this.timer = setInterval(() => this.poll(), 120);
  }
  get src() {
    return this.source;
  }
  set src(value: string) {
    this.source = value;
    this.lastState = 0;
    this.error = '';
    this.currentTime = 0;
    this.duration = 0;
    this.send({
      type: 'load',
      src: value,
      title: this.title,
      artist: this.singer,
      album: this.epname
    });
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
  private poll() {
    try {
      const state = JSON.parse(this.value.audioState());
      if (state.src !== this.source || !this.source) return;
      this.currentTime = state.position || 0;
      this.duration = state.duration || 0;
      if (state.error && state.error !== this.error) {
        this.error = state.error;
        this.emit('error', state.error);
      }
      if (state.state !== this.lastState) {
        this.lastState = state.state;
        if (state.state === 2) this.emit('waiting');
        if (state.state === 3) this.emit('canplay');
        if (state.state === 4) this.emit('ended');
      }
      if (state.playing === this.paused) {
        this.paused = !state.playing;
        this.emit(state.playing ? 'play' : 'pause');
      }
      this.emit('timeupdate');
    } catch (error) {
      this.emit('error', error);
    }
  }
  play() {
    this.send({ type: 'play' });
  }
  pause() {
    this.send({ type: 'pause' });
  }
  stop() {
    this.send({ type: 'stop' });
    this.paused = true;
    this.emit('stop');
  }
  seek(position: number) {
    this.send({ type: 'seek', position });
  }
  destroy() {
    this.stop();
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
}
