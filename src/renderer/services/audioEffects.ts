export type AudioEffectPreset =
  | 'off'
  | 'studio'
  | 'ktv'
  | 'spatial3d'
  | 'concert'
  | 'hall'
  | 'vocal'
  | 'night'
  | 'bass';
export type AudioEffectSettings = { mix: number; space: number };

export const AUDIO_EFFECT_PRESET_OPTIONS = [
  {
    value: 'studio',
    label: '录音棚',
    description: '干净人声 · 贴近录音现场',
    icon: 'ri-record-circle-line',
    tag: '日常听歌',
    mix: 42,
    space: 26,
    reverb: 0.45,
    delay: 0,
    feedback: 0,
    bass: 0,
    presence: 1.2,
    compression: 2
  },
  {
    value: 'ktv',
    label: 'KTV',
    description: '清晰回声 · 包厢氛围',
    icon: 'ri-mic-line',
    tag: '人声氛围',
    mix: 58,
    space: 48,
    reverb: 1.15,
    delay: 0.145,
    feedback: 0.24,
    bass: 0.5,
    presence: 1.4,
    compression: 1.5
  },
  {
    value: 'spatial3d',
    label: '3D 环绕',
    description: '立体声游移 · 声音在身边',
    icon: 'ri-surround-sound-line',
    tag: '耳机推荐',
    mix: 68,
    space: 68,
    reverb: 0.75,
    delay: 0.025,
    feedback: 0.08,
    bass: 0,
    presence: 0,
    compression: 1
  },
  {
    value: 'concert',
    label: '演唱会',
    description: '开阔舞台 · 鲜明现场感',
    icon: 'ri-live-line',
    tag: '现场演出',
    mix: 62,
    space: 72,
    reverb: 2.2,
    delay: 0.205,
    feedback: 0.24,
    bass: 1.8,
    presence: 1,
    compression: 1.8
  },
  {
    value: 'hall',
    label: '音乐厅',
    description: '悠长尾韵 · 丰富空间层次',
    icon: 'ri-building-4-line',
    tag: '古典器乐',
    mix: 54,
    space: 82,
    reverb: 2.8,
    delay: 0.04,
    feedback: 0.08,
    bass: 0,
    presence: 0,
    compression: 1
  },
  {
    value: 'vocal',
    label: '清澈人声',
    description: '主唱靠前 · 细节更清楚',
    icon: 'ri-user-voice-line',
    tag: '抒情流行',
    mix: 65,
    space: 18,
    reverb: 0.3,
    delay: 0,
    feedback: 0,
    bass: -1.5,
    presence: 3.2,
    compression: 2
  },
  {
    value: 'night',
    label: '深夜聆听',
    description: '收敛动态 · 柔和不突兀',
    icon: 'ri-moon-clear-line',
    tag: '安静时刻',
    mix: 70,
    space: 20,
    reverb: 0.35,
    delay: 0,
    feedback: 0,
    bass: 1,
    presence: -1,
    compression: 5
  },
  {
    value: 'bass',
    label: '低音律动',
    description: '鼓点厚实 · 低频更有力',
    icon: 'ri-pulse-line',
    tag: '节奏电子',
    mix: 60,
    space: 30,
    reverb: 0.25,
    delay: 0,
    feedback: 0,
    bass: 5,
    presence: 0.5,
    compression: 2.8
  }
] as const;

export const getEffectPreset = (preset: AudioEffectPreset) =>
  AUDIO_EFFECT_PRESET_OPTIONS.find((p) => p.value === preset);

/** 基于标准 Web Audio 节点；所有预设共用同一条干湿混合总线，原声对比不重载歌曲。 */
export class AudioEffectsRack {
  readonly input: GainNode;
  readonly output: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private sum: GainNode;
  private compressor: DynamicsCompressorNode;
  private nodes: AudioNode[] = [];
  private oscillator?: OscillatorNode;
  private preset: AudioEffectPreset = 'off';
  private settings: AudioEffectSettings = { mix: 42, space: 26 };
  private comparing = false;

  constructor(private context: BaseAudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.wet.gain.value = 0;
    this.sum = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.compressor.attack.value = 0.012;
    this.compressor.release.value = 0.22;
    this.input.connect(this.dry).connect(this.sum);
    this.wet.connect(this.sum);
    this.sum.connect(this.compressor).connect(this.output);
    this.setMix();
  }

  configure(preset: AudioEffectPreset, settings: AudioEffectSettings, comparing = false) {
    const rebuild = preset !== this.preset || settings.space !== this.settings.space;
    this.preset = preset;
    this.settings = { ...settings };
    this.comparing = comparing;
    if (rebuild) this.build();
    this.setMix();
  }

  private setMix() {
    const mix = this.preset === 'off' || this.comparing ? 0 : this.settings.mix / 100;
    const preset = getEffectPreset(this.preset);
    // 动态处理在干湿混合后执行，避免压缩器的前瞻延迟与原声叠加产生梳状失真。
    this.compressor.ratio.setTargetAtTime(
      1 + ((preset?.compression ?? 1) - 1) * mix,
      this.context.currentTime,
      0.018
    );
    this.compressor.threshold.setTargetAtTime(
      mix > 0 ? (this.preset === 'night' ? -26 : -16) : 0,
      this.context.currentTime,
      0.018
    );
    this.compressor.knee.value = mix > 0 ? 12 : 0;
    this.dry.gain.setTargetAtTime(1 - mix, this.context.currentTime, 0.018);
    this.wet.gain.setTargetAtTime(mix, this.context.currentTime, 0.018);
  }

  private clear() {
    this.oscillator?.stop();
    this.oscillator = undefined;
    this.input.disconnect();
    this.input.connect(this.dry);
    this.nodes.forEach((node) => node.disconnect());
    this.nodes = [];
  }

  private build() {
    this.clear();
    const preset = getEffectPreset(this.preset);
    if (!preset) return;
    const c = this.context;
    const space = this.settings.space / 100;
    const bass = c.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 150;
    bass.gain.value = preset.bass;
    const presence = c.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2200;
    presence.Q.value = 0.8;
    presence.gain.value = preset.presence;
    this.input.connect(bass).connect(presence);
    this.nodes.push(bass, presence);
    let tail: AudioNode = presence;
    if (preset.value === 'spatial3d') {
      const panner = c.createStereoPanner();
      const oscillator = c.createOscillator();
      const depth = c.createGain();
      oscillator.frequency.value = 0.12 + space * 0.12;
      depth.gain.value = 0.15 + space * 0.7;
      oscillator.connect(depth).connect(panner.pan);
      oscillator.start();
      this.oscillator = oscillator;
      tail.connect(panner);
      tail = panner;
      this.nodes.push(panner, oscillator, depth);
    }
    const direct = c.createGain();
    direct.gain.value = 0.86;
    tail.connect(direct).connect(this.wet);
    this.nodes.push(direct);
    const convolver = c.createConvolver();
    const duration = preset.reverb * (0.55 + space);
    const length = Math.ceil(c.sampleRate * duration);
    const impulse = c.createBuffer(2, length, c.sampleRate);
    // 指数衰减立体声脉冲生成一次，调干湿比例时不重新分配音频缓冲。
    for (let channel = 0; channel < 2; channel++) {
      let seed = 17 + channel * 97;
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        seed = (seed * 16807) % 2147483647;
        samples[i] = (seed / 1073741823.5 - 1) * Math.exp((-6.9 * i) / length);
      }
    }
    convolver.buffer = impulse;
    const reverbGain = c.createGain();
    reverbGain.gain.value = 0.18 + space * 0.32;
    const damping = c.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.value = 6000;
    tail.connect(convolver).connect(damping).connect(reverbGain).connect(this.wet);
    this.nodes.push(convolver, reverbGain, damping);
    if (preset.delay) {
      const delay = c.createDelay(1);
      delay.delayTime.value = preset.delay * (0.85 + space * 0.3);
      const feedback = c.createGain();
      feedback.gain.value = preset.feedback;
      const echo = c.createGain();
      echo.gain.value = preset.value === 'ktv' ? 0.26 : 0.15;
      tail.connect(delay).connect(feedback).connect(delay);
      delay.connect(echo).connect(this.wet);
      this.nodes.push(delay, feedback, echo);
    }
  }

  dispose() {
    this.clear();
    this.input.disconnect();
    this.dry.disconnect();
    this.wet.disconnect();
    this.sum.disconnect();
    this.compressor.disconnect();
    this.output.disconnect();
  }
}
