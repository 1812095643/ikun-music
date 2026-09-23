import { StereoSpectrum } from '../src/shared/audioSpectrum';

export async function verifyAudioSpectrum() {
  const context = new AudioContext({ sampleRate: 48000 });
  const merger = context.createChannelMerger(2);
  const left = context.createOscillator();
  const right = context.createOscillator();
  left.frequency.value = 220;
  right.frequency.value = 3500;
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  const silent = context.createGain();
  silent.gain.value = 0;
  merger.connect(silent).connect(context.destination);
  const analyser = new StereoSpectrum(merger);
  try {
    await context.resume();
    left.start();
    right.start();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const frame = analyser.read();
    const leftPeak = frame.left.indexOf(Math.max(...frame.left));
    const rightPeak = frame.right.indexOf(Math.max(...frame.right));
    if (!frame.ready || frame.left.length !== 28 || rightPeak - leftPeak < 8) {
      throw new Error('Stereo frequency bands are not separated');
    }
    await context.suspend();
    if (analyser.read().ready) throw new Error('Suspended audio kept publishing a spectrum');
    return {
      leftPeak,
      rightPeak,
      pauseClears: true,
      outputDifference: await verifyTransparentOutput()
    };
  } finally {
    analyser.dispose();
    left.stop();
    right.stop();
    await context.close();
  }
}

async function verifyTransparentOutput() {
  async function render(withSpectrum: boolean) {
    const context = new OfflineAudioContext(2, 48000, 48000);
    const source = context.createOscillator();
    source.frequency.value = 500;
    source.connect(context.destination);
    const spectrum = withSpectrum ? new StereoSpectrum(source) : undefined;
    source.start();
    const output = await context.startRendering();
    spectrum?.dispose();
    return output.getChannelData(0);
  }
  const before = await render(false);
  const after = await render(true);
  const difference = after.reduce(
    (maximum, sample, index) => Math.max(maximum, Math.abs(sample - before[index])),
    0
  );
  if (difference > 1e-6) throw new Error('Spectrum altered the audio output');
  return difference;
}
