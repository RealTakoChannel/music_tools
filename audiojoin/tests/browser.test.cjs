'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseWav } = require('../wav-engine.js');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

function tone(hz, frames, seed = 0) {
  const channels = 2, rate = 48000, align = 6;
  const data = Buffer.alloc(frames * align);
  for (let frame = 0; frame < frames; frame++) {
    const sample = Math.round(Math.sin((frame + seed) * 2 * Math.PI * hz / rate) * 0x3fffff);
    for (let ch = 0; ch < channels; ch++) data.writeIntLE(sample, frame * align + ch * 3, 3);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(data.length + 36, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * align, 28);
  header.writeUInt16LE(align, 32); header.writeUInt16LE(24, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return { bytes: Buffer.concat([header, data]), data };
}

(async () => {
  const project = path.resolve(__dirname, '..');
  const output = path.resolve(project, '..', 'tmp', 'audiojoin-qa');
  await fs.mkdir(output, { recursive: true });
  const earlier = tone(220, 6000), first = tone(440, 12000), second = tone(660, 19200, 27);
  const earlierPath = path.join(output, '片段 1 - 220Hz.wav');
  const firstPath = path.join(output, '片段 2 - 440Hz.wav');
  const secondPath = path.join(output, '片段 10 - 660Hz.wav');
  await fs.writeFile(earlierPath, earlier.bytes);
  await fs.writeFile(firstPath, first.bytes); await fs.writeFile(secondPath, second.bytes);
  const mismatch = Buffer.from(first.bytes); mismatch.writeUInt32LE(44100, 24); mismatch.writeUInt32LE(44100 * 6, 28);
  const mismatchPath = path.join(output, '不同采样率.wav'); await fs.writeFile(mismatchPath, mismatch);
  const badPath = path.join(output, '损坏.wav'); await fs.writeFile(badPath, 'not a wav');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    const errors = [], remoteRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
    const pageRoot = process.env.AUDIOJOIN_PAGE_ROOT || project;
    await page.goto(pathToFileURL(path.join(pageRoot, 'index.html')).href + (process.env.AUDIOJOIN_PAGE_ROOT ? '?desktop=1' : ''));
    await page.waitForFunction(() => typeof WavJoiner !== 'undefined');
    assert.equal(await page.locator('#mergeBtn').isDisabled(), true);
    await page.screenshot({ path: path.join(output, '01-empty.png'), fullPage: true });
    // Selection order is deliberately reversed; numeric file names must sort naturally.
    await page.locator('#fileInput').setInputFiles([secondPath, firstPath]);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '2' && !document.querySelector('#mergeBtn').disabled);
    assert.equal(await page.locator('#specRate').textContent(), '48 kHz / 24-bit');
    assert.equal(await page.locator('#totalTime').textContent(), '00:02.150');
    assert.deepEqual(await page.locator('.file-name').allTextContents(), [path.basename(firstPath), path.basename(secondPath)]);
    assert.equal(await page.locator('#outputName').inputValue(), path.basename(firstPath, '.wav'));
    assert.equal(await page.locator('button[aria-label^="上移"],button[aria-label^="下移"]').count(), 0);
    assert.equal(await page.locator('.file-row').first().evaluate(row => row.draggable), false);
    // An appended lower-numbered file must move before the existing queue.
    await page.locator('#fileInput').setInputFiles(earlierPath);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '3' && !document.querySelector('#mergeBtn').disabled);
    const sortedNames = [path.basename(earlierPath), path.basename(firstPath), path.basename(secondPath)];
    assert.deepEqual(await page.locator('.file-name').allTextContents(), sortedNames);
    assert.equal(await page.locator('#outputName').inputValue(), path.basename(earlierPath, '.wav'));
    await page.getByRole('button', { name: '2 秒', exact: true }).click();
    assert.equal(await page.locator('#totalTime').textContent(), '00:04.775');
    await page.locator('#mergeBtn').click();
    await page.locator('#download').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(output, '02-result.png'), fullPage: true });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
    assert.equal(download.suggestedFilename(), path.basename(earlierPath));
    const downloadedPath = path.join(output, '实际下载.wav'); await download.saveAs(downloadedPath);
    const downloaded = await fs.readFile(downloadedPath);
    const parsed = await parseWav(new File([downloaded], 'output.wav'));
    assert.equal(parsed.frames, 6000 + 12000 + 19200 + 2 * 96000);
    assert.equal(parsed.fmt.rate, 48000); assert.equal(parsed.fmt.bits, 24);
    const audio = downloaded.subarray(parsed.segments[0].offset, parsed.segments[0].offset + parsed.dataSize);
    assert.deepEqual(audio, Buffer.concat([earlier.data, Buffer.alloc(96000 * 6), first.data, Buffer.alloc(96000 * 6), second.data]));
    assert.deepEqual(await page.locator('.file-name').allTextContents(), sortedNames);
    // Removing the first file updates the default name; re-adding it restores that name.
    await page.getByRole('button', { name: `移除 ${path.basename(earlierPath)}`, exact: true }).click();
    assert.equal(await page.locator('#outputName').inputValue(), path.basename(firstPath, '.wav'));
    await page.locator('#fileInput').setInputFiles(earlierPath);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '3' && !document.querySelector('#mergeBtn').disabled);
    assert.equal(await page.locator('#outputName').inputValue(), path.basename(earlierPath, '.wav'));
    // A manually entered name survives changes to the first file and the gap.
    await page.locator('#outputName').fill('中文合并.wav');
    assert.equal(await page.locator('#outputSuffix').isHidden(), true);
    await page.getByRole('button', { name: `移除 ${path.basename(earlierPath)}`, exact: true }).click();
    assert.equal(await page.locator('#outputName').inputValue(), '中文合并.wav');
    await page.locator('#fileInput').setInputFiles(earlierPath);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '3' && !document.querySelector('#mergeBtn').disabled);
    assert.equal(await page.locator('#outputName').inputValue(), '中文合并.wav');
    await page.locator('#mergeBtn').click();
    await page.locator('#download').waitFor({ state: 'visible' });
    const [renamedDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
    assert.equal(renamedDownload.suggestedFilename(), '中文合并.wav');
    // Setting changes revoke the stale result. Incompatible files block output.
    await page.getByRole('button', { name: '1 秒', exact: true }).click();
    assert.equal(await page.locator('#outputName').inputValue(), '中文合并.wav');
    assert.equal(await page.locator('#result').isHidden(), true);
    await page.locator('#fileInput').setInputFiles(mismatchPath);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '4' && !document.querySelector('#dropzone').disabled);
    assert.equal(await page.locator('#mergeBtn').isDisabled(), true);
    assert.match(await page.locator('#compatibility').textContent(), /不一致/);
    await page.getByRole('button', { name: '移除 不同采样率.wav', exact: true }).click();
    assert.equal(await page.locator('#mergeBtn').isEnabled(), true);
    await page.locator('#fileInput').setInputFiles(badPath);
    await page.waitForFunction(() => !document.querySelector('#dropzone').disabled);
    assert.equal(await page.locator('#count').textContent(), '3');
    assert.match(await page.locator('#message').textContent(), /未添加/);
    // A real Files drop payload exercises the drag-and-drop input route.
    await page.getByRole('button', { name: '清空', exact: true }).click();
    assert.equal(await page.locator('#outputName').inputValue(), '');
    const transfer = await page.evaluateHandle(files => {
      const data = new DataTransfer();
      for (const { base64, name } of files) {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        data.items.add(new File([bytes], name, { type: 'audio/wav' }));
      }
      return data;
    }, [{ base64: second.bytes.toString('base64'), name: path.basename(secondPath) },
      { base64: first.bytes.toString('base64'), name: path.basename(firstPath) }]);
    await page.locator('#dropzone').dispatchEvent('drop', { dataTransfer: transfer });
    await page.waitForFunction(() => document.querySelector('#count').textContent === '2' && !document.querySelector('#mergeBtn').disabled);
    assert.deepEqual(await page.locator('.file-name').allTextContents(), [path.basename(firstPath), path.basename(secondPath)]);
    assert.equal(await page.locator('#totalTime').textContent(), '00:01.650');
    assert.equal(await page.locator('#outputName').inputValue(), path.basename(firstPath, '.wav'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, '03-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
    await context.close();
    console.log('Browser checks passed: first sorted filename defaults and download name, appended/removed first file updates, custom name preservation and download, clear reset, natural sorting, sorted download bytes, mismatch blocking, offline/mobile checks.');
    console.log(`Screenshots and verified download: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
