import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeClickPath } from '../../../../../scripts/perf-clicks/summarize-click-path';
import { expect, test } from '../../../../../tests/playwright/fixtures';
import { observePageHealth, readPageHealth } from '../../../../../tests/playwright/page-health';
import { videoCard } from '../video-card';

const QUERY = 'launch';
const KEYSTROKE_DELAY_MS = 120;

test('the click path home, video, back, search, sidebar and theme', async ({
  page,
  signIn,
  stack,
}, testInfo) => {
  await signIn('viewer');
  await page.setViewportSize({ width: 1280, height: 800 });
  await observePageHealth(page);

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() =>
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => undefined,
      })
    )
  );
  await expect(page.getByRole('status').filter({ hasText: 'Install' })).toBeVisible();
  await videoCard(page, stack.videos.watchable.id).click();
  await expect(page).toHaveURL(/\/watch\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  await page.keyboard.press('/');
  const palette = page.locator('[data-slot="command-palette"]');
  await expect(palette).toBeVisible();
  await page.keyboard.type(QUERY, { delay: KEYSTROKE_DELAY_MS });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(palette).toHaveCount(0);

  await page.getByRole('link', { name: 'Shorts' }).first().click();
  await expect(page).toHaveURL(/\/shorts/);
  await page.getByRole('link', { name: 'Home' }).first().click();

  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('menuitemradio', { name: 'Nocturne' }).click();
  await page.waitForLoadState('networkidle');

  const summary = summarizeClickPath(await readPageHealth(page));
  const label = process.env['PERF_LABEL'];
  if (label) {
    const out = process.env['PERF_OUT'] ?? join(process.cwd(), '..', '..', '..', '.perf');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, `${label}.json`), `${JSON.stringify(summary, null, 2)}\n`);
  }
  testInfo.annotations.push({ type: 'click-path', description: JSON.stringify(summary) });
});
