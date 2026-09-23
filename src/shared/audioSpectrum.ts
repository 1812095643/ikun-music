export const SPECTRUM_BANDS = 28;
export interface SpectrumFrame {
  ready: boolean;
  left: number[];
  right: number[];
}
export const EMPTY_SPECTRUM: SpectrumFrame = { ready: false, left: [], right: [] };

/** 与平板端一致：按对数频段展示 60 Hz 至 16 kHz，低音与高音拥有各自的条带。 */
export function readSpectrumBands(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>) {
  analyser.getByteFrequencyData(samples);
  const ceiling = Math.min(16000, analyser.context.sampleRate / 2);
  return Array.from({ length: SPECTRUM_BANDS }, (_, index) => {
    const from = Math.max(
      1,
      Math.floor(
        (60 * Math.pow(ceiling / 60, index / SPECTRUM_BANDS) * analyser.fftSize) /
          analyser.context.sampleRate
      )
    );
    const to = Math.min(
      samples.length - 1,
      Math.max(
        from,
        Math.ceil(
          (60 * Math.pow(ceiling / 60, (index + 1) / SPECTRUM_BANDS) * analyser.fftSize) /
            analyser.context.sampleRate
        )
      )
    );
    let peak = 0;
    for (let bin = from; bin <= to; bin++) peak = Math.max(peak, samples[bin]);
    return peak / 255;
  });
}

export class StereoSpectrum {
  private readonly splitter: ChannelSplitterNode;
  private readonly analysers: AnalyserNode[];
  private readonly samples = new Uint8Array(1024);

  constructor(private readonly input: AudioNode) {
    const context = input.context;
    this.splitter = context.createChannelSplitter(2);
    this.analysers = [context.createAnalyser(), context.createAnalyser()];
    this.analysers.forEach((analyser, channel) => {
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.7;
      analyser.minDecibels = -80;
      analyser.maxDecibels = -15;
      this.splitter.connect(analyser, channel);
    });
    // 分析节点只旁接输出，不串入发声链路，也不重复连接扬声器。
    input.connect(this.splitter);
  }

  read(): SpectrumFrame {
    if (this.input.context.state !== 'running') return EMPTY_SPECTRUM;
    return {
      ready: true,
      left: readSpectrumBands(this.analysers[0], this.samples),
      right: readSpectrumBands(this.analysers[1], this.samples)
    };
  }

  dispose() {
    try {
      this.input.disconnect(this.splitter);
    } catch {
      /* 主音频图可能已先断开。 */
    }
    this.splitter.disconnect();
    this.analysers.forEach((analyser) => analyser.disconnect());
  }
}
