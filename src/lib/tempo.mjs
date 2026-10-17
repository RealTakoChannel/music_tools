// AFPT six-band algorithm, ported from AFPT-BPM-Algorithm.md / KaleidoTools bpm.rs.
// Keep the original frame/window/peak rules; do not add tempo or octave preferences.
export const afptSampleRate = 48_000;
const frameSize = 1024;
const minimumBpm = 60;
const candidateCount = 181;
const tau = 2 * Math.PI;

class Section {
  constructor(cutoff, index, highpass) {
    const fs = afptSampleRate;
    const damping = -Math.cos((Math.PI * (2 * index + 3)) / 8);
    const frequency = 2 * fs * Math.tan((Math.PI * cutoff) / fs);
    const denominator = 4 * fs * fs + 4 * fs * damping * frequency + frequency * frequency;
    // The highpass uses the same prewarped frequency (1 / inverse in Rust).
    this.a = highpass
      ? [4 * fs * fs, -8 * fs * fs, 4 * fs * fs]
      : [frequency * frequency, 2 * frequency * frequency, frequency * frequency];
    this.b = [
      (2 * frequency * frequency - 8 * fs * fs) / -denominator,
      (4 * fs * fs - 4 * fs * damping * frequency + frequency * frequency) / -denominator,
    ];
    this.gain = 1 / denominator;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  sample(input) {
    const x = input * this.gain;
    const y =
      this.a[2] * this.x2 +
      this.a[1] * this.x1 +
      this.a[0] * x +
      this.b[0] * this.y1 +
      this.b[1] * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function filterBank() {
  const low = (cutoff) => [1, 2].map((index) => new Section(cutoff, index, false));
  const high = (cutoff) => [1, 2].map((index) => new Section(cutoff, index, true));
  const band = (bottom, top) => [...low(top), ...high(bottom)];
  return [low(200), band(200, 400), band(400, 800), band(800, 1600), band(1600, 3200), high(3200)];
}

// Exported math primitives allow independent numerical/reference tests.
export function correlationMagnitude(values, theta, signal) {
  const stepSin = Math.sin(theta),
    stepCos = Math.cos(theta);
  let sin = 0,
    cos = 1,
    a = 0,
    b = 0;
  for (let index = 0; index < values.length; index++) {
    if (index % 4096 === 0) {
      signal?.throwIfAborted();
      sin = Math.sin(theta * index);
      cos = Math.cos(theta * index);
    }
    a += values[index] * cos;
    b += values[index] * sin;
    const nextSin = sin * stepCos + cos * stepSin;
    cos = cos * stepCos - sin * stepSin;
    sin = nextSin;
  }
  return Math.sqrt(a * a + b * b);
}

export function selectAfptPeak(scores) {
  let best = null;
  // 60 and 240 are scored, but excluded from selection. Ties retain the lower BPM.
  for (let index = 1; index < scores.length - 1; index++) {
    if (
      scores[index] - scores[index - 1] > 0 &&
      scores[index + 1] - scores[index] <= 0 &&
      (best === null || scores[index] > scores[best])
    )
      best = index;
  }
  return best === null ? null : best + minimumBpm;
}

export async function estimateBpm(
  audioBuffer,
  yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0)),
  { signal, onProgress = () => {} } = {},
) {
  signal?.throwIfAborted();
  if (audioBuffer.sampleRate !== afptSampleRate) throw new Error('BPM 分析需要 48 kHz 解码音频');
  const count = Math.floor(audioBuffer.length / frameSize);
  const result = (bpm) => ({
    bpm,
    analysisSeconds: (count * frameSize) / afptSampleRate,
    algorithm: 'AFPT',
  });
  if (count < 2 || !audioBuffer.numberOfChannels) {
    onProgress(1);
    return result(null);
  }

  // Use the common peak of ALL channels, including the incomplete tail, but only
  // channel zero enters the filters. Never downmix opposite-phase stereo.
  let peak = 0;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const samples = audioBuffer.getChannelData(channel);
    for (let offset = 0; offset < samples.length; offset += frameSize * 16) {
      signal?.throwIfAborted();
      const end = Math.min(offset + frameSize * 16, samples.length);
      for (let index = offset; index < end; index++)
        peak = Math.max(peak, Math.abs(samples[index]));
      await yieldToUI();
    }
  }
  signal?.throwIfAborted();
  onProgress(0.05);
  if (peak === 0) {
    onProgress(1);
    return result(null);
  }
  const gain = 10 ** (-6 / 10) / peak;
  const samples = audioBuffer.getChannelData(0);
  const bank = filterBank();
  const onsets = bank.map(() => new Float64Array(count));
  const previous = new Float64Array(6);
  for (let frame = 0; frame < count; frame++) {
    const sums = new Float64Array(6);
    const end = (frame + 1) * frameSize;
    for (let index = frame * frameSize; index < end; index++) {
      const input = samples[index] * gain;
      for (let band = 0; band < bank.length; band++) {
        let value = input;
        for (const section of bank[band]) value = section.sample(value);
        sums[band] += Math.abs(value);
      }
    }
    for (let band = 0; band < bank.length; band++) {
      const envelope = sums[band] / frameSize;
      onsets[band][frame] = Math.max(envelope - previous[band], 0);
      previous[band] = envelope;
    }
    if ((frame + 1) % 16 === 0 || frame === count - 1) {
      onProgress(0.05 + (0.65 * (frame + 1)) / count);
      await yieldToUI();
      signal?.throwIfAborted();
    }
  }
  // Hann denominator is M (not M - 1), shared by all six bands.
  for (let frame = 0; frame < count; frame++) {
    const weight = 0.5 - 0.5 * Math.cos((tau * frame) / count);
    for (const onset of onsets) onset[frame] *= weight;
  }
  const scores = new Float64Array(candidateCount);
  for (let candidate = 0; candidate < candidateCount; candidate++) {
    signal?.throwIfAborted();
    const theta = (tau * (candidate + minimumBpm)) / 60 / (afptSampleRate / frameSize);
    for (const onset of onsets)
      scores[candidate] += correlationMagnitude(onset, theta, signal) / count;
    onProgress(0.7 + (0.3 * (candidate + 1)) / candidateCount);
    if (candidate % 4 === 3) await yieldToUI();
  }
  signal?.throwIfAborted();
  return result(selectAfptPeak(scores));
}
