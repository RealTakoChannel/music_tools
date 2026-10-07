/* Audio Joiner: container parsing and byte-preserving PCM assembly. No Web Audio decoding. */
(function (root) {
  'use strict';
  const text = (v, at, count) => String.fromCharCode(...new Uint8Array(v.buffer, v.byteOffset + at, count));
  const u64 = (v, at) => {
    const n = v.getBigUint64(at, true);
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('文件太大，超出浏览器可精确处理的范围。');
    return Number(n);
  };
  async function read(file, start, length) {
    const buffer = await file.slice(start, start + length).arrayBuffer();
    if (buffer.byteLength !== length) throw new Error('WAV 文件不完整，无法读取所需数据。');
    return new DataView(buffer);
  }
  async function parseWav(file) {
    if (file.size < 12) throw new Error('文件太小，不是完整的 WAV。');
    const header = await read(file, 0, 12);
    const container = text(header, 0, 4);
    if (container === 'RIFX') throw new Error('暂不支持大端 RIFX WAV，请使用标准小端 PCM WAV。');
    if (!['RIFF', 'RF64'].includes(container) || text(header, 8, 4) !== 'WAVE') {
      throw new Error('只接受 WAV 文件；不能通过修改扩展名转换音频。');
    }
    let end = container === 'RF64' ? file.size : header.getUint32(4, true) + 8;
    if (end > file.size || end < 12) throw new Error('WAV 长度信息无效，文件可能已损坏或未完成录制。');
    let offset = 12, fmt = null, ds = null, chunks = 0;
    const segments = [];
    while (offset < end) {
      if (++chunks > 10000) throw new Error('WAV 包含过多数据块，无法处理。');
      if (end - offset < 8) throw new Error('WAV 数据块头不完整。');
      const chunk = await read(file, offset, 8);
      const id = text(chunk, 0, 4);
      let size = chunk.getUint32(4, true);
      if (size === 0xffffffff) {
        if (!ds || id !== 'data' || segments.length) throw new Error('不支持此 RF64 数据块结构。');
        size = ds.dataSize;
      }
      if (size > end - offset - 8) throw new Error('WAV 数据块超过文件长度，文件可能被截断。');
      if (id === 'ds64' && container === 'RF64') {
        if (offset !== 12 || ds || size < 28 || size > 4096) throw new Error('RF64 的 ds64 数据块无效。');
        const view = await read(file, offset + 8, size);
        ds = { dataSize: u64(view, 8), frames: u64(view, 16) };
        end = u64(view, 0) + 8;
        if (end > file.size || end < offset + 8 + size || view.getUint32(24, true) !== 0) {
          throw new Error('不支持此 RF64 长度或扩展表。');
        }
      } else if (id === 'fmt ') {
        if (fmt || size < 16 || size > 1024) throw new Error('WAV 格式信息无效。');
        const view = await read(file, offset + 8, size);
        let encoding = view.getUint16(0, true);
        const channels = view.getUint16(2, true), rate = view.getUint32(4, true);
        const byteRate = view.getUint32(8, true), blockAlign = view.getUint16(12, true);
        const bits = view.getUint16(14, true);
        let validBits = bits, mask = channels === 1 ? 4 : channels === 2 ? 3 : 0;
        if (encoding === 0xfffe) {
          if (size < 40 || view.getUint16(16, true) < 22 || view.getUint16(16, true) + 18 > size) {
            throw new Error('WAVE_EXTENSIBLE 格式信息不完整。');
          }
          validBits = view.getUint16(18, true) || bits;
          mask = view.getUint32(20, true) || mask;
          encoding = view.getUint32(24, true);
          const tail = [...new Uint8Array(view.buffer, 28, 12)];
          if (tail.join(',') !== '0,0,16,0,128,0,0,170,0,56,155,113') {
            throw new Error('仅支持 PCM 或 IEEE Float 编码的 WAV。');
          }
        } else if (size !== 16 && (size < 18 || view.getUint16(16, true) + 18 > size)) {
          throw new Error('WAV 扩展格式信息不完整。');
        }
        if ((encoding !== 1 && encoding !== 3) ||
            (encoding === 1 && ![8, 16, 24, 32].includes(bits)) ||
            (encoding === 3 && ![32, 64].includes(bits))) {
          throw new Error('仅支持 8/16/24/32-bit PCM 或 32/64-bit Float WAV。');
        }
        if (!channels || channels > 64 || !rate || rate > 768000 ||
            blockAlign !== channels * bits / 8 || byteRate !== rate * blockAlign ||
            validBits < 1 || validBits > bits || (encoding === 3 && validBits !== bits)) {
          throw new Error('采样率、位深或声道信息不合法。');
        }
        fmt = { encoding, channels, rate, bits, validBits, mask, blockAlign,
          bytes: new Uint8Array(view.buffer) };
      } else if (id === 'data') {
        segments.push({ offset: offset + 8, size });
      }
      offset += 8 + size + (size % 2);
      if (offset > end) throw new Error('WAV 数据块缺少对齐字节。');
    }
    if (container === 'RF64' && !ds) throw new Error('RF64 缺少 ds64 长度信息。');
    if (!fmt || !segments.length) throw new Error('WAV 缺少 fmt 或 data 数据块。');
    if (segments.some(s => s.size % fmt.blockAlign)) throw new Error('音频数据未按完整采样帧对齐。');
    const dataSize = segments.reduce((sum, s) => sum + s.size, 0);
    if (!dataSize) throw new Error('WAV 内没有音频采样数据。');
    const frames = dataSize / fmt.blockAlign;
    if (ds && (ds.dataSize !== dataSize || (ds.frames && ds.frames !== frames))) {
      throw new Error('RF64 的采样数与数据长度不一致。');
    }
    return { file, fmt, segments, dataSize, frames, duration: frames / fmt.rate };
  }
  function differences(a, b) {
    return [ ['rate', '采样率'], ['bits', '存储位深'], ['validBits', '有效位深'],
      ['channels', '声道数'], ['mask', '声道布局'], ['encoding', '采样编码'] ]
      .filter(([key]) => a[key] !== b[key]).map(([, label]) => label);
  }
  function makeHeader(fmt, dataSize) {
    if (!Number.isSafeInteger(dataSize) || dataSize < 0 || dataSize % fmt.blockAlign) {
      throw new Error('输出音频长度无效。');
    }
    const fmtSize = fmt.bytes.length, fmtPadded = fmtSize + fmtSize % 2;
    const factSize = fmt.encoding === 3 ? 12 : 0;
    const baseSize = 12 + 8 + fmtPadded + factSize + 8;
    const rf64 = baseSize - 8 + dataSize + dataSize % 2 > 0xffffffff;
    const headerSize = baseSize + (rf64 ? 36 : 0);
    const totalSize = headerSize + dataSize + dataSize % 2;
    if (!Number.isSafeInteger(totalSize)) throw new Error('输出文件太大。');
    const buffer = new ArrayBuffer(headerSize), view = new DataView(buffer);
    const put = (at, str) => [...str].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    put(0, rf64 ? 'RF64' : 'RIFF');
    view.setUint32(4, rf64 ? 0xffffffff : totalSize - 8, true); put(8, 'WAVE');
    let at = 12;
    if (rf64) {
      put(at, 'ds64'); view.setUint32(at + 4, 28, true);
      view.setBigUint64(at + 8, BigInt(totalSize - 8), true);
      view.setBigUint64(at + 16, BigInt(dataSize), true);
      view.setBigUint64(at + 24, BigInt(dataSize / fmt.blockAlign), true);
      view.setUint32(at + 32, 0, true); at += 36;
    }
    put(at, 'fmt '); view.setUint32(at + 4, fmtSize, true);
    new Uint8Array(buffer, at + 8, fmtSize).set(fmt.bytes); at += 8 + fmtPadded;
    if (factSize) {
      put(at, 'fact'); view.setUint32(at + 4, 4, true);
      view.setUint32(at + 8, Math.min(dataSize / fmt.blockAlign, 0xffffffff), true); at += 12;
    }
    put(at, 'data'); view.setUint32(at + 4, rf64 ? 0xffffffff : dataSize, true);
    return { bytes: buffer, rf64, totalSize };
  }
  function mergeWavs(items, gapSeconds) {
    if (!items.length) throw new Error('请先添加至少一个 WAV 文件。');
    if (!Number.isFinite(gapSeconds) || gapSeconds < 1 || gapSeconds > 2) {
      throw new Error('间隔必须在 1–2 秒之间。');
    }
    const fmt = items[0].fmt;
    items.forEach((item, i) => {
      const diff = differences(fmt, item.fmt);
      if (diff.length) throw new Error(`第 ${i + 1} 个文件的${diff.join('、')}与第一个文件不一致。`);
    });
    const gapFrames = Math.round(gapSeconds * fmt.rate);
    const gapBytes = gapFrames * fmt.blockAlign;
    const silenceBytes = new Uint8Array(gapBytes);
    if (fmt.encoding === 1 && fmt.bits === 8) silenceBytes.fill(128);
    const silence = new Blob([silenceBytes]);
    const dataSize = items.reduce((sum, item) => sum + item.dataSize, 0) + gapBytes * (items.length - 1);
    const header = makeHeader(fmt, dataSize);
    const parts = [header.bytes];
    items.forEach((item, index) => {
      if (index) parts.push(silence);
      for (const segment of item.segments) parts.push(item.file.slice(segment.offset, segment.offset + segment.size));
    });
    if (dataSize % 2) parts.push(new Uint8Array(1));
    const blob = new Blob(parts, { type: 'audio/wav' });
    if (blob.size !== header.totalSize) throw new Error('浏览器未能正确组装输出文件，请重试。');
    return { blob, rf64: header.rf64, gapFrames, gapSeconds: gapFrames / fmt.rate,
      frames: dataSize / fmt.blockAlign, duration: dataSize / fmt.blockAlign / fmt.rate, fmt };
  }
  const api = { parseWav, differences, makeHeader, mergeWavs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WavJoiner = api;
})(globalThis);
