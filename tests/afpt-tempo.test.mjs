import test from 'node:test';
import assert from 'node:assert/strict';
import { afptSampleRate, correlationMagnitude, estimateBpm, selectAfptPeak } from '../src/lib/tempo.mjs';

const immediate = async () => {};
const buffer = (...channels) => ({
  sampleRate: afptSampleRate, length: channels[0].length,
  duration: channels[0].length / afptSampleRate, numberOfChannels: channels.length,
  getChannelData: channel => channels[channel],
});

// Deterministic broadband drum transients, matching the documented Rust test shape.
function clicks(bpm, seconds = 24, offsetSeconds = 0) {
  const samples = new Float32Array(Math.round(seconds * afptSampleRate));
  let seed = 123;
  for (let beat = 0; beat < Math.floor((seconds - offsetSeconds) * bpm / 60); beat++) {
    const offset = Math.round((offsetSeconds + 0.2 + beat * 60 / bpm) * afptSampleRate);
    for (let index = 0; index < 1680 && offset + index < samples.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[offset + index] = (seed / 0xffffffff * 2 - 1) * 0.3 * Math.exp(-9 * index / 1680);
    }
  }
  return samples;
}

for (const bpm of [61, 90, 120, 128, 150, 180, 239]) {
  test(`AFPT detects ${bpm} BPM as an exact integer, including original edge bins`, async () => {
    const found = await estimateBpm(buffer(clicks(bpm)), immediate);
    assert.equal(found.bpm, bpm);
    assert.equal(found.algorithm, 'AFPT');
  });
}

test('AFPT channel zero survives opposite-phase stereo and is not replaced by another channel', async () => {
  const left = clicks(128);
  const opposite = left.map(value => -value);
  assert.equal((await estimateBpm(buffer(left, opposite), immediate)).bpm, 128);
  const silence = new Float32Array(left.length);
  assert.equal((await estimateBpm(buffer(silence, left), immediate)).bpm, null);
  assert.equal((await estimateBpm(buffer(silence), immediate)).bpm, null);
  assert.equal((await estimateBpm(buffer(left.map(value => value * 1e-8), opposite), immediate)).bpm, 128);
});

test('AFPT analyzes the full track, including rhythm after the old 180 second cutoff', async () => {
  const samples = clicks(150, 210, 185);
  const progress = [];
  const found = await estimateBpm(buffer(samples), immediate, { onProgress: value => progress.push(value) });
  assert.equal(found.bpm, 150);
  assert.ok(found.analysisSeconds > 209.9);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]));
});

test('AFPT returns a single dominant integer BPM for a variable-tempo track', async () => {
  const slow = clicks(120, 8), fast = clicks(150, 24);
  const samples = new Float32Array(slow.length + fast.length);
  samples.set(slow); samples.set(fast, slow.length);
  assert.equal((await estimateBpm(buffer(samples), immediate)).bpm, 150);
});

test('AFPT discards only incomplete frames and returns unknown below two complete frames', async () => {
  const short = new Float32Array(2047); short[0] = 1;
  assert.equal((await estimateBpm(buffer(short), immediate)).bpm, null);
  const samples = clicks(90, 12);
  const completeLength = Math.floor(samples.length / 1024) * 1024;
  const complete = samples.slice(0, completeLength);
  const tail = new Float32Array(completeLength + 1023);
  tail.set(complete); tail[tail.length - 1] = 1;
  const full = await estimateBpm(buffer(complete), immediate);
  const padded = await estimateBpm(buffer(tail), immediate);
  assert.equal(padded.bpm, full.bpm);
  assert.equal(padded.analysisSeconds, completeLength / afptSampleRate);
  await assert.rejects(estimateBpm({ ...buffer(complete), sampleRate: 44100 }, immediate), /48 kHz/);
});

test('AFPT peak selection preserves strict ascent, right plateaus, lower ties and excluded boundaries', () => {
  const scores = new Float64Array(181);
  assert.equal(selectAfptPeak(scores), null);
  scores[0] = 100; scores[180] = 100;
  assert.equal(selectAfptPeak(scores), null);
  scores[1] = 2; scores[2] = 2; scores[90] = 2;
  assert.equal(selectAfptPeak(scores), 150); // Bin 61 is below its left boundary here.
  scores[0] = 0;
  assert.equal(selectAfptPeak(scores), 61);
  scores[90] = 3;
  assert.equal(selectAfptPeak(scores), 150);
});

test('AFPT trigonometric recurrence matches independent direct sums over long envelopes', () => {
  const values = Float64Array.from({ length: 40_000 }, (_, index) => Math.max(Math.sin(index * 0.17) + 0.2, 0));
  for (const bpm of [61, 90, 128, 150, 239]) {
    const theta = 2 * Math.PI * bpm / 60 / (afptSampleRate / 1024);
    let a = 0, b = 0;
    for (let index = 0; index < values.length; index++) {
      a += values[index] * Math.cos(theta * index);
      b += values[index] * Math.sin(theta * index);
    }
    assert.ok(Math.abs(correlationMagnitude(values, theta) - Math.sqrt(a * a + b * b)) < 1e-8);
  }
});

test('AFPT cancels during envelope generation and candidate scanning without publishing a result', async () => {
  for (const threshold of [0.1, 0.8]) {
    const controller = new AbortController();
    await assert.rejects(estimateBpm(buffer(clicks(120, 8)), immediate, {
      signal: controller.signal,
      onProgress: value => { if (value >= threshold) controller.abort(); },
    }), { name: 'AbortError' });
  }
  const controller = new AbortController(); controller.abort();
  assert.throws(() => correlationMagnitude(new Float64Array(10), 0.2, controller.signal), { name: 'AbortError' });
});
