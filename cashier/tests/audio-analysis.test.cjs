const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeBuffer, activeSeconds, formatInput } = require("../audio-analysis.js");

function buffer(duration, regions = [], { sampleRate = 16000, channels = 1, dc = 0 } = {}) {
  const data = Array.from({ length: channels }, (_, channel) => {
    const samples = new Float32Array(Math.round(duration * sampleRate));
    for (let i = 0; i < samples.length; i++) {
      const time = i / sampleRate;
      const region = regions.find(([start, end]) => time >= start && time < end);
      const amplitude = region ? (region[2] ?? .1) : 0;
      samples[i] = dc + amplitude * Math.sin(2 * Math.PI * 400 * time) * (channel % 2 ? -1 : 1);
    }
    return samples;
  });
  return { sampleRate, length: data[0].length, numberOfChannels: channels, getChannelData: (channel) => data[channel] };
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} != ${expected}`);

test("excludes leading, trailing and interior silence", async () => {
  const analysis = await analyzeBuffer(buffer(10, [[1, 3], [5, 6.5]]));
  close(activeSeconds(analysis, -60), 3.5);
});

test("silence, DC offset and isolated clicks are not billed after normalization", async () => {
  for (const source of [buffer(2), buffer(2, [], { dc: .1 }), buffer(2, [[.5, .52]])]) {
    close(activeSeconds(await analyzeBuffer(source), -60), 0);
  }
});

test("quiet passages relative to the file peak can be restored by lowering the threshold", async () => {
  const analysis = await analyzeBuffer(buffer(3, [[0, 1, .1], [1, 2, .0002]]));
  close(activeSeconds(analysis, -60), 1);
  close(activeSeconds(analysis, -70), 2);
});

test("stereo vocals count once, without phase cancellation", async () => {
  const analysis = await analyzeBuffer(buffer(3, [[1, 2]], { channels: 2 }));
  close(activeSeconds(analysis, -60), 1);
});

test("counts activity present only in the second channel", async () => {
  const source = buffer(3, [[1, 2]], { channels: 2 });
  source.getChannelData(0).fill(0);
  close(activeSeconds(await analyzeBuffer(source), -60), 1);
});

test("partial last frame does not overcount file duration", async () => {
  for (const sampleRate of [16000, 44100, 48000]) {
    const source = buffer(.075, [[0, 1]], { sampleRate });
    const analysis = await analyzeBuffer(source);
    close(activeSeconds(analysis, -60), source.length / sampleRate);
  }
});

test("multiple files add active time, retaining subsecond precision", async () => {
  const analyses = await Promise.all([buffer(4, [[1, 2.5]]), buffer(3, [[0, 1.24]])].map((source) => analyzeBuffer(source)));
  const total = analyses.reduce((sum, analysis) => sum + activeSeconds(analysis, -60), 0);
  assert.equal(formatInput(total), "0:02.74");
});

test("time formatting handles minute rollover and long files", () => {
  assert.equal(formatInput(0), "0:00.00");
  assert.equal(formatInput(59.999), "1:00.00");
  assert.equal(formatInput(3601.23), "60:01.23");
});

function peak(samples) {
  let value = 0;
  for (const sample of samples) value = Math.max(value, Math.abs(sample));
  return value;
}

test("quiet and loud files are normalized to -6 dBFS before measuring frame energy", async () => {
  for (const amplitude of [.00003, .9]) {
    const source = buffer(2, [[.5, 1.5, amplitude]]);
    const result = await analyzeBuffer(source);
    close(20 * Math.log10(peak(source.getChannelData(0))), -6);
    close(result.levels[30], -6 - 10 * Math.log10(2));
    close(activeSeconds(result, -60), 1);
    close(result.normalization.gainDb, -6 - 20 * Math.log10(amplitude));
    assert.equal(result.normalization.normalizedPeakDb, -6);
  }
});

test("the loudest channel determines a shared normalization gain", async () => {
  const source = buffer(2, [[.5, 1.5, .8]], { channels: 2 });
  const quieter = source.getChannelData(0);
  for (let i = 0; i < quieter.length; i++) quieter[i] *= .125;
  const result = await analyzeBuffer(source);
  close(20 * Math.log10(peak(source.getChannelData(1))), -6);
  close(peak(quieter) / peak(source.getChannelData(1)), .125);
  close(activeSeconds(result, -60), 1);
});

test("normalization leaves pure silence finite and unbilled", async () => {
  const source = buffer(2, [], { channels: 2 });
  const result = await analyzeBuffer(source);
  assert.deepEqual(result.normalization, { originalPeakDb: null, normalizedPeakDb: null, gainDb: 0 });
  assert.ok(source.getChannelData(0).every((sample) => sample === 0));
  assert.ok(source.getChannelData(1).every((sample) => sample === 0));
  close(activeSeconds(result, -60), 0);
});

test("normalization preserves low noise relative to the file peak", async () => {
  const result = await analyzeBuffer(buffer(3, [[0, 1, .1], [1, 3, .00002]]));
  close(activeSeconds(result, -60), 1);
});
