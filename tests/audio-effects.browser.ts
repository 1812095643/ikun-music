import {
  AUDIO_EFFECT_PRESET_OPTIONS,
  type AudioEffectPreset,
  type AudioEffectSettings,
  AudioEffectsRack} from '../src/renderer/services/audioEffects';

const render = async (
  preset: AudioEffectPreset,
  settings: AudioEffectSettings,
  compare = false
) => {
  const context = new OfflineAudioContext(2, 48000 * 4, 48000);
  const buffer = context.createBuffer(2, 48000, 48000);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) {
      samples[i] =
        0.35 * Math.sin((2 * Math.PI * 180 * i) / 48000) +
        0.2 * Math.sin((2 * Math.PI * 2200 * i) / 48000);
    }
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const rack = new AudioEffectsRack(context);
  rack.configure(preset, settings, compare);
  source.connect(rack.input);
  rack.output.connect(context.destination);
  source.start();
  const output = await context.startRendering();
  rack.dispose();
  return [output.getChannelData(0), output.getChannelData(1)];
};

export const verifyAudioEffects = async () => {
  const original = await render('off', { mix: 0, space: 50 });
  const results = [];
  for (const preset of AUDIO_EFFECT_PRESET_OPTIONS) {
    const [left, right] = await render(preset.value, { mix: preset.mix, space: preset.space });
    let difference = 0,
      tail = 0,
      peak = 0,
      stereo = 0;
    for (let i = 7200; i < left.length; i++) {
      difference += Math.abs(left[i] - original[0][i]);
      if (i > 57600) tail += left[i] ** 2;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      stereo += Math.abs(left[i] - right[i]);
    }
    if (!(difference > 1 && peak > 0 && peak < 1))
      throw new Error(`Invalid output: ${preset.value}`);
    if (['ktv', 'concert', 'hall'].includes(preset.value) && tail <= 0.01)
      throw new Error(`Missing reverb: ${preset.value}`);
    if (preset.value === 'spatial3d' && stereo < 1000) throw new Error('Missing stereo movement');
    results.push({ preset: preset.value, difference, tail, peak, stereo });
  }
  for (const [mix, compare] of [
    [0, false],
    [80, true]
  ] as const) {
    const [output] = await render('ktv', { mix, space: 80 }, compare);
    const error = output
      .slice(7200)
      .reduce((max, sample, i) => Math.max(max, Math.abs(sample - original[0][i + 7200])), 0);
    if (error > 1e-6) throw new Error('Original comparison changed the signal');
  }
  return results;
};
