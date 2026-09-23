import { EMPTY_SPECTRUM, type SpectrumFrame } from '../../shared/audioSpectrum';
import { audioService } from './audioService';

const listeners = new Set<(frame: SpectrumFrame) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function publish(frame: SpectrumFrame) {
  listeners.forEach((listener) => listener(frame));
}
function stop() {
  clearInterval(timer);
  timer = undefined;
  publish(EMPTY_SPECTRUM);
}
function tick() {
  if (!audioService.getCurrentSound()?.playing()) return stop();
  publish(audioService.getSpectrumFrame());
}
function start() {
  clearInterval(timer);
  timer = undefined;
  if (!listeners.size || !audioService.getCurrentSound()?.playing()) return;
  tick();
  timer = setInterval(tick, 50);
}

/** 所有播放控件共用一次 20 FPS 采样，暂停或无人订阅时停止计时。 */
export function subscribeAudioSpectrum(listener: (frame: SpectrumFrame) => void) {
  listeners.add(listener);
  listener(audioService.getSpectrumFrame());
  if (listeners.size === 1) {
    audioService.on('play', start);
    audioService.on('load', start);
    for (const event of ['pause', 'end', 'spectrum-reset']) audioService.on(event, stop);
    start();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    stop();
    audioService.off('play', start);
    audioService.off('load', start);
    for (const event of ['pause', 'end', 'spectrum-reset']) audioService.off(event, stop);
  };
}
