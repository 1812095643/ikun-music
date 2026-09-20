import { shallowRef } from 'vue';

import { nativeDevice } from './nativeDevice';

export interface SpectrumFrame {
  ready: boolean;
  left: number[];
  right: number[];
  channels?: number;
}
export const spectrumFrame = shallowRef<SpectrumFrame>({ ready: false, left: [], right: [] });
export const spectrumUnavailable = shallowRef(false);
let enabled = false;
let media: HTMLAudioElement | undefined;
let context: AudioContext | undefined;
let split: ChannelSplitterNode | undefined;
let left: AnalyserNode | undefined;
let right: AnalyserNode | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
const samples = new Uint8Array(1024);

export function attachSpectrum(element: HTMLAudioElement) {
  media = element;
}
export function prepareSpectrum() {
  // #ifdef H5
  if (!enabled || !media || typeof AudioContext === 'undefined') return;
  if (!context) {
    context = new AudioContext();
    const source = context.createMediaElementSource(media);
    split = context.createChannelSplitter(2);
    left = context.createAnalyser();
    right = context.createAnalyser();
    for (const channel of [left, right]) {
      channel.fftSize = 2048;
      channel.smoothingTimeConstant = 0.7;
      channel.minDecibels = -80;
      channel.maxDecibels = -15;
    }
    source.connect(context.destination);
    source.connect(split);
    split.connect(left, 0);
    split.connect(right, 1);
  }
  void context.resume();
  // #endif
}
function channelBars(analyser: AnalyserNode): number[] {
  analyser.getByteFrequencyData(samples);
  const ceiling = Math.min(16000, analyser.context.sampleRate / 2);
  return Array.from({ length: 28 }, (_, index) => {
    const from = Math.max(
      1,
      Math.floor(
        (60 * Math.pow(ceiling / 60, index / 28) * analyser.fftSize) / analyser.context.sampleRate
      )
    );
    const to = Math.min(
      samples.length - 1,
      Math.max(
        from,
        Math.ceil(
          (60 * Math.pow(ceiling / 60, (index + 1) / 28) * analyser.fftSize) /
            analyser.context.sampleRate
        )
      )
    );
    let value = 0;
    for (let bin = from; bin <= to; bin++) value = Math.max(value, samples[bin]);
    return value / 255;
  });
}
export function setSpectrumEnabled(value: boolean) {
  enabled = value;
  clearInterval(timer);
  const kit = nativeDevice();
  // #ifdef APP-PLUS
  spectrumUnavailable.value = !kit;
  // #endif
  // #ifdef H5
  spectrumUnavailable.value = typeof AudioContext === 'undefined';
  // #endif
  if (kit) kit.setSpectrumEnabled(value);
  if (!value) {
    spectrumFrame.value = { ready: false, left: [], right: [] };
    return;
  }
  if (spectrumUnavailable.value) return;
  if (media && !media.paused) prepareSpectrum();
  timer = setInterval(() => {
    if (kit) {
      try {
        spectrumFrame.value = JSON.parse(kit.spectrum());
      } catch {
        // 单帧不可读时保留上一帧，避免频繁日志影响播放。
      }
    } else if (left && right && media && !media.paused && context?.state === 'running') {
      spectrumFrame.value = {
        ready: true,
        left: channelBars(left),
        right: channelBars(right),
        channels: 2
      };
    } else spectrumFrame.value = { ready: false, left: [], right: [] };
  }, 50);
}
export function destroySpectrum() {
  clearInterval(timer);
  split?.disconnect();
  void context?.close();
  context = undefined;
  left = undefined;
  right = undefined;
  media = undefined;
}
