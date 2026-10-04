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
  close(activeSeconds(analysis, -45), 3.5);
});

test("silence, low noise, DC offset and isolated clicks are not billed", async () => {
  for (const source of [buffer(2), buffer(2, [[0, 2, .001]]), buffer(2, [], { dc: .1 }), buffer(2, [[.5, .52]])]) {
    close(activeSeconds(await analyzeBuffer(source), -45), 0);
  }
});

test("quiet vocals can be restored by lowering the threshold", async () => {
  const analysis = await analyzeBuffer(buffer(2, [[.5, 1.5, .003]]));
  close(activeSeconds(analysis, -45), 0);
  close(activeSeconds(analysis, -60), 1);
});

test("stereo vocals count once, without phase cancellation", async () => {
  const analysis = await analyzeBuffer(buffer(3, [[1, 2]], { channels: 2 }));
  close(activeSeconds(analysis, -45), 1);
});

test("counts activity present only in the second channel", async () => {
  const source = buffer(3, [[1, 2]], { channels: 2 });
  source.getChannelData(0).fill(0);
  close(activeSeconds(await analyzeBuffer(source), -45), 1);
});

test("partial last frame does not overcount file duration", async () => {
  for (const sampleRate of [16000, 44100, 48000]) {
    const source = buffer(.075, [[0, 1]], { sampleRate });
    const analysis = await analyzeBuffer(source);
    close(activeSeconds(analysis, -45), source.length / sampleRate);
  }
});

test("multiple files add active time, retaining subsecond precision", async () => {
  const analyses = await Promise.all([buffer(4, [[1, 2.5]]), buffer(3, [[0, 1.24]])].map((source) => analyzeBuffer(source)));
  const total = analyses.reduce((sum, analysis) => sum + activeSeconds(analysis, -45), 0);
  assert.equal(formatInput(total), "0:02.74");
});

test("time formatting handles minute rollover and long files", () => {
  assert.equal(formatInput(0), "0:00.00");
  assert.equal(formatInput(59.999), "1:00.00");
  assert.equal(formatInput(3601.23), "60:01.23");
});
