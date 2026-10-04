'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWav, differences, makeHeader, mergeWavs } = require('../wav-engine.js');

function chunk(id, bytes) {
  const header = Buffer.alloc(8); header.write(id); header.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([header, bytes, ...(bytes.length % 2 ? [Buffer.alloc(1)] : [])]);
}
function wav({ rate = 48000, bits = 24, channels = 2, encoding = 1,
  validBits = bits, extensible = false, mask = channels === 1 ? 4 : 3,
  frames = 100, seed = 1, junk = false, split = false, name = 'test.wav', raw = null } = {}) {
  const align = bits / 8 * channels;
  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : encoding); fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4); fmt.writeUInt32LE(rate * align, 8);
  fmt.writeUInt16LE(align, 12); fmt.writeUInt16LE(bits, 14);
  if (extensible) {
    fmt.writeUInt16LE(22, 16); fmt.writeUInt16LE(validBits, 18); fmt.writeUInt32LE(mask, 20);
    fmt.writeUInt32LE(encoding, 24); Buffer.from('00001000800000aa00389b71', 'hex').copy(fmt, 28);
  }
  const data = raw || Buffer.from(Array.from({ length: frames * align }, (_, i) => (i * 17 + seed) % 256));
  const parts = [Buffer.from('WAVE'), chunk('fmt ', fmt)];
  if (junk) parts.push(chunk('JUNK', Buffer.from('odd')));
  if (split) {
    const half = Math.floor(frames / 2) * align;
    parts.push(chunk('data', data.subarray(0, half)), chunk('LIST', Buffer.from('INFO')), chunk('data', data.subarray(half)));
  } else parts.push(chunk('data', data));
  const payload = Buffer.concat(parts), header = Buffer.alloc(8);
  header.write('RIFF'); header.writeUInt32LE(payload.length, 4);
  const bytes = Buffer.concat([header, payload]);
  return { file: new File([bytes], name), bytes, data, fmt };
}
async function audioData(blob) {
  const parsed = await parseWav(blob);
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { parsed, data: Buffer.concat(parsed.segments.map(s => bytes.subarray(s.offset, s.offset + s.size))) };
}

test('48k/24-bit stereo: samples are identical and silence is exactly 1.5 seconds', async () => {
  const a = wav({ frames: 333, seed: 13, junk: true, name: '中文 空格.wav' });
  const b = wav({ frames: 411, seed: 177, split: true });
  const items = await Promise.all([parseWav(a.file), parseWav(b.file)]);
  const result = mergeWavs(items, 1.5);
  const { parsed, data } = await audioData(result.blob);
  assert.equal(parsed.fmt.rate, 48000); assert.equal(parsed.fmt.bits, 24); assert.equal(parsed.fmt.channels, 2);
  assert.deepEqual(parsed.fmt.bytes, items[0].fmt.bytes);
  assert.equal(parsed.frames, 333 + 72000 + 411);
  assert.equal(result.gapFrames, 72000);
  assert.deepEqual(data.subarray(0, a.data.length), a.data);
  assert.deepEqual(data.subarray(a.data.length, a.data.length + 72000 * 6), Buffer.alloc(72000 * 6));
  assert.deepEqual(data.subarray(a.data.length + 72000 * 6), b.data);
  assert.equal(data.length, a.data.length + b.data.length + 72000 * 6);
});

test('three files add only two gaps; reordering retains requested sequence', async () => {
  const inputs = [wav({ seed: 30 }), wav({ seed: 60 }), wav({ seed: 90 })];
  const items = await Promise.all(inputs.map(i => parseWav(i.file)));
  const result = mergeWavs([items[2], items[0], items[1]], 2);
  const { parsed, data } = await audioData(result.blob);
  assert.equal(parsed.frames, 300 + 2 * 96000);
  assert.deepEqual(data.subarray(0, 600), inputs[2].data);
  assert.deepEqual(data.subarray(600 + 96000 * 6, 1200 + 96000 * 6), inputs[0].data);
  assert.deepEqual(data.subarray(-600), inputs[1].data);
});

test('one file has no leading or trailing added silence', async () => {
  const input = wav({ bits: 8, channels: 1, frames: 3 });
  const result = mergeWavs([await parseWav(input.file)], 1);
  const { data, parsed } = await audioData(result.blob);
  assert.deepEqual(data, input.data); assert.equal(parsed.frames, 3);
  assert.equal(result.blob.size % 2, 0);
});

for (const [encoding, bits] of [[1, 8], [1, 16], [1, 24], [1, 32], [3, 32], [3, 64]]) {
  test(`encoding ${encoding}, ${bits}-bit: byte-exact samples and correct digital silence`, async () => {
    const input = wav({ encoding, bits, channels: 1, frames: 7 });
    const item = await parseWav(input.file);
    const result = mergeWavs([item, item], 1.1);
    const { parsed, data } = await audioData(result.blob);
    const silence = encoding === 1 && bits === 8 ? 128 : 0;
    assert.equal(parsed.fmt.encoding, encoding); assert.equal(parsed.fmt.bits, bits);
    assert.deepEqual(data.subarray(0, input.data.length), input.data);
    assert.deepEqual(data.subarray(input.data.length, -input.data.length), Buffer.alloc(52800 * bits / 8, silence));
    assert.deepEqual(data.subarray(-input.data.length), input.data);
    assert.equal(parsed.frames, 14 + 52800);
  });
}

test('WAVE_EXTENSIBLE 24-bit and equivalent classic PCM interoperate; first format is preserved', async () => {
  const first = wav({ extensible: true }), second = wav();
  const a = await parseWav(first.file), b = await parseWav(second.file);
  assert.deepEqual(differences(a.fmt, b.fmt), []);
  const { parsed } = await audioData(mergeWavs([a, b], 1).blob);
  assert.deepEqual(parsed.fmt.bytes, a.fmt.bytes);
});

test('different rates, depths, channels, layouts, valid depths and encodings are blocked', async () => {
  const base = await parseWav(wav().file);
  for (const opts of [{ rate: 44100 }, { bits: 16 }, { channels: 1 },
    { extensible: true, mask: 12 }, { extensible: true, validBits: 20 }, { encoding: 3, bits: 32 }]) {
    const other = await parseWav(wav(opts).file);
    assert.ok(differences(base.fmt, other.fmt).length);
    assert.throws(() => mergeWavs([base, other], 1.5), /不一致/);
  }
});

test('invalid gaps and empty list fail clearly', async () => {
  const item = await parseWav(wav().file);
  for (const gap of [0, 0.9, 2.1, NaN, Infinity]) assert.throws(() => mergeWavs([item], gap), /1–2/);
  assert.throws(() => mergeWavs([], 1.5), /至少一个/);
});

test('corrupt, compressed, truncated and disguised files are rejected', async () => {
  const good = wav();
  const cases = [Buffer.from('not a wav file, even with .wav extension'), good.bytes.subarray(0, -6)];
  for (const bytes of cases) await assert.rejects(parseWav(new File([bytes], 'fake.wav')));
  const compressed = Buffer.from(good.bytes); compressed.writeUInt16LE(6, 20);
  await assert.rejects(parseWav(new File([compressed], 'compressed.wav')), /仅支持/);
  const wrongAlign = Buffer.from(good.bytes); wrongAlign.writeUInt16LE(4, 32);
  await assert.rejects(parseWav(new File([wrongAlign], 'align.wav')), /不合法/);
  const tooShort = Buffer.from(good.bytes); tooShort.writeUInt32LE(99999999, 40);
  await assert.rejects(parseWav(new File([tooShort], 'length.wav')), /截断/);
  const truncatedFrame = wav({ raw: Buffer.alloc(7) });
  await assert.rejects(parseWav(truncatedFrame.file), /采样帧/);
  await assert.rejects(parseWav(wav({ frames: 0 }).file), /没有音频/);
});

test('RF64 headers use 64-bit lengths after RIFF limit without allocating giant buffers', async () => {
  const { fmt } = await parseWav(wav().file);
  const dataSize = Math.ceil(0x100000000 / fmt.blockAlign) * fmt.blockAlign;
  const header = makeHeader(fmt, dataSize), view = new DataView(header.bytes);
  assert.equal(header.rf64, true);
  assert.equal(Buffer.from(header.bytes).subarray(0, 4).toString(), 'RF64');
  assert.equal(view.getUint32(4, true), 0xffffffff);
  assert.equal(view.getBigUint64(20, true), BigInt(header.totalSize - 8));
  assert.equal(view.getBigUint64(28, true), BigInt(dataSize));
  assert.equal(view.getBigUint64(36, true), BigInt(dataSize / fmt.blockAlign));
  assert.equal(view.getUint32(header.bytes.byteLength - 4, true), 0xffffffff);
});

test('standard RF64 is accepted and length disagreement is rejected', async () => {
  const input = wav(), item = await parseWav(input.file);
  const normal = makeHeader(item.fmt, input.data.length);
  const rf = Buffer.alloc(normal.bytes.byteLength + 36);
  Buffer.from(normal.bytes).copy(rf, 0, 0, 12);
  rf.write('RF64'); rf.writeUInt32LE(0xffffffff, 4);
  rf.write('ds64', 12); rf.writeUInt32LE(28, 16);
  rf.writeBigUInt64LE(BigInt(rf.length + input.data.length - 8), 20);
  rf.writeBigUInt64LE(BigInt(input.data.length), 28);
  rf.writeBigUInt64LE(BigInt(item.frames), 36);
  Buffer.from(normal.bytes).copy(rf, 48, 12); rf.writeUInt32LE(0xffffffff, rf.length - 4);
  const parsed = await parseWav(new File([rf, input.data], 'rf64.wav'));
  assert.equal(parsed.frames, item.frames);
  rf.writeBigUInt64LE(1n, 36);
  await assert.rejects(parseWav(new File([rf, input.data], 'broken.wav')), /不一致/);
});

module.exports = { wav };
