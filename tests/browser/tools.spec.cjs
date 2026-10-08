const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseWav } = require('../../audiojoin/wav-engine.js');

function tone(seconds, { rate = 16000, bits = 16, silence = false, bpm = 0 } = {}) {
  const frames = Math.round(rate * seconds), align = bits / 8;
  const data = Buffer.alloc(frames * align);
  for (let frame = 0; frame < frames; frame++) {
    const phase = bpm ? frame % (rate * 60 / bpm) : 0;
    const gain = silence ? 0 : bpm ? phase < rate * .04 ? Math.exp(-phase / (rate * .012)) : 0 : .5;
    const value = Math.round(Math.sin(frame * 2 * Math.PI * 500 / rate) * gain * (2 ** (bits - 2) - 1));
    data.writeIntLE(value, frame * align, align);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(data.length + 36, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * align, 28);
  header.writeUInt16LE(align, 32); header.writeUInt16LE(bits, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return { bytes: Buffer.concat([header, data]), data };
}
const upload = (name, bytes) => ({ name, mimeType: 'audio/wav', buffer: bytes });
async function drop(page, selector, files) {
  await page.locator(selector).evaluate((node, entries) => {
    const transfer = new DataTransfer();
    for (const entry of entries) transfer.items.add(new File([new Uint8Array(entry.bytes)], entry.name, { type: 'audio/wav' }));
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, files.map(({ name, bytes }) => ({ name, bytes: [...bytes] })));
}
test.beforeEach(async ({ page }) => {
  // Keep existing audio/UI tests independent of GitHub availability and rate limits.
  await page.route('https://api.github.com/repos/RealTakoChannel/music_tools', route => route.fulfill({ json: { stargazers_count: 42 } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /React|Hook|Cannot update|unique.*key|hydration/i.test(message.text())) errors.push(message.text());
  });
  page.__runtimeErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.__runtimeErrors).toEqual([]); });

test('home navigation and language preference persist across all tools', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tool')).toHaveCount(3);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.locator('.tool').first().click();
  await expect(page).toHaveTitle('Audio Joiner · Music Tools');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await page.locator('.tool').nth(2).click();
  await expect(page).toHaveTitle('Mixing Price Calculator · Music Tools');
});

test('WAV merge preserves 24-bit bytes, natural sort, gaps and editable output name', async ({ page }) => {
  const first = tone(.25, { rate: 48000, bits: 24 }), second = tone(.4, { rate: 48000, bits: 24 });
  await page.goto('/audiojoin/index.html');
  await expect(page.locator('#mergeBtn')).toBeDisabled();
  await page.locator('#fileInput').setInputFiles([upload('clip 10.wav', second.bytes), upload('clip 2.wav', first.bytes)]);
  await expect(page.locator('#count')).toHaveText('2');
  await expect(page.locator('.file-name')).toHaveText(['clip 2.wav', 'clip 10.wav']);
  await expect(page.locator('#totalTime')).toHaveText('00:02.150');
  await expect(page.locator('#outputName')).toHaveValue('clip 2');
  await page.locator('#outputName').fill('My merge');
  await page.getByRole('button', { name: '2 秒', exact: true }).click();
  await page.locator('#mergeBtn').click();
  await expect(page.locator('#download')).toBeVisible();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('#outputName')).toHaveValue('My merge');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('My merge.wav');
  const bytes = await fs.readFile(await download.path());
  const blob = new Blob([bytes]);
  const parsed = await parseWav(blob);
  expect(parsed.fmt.bits).toBe(24);
  expect(parsed.fmt.rate).toBe(48000);
  expect(parsed.duration).toBe(2.65);
  const samples = Buffer.concat(parsed.segments.map(segment => bytes.subarray(segment.offset, segment.offset + segment.size)));
  expect(samples.subarray(0, first.data.length).equals(first.data)).toBe(true);
  expect(samples.subarray(first.data.length + 2 * 48000 * 3).equals(second.data)).toBe(true);
  expect(samples.subarray(first.data.length, first.data.length + 2 * 48000 * 3).every(byte => byte === 0)).toBe(true);
  await page.locator('#gapRange').fill('1.2');
  await expect(page.locator('#download')).toHaveCount(0);
});

test('WAV incompatible and corrupt files show translated errors; removal restores merge', async ({ page }) => {
  await page.goto('/audiojoin/index.html');
  await page.locator('#fileInput').setInputFiles([upload('a.wav', tone(1).bytes), upload('b.wav', tone(1, { rate: 44100 }).bytes), upload('broken.wav', Buffer.from('broken'))]);
  await expect(page.locator('#count')).toHaveText('2');
  await expect(page.locator('#mergeBtn')).toBeDisabled();
  await expect(page.locator('.notice')).toContainText('broken.wav');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.file-meta').last()).toContainText('sample rate');
  await page.getByRole('button', { name: 'Remove b.wav', exact: true }).click();
  await expect(page.locator('#mergeBtn')).toBeEnabled();
});

test('BPM mapping, corrections, clipboard and input validation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/bpmcalc/index.html');
  await page.locator('#detectedBpm').fill('75');
  await expect(page.locator('#normalizedBpm')).toHaveText('150.0');
  await page.locator('[data-factor="2"]').click();
  await expect(page.locator('#detectedBpm')).toHaveValue('150.0');
  await page.locator('#copyButton').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('150.0');
  await page.locator('#lowerBound').fill('0');
  await expect(page.locator('#normalizedBpm')).toHaveText('—');
  await expect(page.locator('#copyButton')).toBeDisabled();
});

test('BPM analysis runs locally and reports short audio errors', async ({ page }) => {
  await page.goto('/bpmcalc/index.html');
  const requests = [];
  page.on('request', request => { if (request.method() !== 'GET') requests.push(request.url()); });
  await page.locator('#audioFileInput').setInputFiles(upload('120-bpm.wav', tone(15, { bpm: 120 }).bytes));
  await expect(page.locator('.analysis-result')).toContainText('BPM');
  expect(Math.abs(Number(await page.locator('#detectedBpm').inputValue()) - 120)).toBeLessThan(2);
  await page.locator('#audioFileInput').setInputFiles(upload('short.wav', tone(2).bytes));
  await expect(page.locator('.notice.error')).toContainText('至少 5 秒');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.notice.error')).toContainText('at least 5 seconds');
  expect(requests).toEqual([]);
});

test('Tap Tempo works with Space, preserves focus, and ignores editable fields', async ({ page }) => {
  await page.goto('/bpmcalc/index.html');
  await page.locator('h1').click();
  await page.keyboard.press('Space');
  await expect(page.locator('#resetTapButton')).toBeEnabled();
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  const bpm = Number(await page.locator('#detectedBpm').inputValue());
  expect(bpm).toBeGreaterThan(70); expect(bpm).toBeLessThan(180);
  await page.locator('#detectedBpm').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#detectedBpm')).toHaveValue(bpm.toFixed(1));
  await page.locator('#tapButton').focus(); await page.waitForTimeout(150); await page.keyboard.press('Space');
  await expect(page.locator('#tapButton')).toBeFocused();
  await page.locator('#resetTapButton').click();
  await expect(page.locator('#tapBpm')).toHaveText('等待打拍');
});

test('cashier preserves pricing boundaries, manual overrides, rounding and translated errors', async ({ page }) => {
  await page.goto('/cashier/index.html');
  for (const [time, mode, result] of [['0:39','twenty','¥ 20'], ['0:40','time','¥ 20'], ['2:19','time','¥ 69.5'], ['2:20','full','¥ 70'], ['5:00','full','¥ 70'], ['','time','¥ 0']]) {
    await page.locator('#leftInput').fill(time);
    await expect(page.locator('#leftResult')).toHaveText(result);
    expect(await page.locator('#leftFixedPrice').isChecked()).toBe(mode === 'full');
    expect(await page.locator('#leftTwentyPrice').isChecked()).toBe(mode === 'twenty');
  }
  await page.locator('#leftInput').fill('5:00');
  await page.locator('#leftFixedPrice').uncheck();
  await page.locator('#rightInput').fill('1:00');
  await expect(page.locator('#totalResult')).toHaveText('¥ 170');
  for (const language of ['en','ja','zh']) {
    await page.locator(`[data-language="${language}"]`).click();
    await expect(page.locator('#totalResult')).toHaveText('¥ 170');
    await expect(page.locator('#leftInput')).toHaveValue('5:00');
    await expect(page.locator('#leftFixedPrice')).not.toBeChecked();
  }
  await page.locator('#leftInput').fill('1:01');
  await page.locator('#rightInput').fill('0:19');
  await expect(page.locator('#totalResult')).toHaveText('¥ 35');
  await page.locator('#roundTotalToggle').uncheck();
  await expect(page.locator('#totalResult')).toHaveText('¥ 36.83');
  await page.locator('#leftInput').fill('bad');
  await page.locator('[data-language="en"]').click();
  await expect(page.locator('#leftResult')).toHaveText('Invalid time format');
  await expect(page.locator('#totalResult')).toHaveText('Please correct the inputs');
});

test('cashier sums real multi-file vocals independently, preserves manual quote on failed batches', async ({ page }) => {
  await page.goto('/cashier/index.html');
  await page.locator('#leftFileInput').setInputFiles([upload('lead-a.wav', tone(60).bytes), upload('lead-b.wav', tone(10).bytes)]);
  await page.locator('#rightFileInput').setInputFiles(upload('harmony.wav', tone(30).bytes));
  await expect(page.locator('#leftInput')).toHaveValue('1:10.00');
  await expect(page.locator('#rightInput')).toHaveValue('0:30.00');
  await expect(page.locator('#totalResult')).toHaveText('¥ 45');
  await page.locator('#leftInput').fill('2:00');
  await page.locator('#leftFileInput').setInputFiles(upload('empty.wav', Buffer.alloc(0)));
  await expect(page.locator('#leftFileList')).toContainText('文件为空');
  await expect(page.locator('#leftInput')).toHaveValue('2:00');
  await page.getByRole('button', { name: '移除 lead-a.wav', exact: true }).click();
  await expect(page.locator('#leftInput')).toHaveValue('0:10.00');
  await page.locator('[data-language="en"]').click();
  await expect(page.locator('#leftFileList')).toContainText('Empty file');
  await expect(page.locator('#leftFileList .file-name').first()).toHaveText('lead-b.wav');
});

test('cashier queues drops during analysis, resets nested highlighting, and refills on threshold changes', async ({ page }) => {
  await page.addInitScript(() => {
    const original = OfflineAudioContext.prototype.decodeAudioData;
    OfflineAudioContext.prototype.decodeAudioData = async function (...args) { await new Promise(resolve => setTimeout(resolve, 350)); return original.apply(this, args); };
  });
  await page.goto('/cashier/index.html');
  await drop(page, '#leftFileInputDropzone', [{ name: 'first.wav', bytes: tone(2).bytes }]);
  await expect(page.locator('#leftFileInputDropzone')).toHaveAttribute('aria-busy', 'true');
  await drop(page, '#leftFileInputDropzone', [{ name: 'next.wav', bytes: tone(5).bytes }, { name: 'last.wav', bytes: tone(6).bytes }]);
  await page.locator('[data-language="en"]').click();
  await expect(page.locator('#leftInput')).toHaveValue('0:13.00');
  await expect(page.locator('#leftFileList .file-name')).toHaveCount(3);
  await page.locator('#leftInput').fill('3:00');
  await page.locator('summary').first().click();
  await page.locator('#silenceThreshold').fill('-59');
  await expect(page.locator('#leftInput')).toHaveValue('0:13.00');
  await expect(page.locator('#rightInput')).toHaveValue('0:00.00');
  const drag = await page.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'x.wav')); return d; });
  const box = page.locator('#leftFileInputDropzone');
  await box.dispatchEvent('dragenter', { dataTransfer: drag });
  await box.dispatchEvent('dragenter', { dataTransfer: drag });
  await box.dispatchEvent('dragleave', { dataTransfer: drag });
  await expect(box).toHaveClass(/over/);
  await box.dispatchEvent('dragleave', { dataTransfer: drag });
  await expect(box).not.toHaveClass(/over/);
  await box.dispatchEvent('dragenter', { dataTransfer: drag });
  await page.locator('body').dispatchEvent('drop', { dataTransfer: drag });
  await expect(box).not.toHaveClass(/over/);
  await expect(page.locator('#leftFileList .file-name')).toHaveCount(3);
});

test('responsive pages and reduced motion are usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fs.mkdir('tmp/react-qa', { recursive: true });
  for (const tool of ['home','audiojoin','bpmcalc','cashier']) {
    await page.goto(tool === 'home' ? '/' : `/${tool}/index.html`);
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('[data-language="en"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `tmp/react-qa/${tool}-mobile.png`, fullPage: true, animations: 'disabled' });
  }
  await page.goto('/'); await page.locator('.tool').first().hover();
  expect(await page.locator('.tool').first().evaluate(node => getComputedStyle(node).transform)).toBe('none');
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.locator('[data-language="zh"]').click();
  await page.screenshot({ path: 'tmp/react-qa/home-desktop.png', fullPage: true, animations: 'disabled' });
  await page.goto('/audiojoin/index.html');
  await expect(page.locator('#mergeBtn')).toBeVisible();
  await page.screenshot({ path: 'tmp/react-qa/audiojoin-desktop.png', fullPage: true, animations: 'disabled' });
});

test('blocked storage still allows React language changes and preserves current inputs', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }));
  await page.goto('/cashier/index.html');
  await page.locator('#leftInput').fill('1:30');
  await page.locator('[data-language="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#leftInput')).toHaveValue('1:30');
  await expect(page.locator('#totalResult')).toHaveText('¥ 45');
});

test('one offline HTML switches between all tools without network requests', async ({ page }) => {
  const network = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(path.resolve('dist/offline/index.html')).href);
  await expect(page.locator('.tool')).toHaveCount(3);
  await expect(page.locator('.github-star')).toHaveAttribute('data-status', 'offline');
  await expect(page.locator('[data-star-count]')).toHaveText('—');
  await page.locator('.tool').first().click();
  await expect(page.locator('#mergeBtn')).toBeDisabled();
  await page.locator('#fileInput').setInputFiles(upload('offline.wav', tone(1).bytes));
  await page.locator('#mergeBtn').click();
  await expect(page.locator('#download')).toBeVisible();
  const offlinePath = pathToFileURL(path.resolve('dist/offline/index.html')).href;
  await page.locator('.app-navigation a[href="#/cashier"]').click();
  expect(page.url()).toBe(`${offlinePath}#/cashier`);
  await page.locator('#leftInput').fill('1:00');
  await expect(page.locator('#totalResult')).toHaveText('¥ 30');
  await page.locator('.app-navigation a[href="#/bpmcalc"]').click();
  await page.locator('#detectedBpm').fill('75');
  await expect(page.locator('#normalizedBpm')).toHaveText('150.0');
  await page.locator('.app-navigation a[href="#/audiojoin"]').click();
  await expect(page.locator('#download')).toBeVisible();
  expect(network).toEqual([]);
});

test('SPA navigation preserves files, merge output, BPM inputs and manual quotes without reload', async ({ page }) => {
  await page.goto('/#/audiojoin');
  await expect(page.locator('#mergeBtn')).toBeDisabled();
  await page.evaluate(() => { window.__spaSession = 'same-document'; });
  const documents = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
  await page.locator('#fileInput').setInputFiles(upload('saved.wav', tone(1).bytes));
  await page.locator('#outputName').fill('Session export');
  await page.locator('#mergeBtn').click();
  await expect(page.locator('#download')).toBeVisible();
  const url = await page.locator('#download').getAttribute('href');
  await page.locator('audio').evaluate(audio => audio.play());
  await page.locator('.app-navigation a[href="#/bpmcalc"]').click();
  await expect(page.locator('#detectedBpm')).toBeVisible();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await page.locator('#detectedBpm').fill('75');
  await page.locator('#lowerBound').fill('90');
  await expect(page.locator('#normalizedBpm')).toHaveText('150.0');
  await page.locator('.app-navigation a[href="#/cashier"]').click();
  await page.locator('#leftInput').fill('5:00');
  await page.locator('#leftFixedPrice').uncheck();
  await page.locator('#rightInput').fill('1:00');
  await page.locator('[data-language="en"]').click();
  await expect(page).toHaveTitle('Mixing Price Calculator · Music Tools');
  await expect(page.locator('#totalResult')).toHaveText('¥ 170');
  await page.goBack();
  await expect(page.locator('#detectedBpm')).toBeVisible();
  await expect(page.locator('#detectedBpm')).toHaveValue('75');
  await expect(page.locator('#lowerBound')).toHaveValue('90');
  await expect(page).toHaveTitle('BPM Correction Tool · Music Tools');
  await page.goBack();
  await expect(page.locator('#download')).toBeVisible();
  await expect(page.locator('#outputName')).toHaveValue('Session export');
  await expect(page.locator('#count')).toHaveText('1');
  expect(await page.locator('#download').getAttribute('href')).toBe(url);
  await page.goForward(); await page.goForward();
  await expect(page.locator('#leftInput')).toBeVisible();
  await expect(page.locator('#leftFixedPrice')).not.toBeChecked();
  await expect(page.locator('#totalResult')).toHaveText('¥ 170');
  expect(await page.evaluate(() => window.__spaSession)).toBe('same-document');
  expect(documents).toEqual([]);
  await expect(page.locator('.app-navigation [aria-current="page"]')).toHaveAttribute('href', '#/cashier');
  await expect(page.locator('.tool-view:not([hidden])')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#leftInput')).toBeVisible();
  await expect(page.locator('#leftInput')).toHaveValue('');
});

test('cached tools do not intercept the current tool keyboard or file drops', async ({ page }) => {
  await page.goto('/#/bpmcalc');
  await page.locator('#detectedBpm').fill('88');
  await page.locator('h1').click(); await page.keyboard.press('Space');
  await expect(page.locator('#resetTapButton')).toBeEnabled();
  await page.locator('.app-navigation a[href="#/audiojoin"]').click();
  await page.locator('#fileInput').setInputFiles(upload('merge.wav', tone(1).bytes));
  await expect(page.locator('#count')).toHaveText('1');
  await page.locator('.app-navigation a[href="#/cashier"]').click();
  await drop(page, '#leftFileInputDropzone', [{ name: 'vocal.wav', bytes: tone(2).bytes }]);
  await expect(page.locator('#leftInput')).toHaveValue('0:02.00');
  await page.locator('.tool-view:not([hidden]) h1').click();
  await page.keyboard.press('Space');
  await expect(page.locator('#detectedBpm')).toHaveValue('88');
  await expect(page.locator('#count')).toHaveText('1');
  await page.locator('.app-navigation a[href="#/audiojoin"]').click();
  await expect(page.locator('.tool-view:not([hidden]) .file-name')).toHaveText(['merge.wav']);
  await page.locator('.app-navigation a[href="#/bpmcalc"]').click();
  await expect(page.locator('#tapBpm')).toHaveText('继续打拍…');
});

test('analysis continues after switching tools and does not change the active title or focus', async ({ page }) => {
  await page.addInitScript(() => {
    const original = OfflineAudioContext.prototype.decodeAudioData;
    OfflineAudioContext.prototype.decodeAudioData = async function (...args) { await new Promise(resolve => setTimeout(resolve, 800)); return original.apply(this, args); };
  });
  await page.goto('/#/cashier');
  await page.locator('#leftFileInput').setInputFiles(upload('background.wav', tone(3).bytes));
  await expect(page.locator('#leftFileInputDropzone')).toHaveAttribute('aria-busy', 'true');
  await page.locator('.app-navigation a[href="#/bpmcalc"]').click();
  await page.locator('#detectedBpm').fill('135');
  await page.locator('#detectedBpm').focus();
  await expect(page.locator('#leftInput')).toHaveValue('0:03.00');
  await expect(page.locator('#detectedBpm')).toBeFocused();
  await expect(page).toHaveTitle('BPM 错误修正工具 · Music Tools');
  await page.locator('.app-navigation a[href="#/cashier"]').click();
  await expect(page.locator('#leftInput')).toHaveValue('0:03.00');
  await expect(page.locator('#leftFileList .file-name')).toHaveText(['background.wav']);
});

test('legacy addresses redirect into the SPA and direct hash links refresh correctly', async ({ page }) => {
  for (const tool of ['audiojoin', 'bpmcalc', 'cashier']) {
    await page.goto(`/${tool}/index.html`);
    await expect(page.locator('.app-navigation [aria-current="page"]')).toHaveAttribute('href', `#/${tool}`);
    expect(new URL(page.url()).pathname).toBe('/index.html');
    expect(new URL(page.url()).hash).toBe(`#/${tool}`);
    await page.reload();
    await expect(page.locator('.app-navigation [aria-current="page"]')).toHaveAttribute('href', `#/${tool}`);
  }
});
