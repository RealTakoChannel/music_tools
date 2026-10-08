const { test, expect } = require('@playwright/test');
const api = 'https://api.github.com/repos/RealTakoChannel/music_tools';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.__runtimeErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.__runtimeErrors).toEqual([]); });

test('Star badge refreshes count, throttles focus, preserves state and fits narrow screens', async ({ page }) => {
  let calls = 0, count = 1234;
  await page.route(api, route => { calls++; return route.fulfill({ json: { stargazers_count: count } }); });
  await page.clock.install();
  await page.goto('/');
  const badge = page.locator('.github-star');
  await expect(badge.locator('[data-star-count]')).toHaveText('1,234');
  await expect(badge).toHaveAttribute('href', 'https://github.com/RealTakoChannel/music_tools');
  await expect(badge).toHaveAttribute('target', '_blank');
  const initialCalls = calls;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(calls).toBe(initialCalls);
  count = 1235;
  await page.clock.fastForward(60_100);
  await expect(badge.locator('[data-star-count]')).toHaveText('1,235');
  expect(calls).toBe(initialCalls + 1);
  await page.locator('[data-language="en"]').click();
  await expect(badge).toHaveAttribute('aria-label', 'Star on GitHub, currently 1235 stars');
  await page.locator('.app-navigation a[href="#/cashier"]').click();
  await expect(badge.locator('[data-star-count]')).toHaveText('1,235');
  expect(calls).toBe(initialCalls + 1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(badge).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'tmp/react-qa/github-star-mobile.png', fullPage: true, animations: 'disabled' });
});

test('Star failure uses a dash, recovers, preserves last count and respects rate limits', async ({ page }) => {
  let calls = 0, available = false;
  await page.route(api, route => {
    calls++;
    return available
      ? route.fulfill({ json: { stargazers_count: 0 } })
      : route.fulfill({ status: 429, headers: { 'retry-after': '600' }, json: { message: 'Rate limited' } });
  });
  await page.clock.install();
  await page.goto('/');
  const badge = page.locator('.github-star');
  await expect(badge).toHaveAttribute('data-status', 'unavailable');
  await expect(badge.locator('[data-star-count]')).toHaveText('—');
  const initialCalls = calls;
  await page.clock.fastForward(60_100);
  expect(calls).toBe(initialCalls);
  available = true;
  await page.clock.fastForward(540_000);
  await expect(badge.locator('[data-star-count]')).toHaveText('0');
  available = false;
  await page.clock.fastForward(60_100);
  await expect(badge).toHaveAttribute('data-status', 'stale');
  await expect(badge.locator('[data-star-count]')).toHaveText('0');
  const lastCalls = calls;
  await page.clock.fastForward(300_000);
  expect(calls).toBe(lastCalls);
});

test('Star polling pauses while hidden and resumes when the page becomes visible', async ({ page }) => {
  let calls = 0, count = 1;
  await page.route(api, route => { calls++; return route.fulfill({ json: { stargazers_count: count } }); });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('[data-star-count]')).toHaveText('1');
  const initialCalls = calls;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(180_000);
  expect(calls).toBe(initialCalls);
  count = 2;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-star-count]')).toHaveText('2');
});
