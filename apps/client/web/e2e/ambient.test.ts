import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('the ambient glow', () => {
  test('is a page layer sized from the stage that passes under the sticky header', async ({
    page,
    signIn,
    stack,
  }) => {
    await signIn('viewer');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });

    const glow = page.locator('[data-slot="ambient-stage"] > div');
    await expect(glow).toBeVisible();
    const stage = await page.locator('[data-slot="stage"]').boundingBox();
    const bounds = await glow.boundingBox();
    const header = await page.locator('header').boundingBox();
    expect(bounds?.width).toBeGreaterThan((stage?.width ?? 0) * 1.4);
    expect(bounds?.y).toBeLessThan((header?.y ?? 0) + (header?.height ?? 0));

    const zIndex = await page
      .locator('[data-slot="ambient-layer"]')
      .evaluate((layer) => getComputedStyle(layer).zIndex);
    expect(zIndex).toBe('-1');
  });

  test('is gone with data-ambient off', async ({ page, signIn, stack }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-slot="ambient-stage"]')).toBeVisible();

    await page.evaluate(() => document.documentElement.setAttribute('data-ambient', 'off'));

    await expect(page.locator('[data-slot="ambient-stage"]')).toHaveCount(0);
  });
});
