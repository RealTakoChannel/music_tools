import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPriceMode, calculatePrice, normalizeBpm, parseTime } from '../src/lib/pricing.mjs';
import { compareByFilename, outputFilename } from '../src/lib/audio.mjs';
import { estimateBpm } from '../src/lib/tempo.mjs';
import { readToolRoute, toolHref } from '../src/lib/routes.mjs';

test('SPA routes support deep links, safe fallback and offline desktop startup', () => {
  for (const tool of ['home', 'audiojoin', 'bpmcalc', 'cashier']) {
    assert.equal(readToolRoute({ hash: toolHref(tool) }), tool);
    assert.equal(readToolRoute({ hash: `#/${tool}/` }), tool);
  }
  assert.equal(readToolRoute({ hash: '#/unknown' }), 'home');
  assert.equal(readToolRoute({ hash: '', search: '?desktop=1' }), 'audiojoin');
  assert.equal(readToolRoute({ hash: '#/home', search: '?desktop=1' }), 'home');
  assert.equal(toolHref('unknown'), '#/home');
});

test('legacy min.sec and precise min:sec parsing and invalid seconds', () => {
  for (const input of ['1.30', '1.3', '1:30', '1:30.00']) assert.equal(parseTime(input).value, 1.5);
  assert.equal(parseTime('1:30.25').value, 1 + 30.25 / 60);
  assert.equal(parseTime('1:60').error, 'secondsRange');
  assert.equal(parseTime('bad').error, 'timeFormat');
  assert.equal(parseTime('').value, 0);
  assert.equal(parseTime('9'.repeat(400)).error, 'timeRange');
});
test('automatic lead price boundaries and manual overrides', () => {
  for (const [time, mode] of [['0:39','twenty'],['0:40','time'],['2:19','time'],['2:20','full'],['5:00','full'],['0:00','time'],['bad','time']]) assert.equal(autoPriceMode(time), mode, time);
  assert.equal(calculatePrice('5:00', '1:00', 'time', false).total, 170);
  assert.equal(calculatePrice('5:00', '1:00', 'twenty', false).total, 40);
  assert.equal(calculatePrice('1:01', '0:19', 'time', true).total, 35);
  assert.equal(calculatePrice('bad', '', 'time', true).error, 'timeFormat');
  assert.equal(calculatePrice('bad', '', 'full', true).total, 70);
});
test('octave mapping handles boundaries and very small positive values', () => {
  for (const input of [50, 100, 200, 400]) assert.ok(Math.abs(normalizeBpm(input, 100) - 100) < 1e-9);
  assert.ok(Math.abs(normalizeBpm(150, 100) - 150) < 1e-9);
  assert.equal(normalizeBpm(0, 100), null);
  assert.equal(normalizeBpm(120, 0), null);
  assert.equal(normalizeBpm(Infinity, 100), null);
  const small = normalizeBpm(Number.MIN_VALUE, 100);
  assert.ok(small >= 100 && small < 200);
});
test('natural sorting and safe output filenames', () => {
  const rows = ['clip 10.wav', 'clip 2.wav', 'clip 1.wav'].map(name => ({ file: { name } }));
  assert.deepEqual(rows.sort(compareByFilename).map(row => row.file.name), ['clip 1.wav','clip 2.wav','clip 10.wav']);
  assert.equal(outputFilename('CON.wav'), '_CON.wav');
  assert.equal(outputFilename('quote/a:b.WAV'), 'quote_a_b.wav');
});
test('BPM estimation detects synthetic pulses and rejects silence/short clips', async () => {
  const sampleRate = 16000, seconds = 15;
  const samples = new Float32Array(sampleRate * seconds);
  for (let frame = 0; frame < samples.length; frame++) {
    const phase = frame % (sampleRate / 2);
    if (phase < 640) samples[frame] = Math.sin(frame * 2 * Math.PI * 500 / sampleRate) * Math.exp(-phase / 180);
  }
  const buffer = { sampleRate, duration: seconds, length: samples.length, numberOfChannels: 1, getChannelData: () => samples };
  const result = await estimateBpm(buffer);
  assert.ok(Math.abs(result.bpm - 120) < 2, `Estimated ${result.bpm}`);
  await assert.rejects(estimateBpm({ ...buffer, duration: 3 }), /至少 5 秒/);
  samples.fill(0);
  await assert.rejects(estimateBpm(buffer), /音量过低/);
});
