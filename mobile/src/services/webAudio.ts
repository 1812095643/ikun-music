import type { MusicAudio } from './audioEngine';
import { attachSpectrum, destroySpectrum,prepareSpectrum } from './spectrum';

export class WebAudio implements MusicAudio {
  private element = new Audio();
  title = '';
  singer = '';
  epname = '';
  coverImgUrl = '';
  startTime = 0;
  constructor() {
    this.element.crossOrigin = 'anonymous';
    this.element.preload = 'auto';
    this.element.style.display = 'none';
    document.body.appendChild(this.element);
    attachSpectrum(this.element);
  }
  get src() {
    return this.element.getAttribute('src') || '';
  }
  set src(value: string) {
    this.element.src = value;
  }
  get currentTime() {
    return this.element.currentTime;
  }
  get duration() {
    return Number.isFinite(this.element.duration) ? this.element.duration : 0;
  }
  get paused() {
    return this.element.paused;
  }
  play() {
    prepareSpectrum();
    void this.element.play().catch((error) => {
      if (error.name !== 'AbortError') this.element.dispatchEvent(new Event('error'));
    });
  }
  pause() {
    this.element.pause();
  }
  stop() {
    this.element.pause();
    if (this.element.readyState) this.element.currentTime = 0;
    this.element.dispatchEvent(new Event('stop'));
  }
  seek(position: number) {
    this.element.currentTime = position;
  }
  destroy() {
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.element.remove();
    destroySpectrum();
  }
  onPlay(cb: () => void) {
    this.element.addEventListener('playing', cb);
  }
  onPause(cb: () => void) {
    this.element.addEventListener('pause', cb);
  }
  onStop(cb: () => void) {
    this.element.addEventListener('stop', cb);
  }
  onEnded(cb: () => void) {
    this.element.addEventListener('ended', cb);
  }
  onError(cb: (error: unknown) => void) {
    this.element.addEventListener('error', cb);
  }
  onWaiting(cb: () => void) {
    this.element.addEventListener('waiting', cb);
  }
  onCanplay(cb: () => void) {
    this.element.addEventListener('canplay', cb);
  }
  onTimeUpdate(cb: () => void) {
    this.element.addEventListener('timeupdate', cb);
  }
}
