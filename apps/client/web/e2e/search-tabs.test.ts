import { expect, test } from '../../../../tests/playwright/fixtures';

const SLOW_MS = 2500;
const TYPES = ['All', 'Videos', 'Channels', 'Playlists'];

test.describe('the search result tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/v1/search?*', async (route) => {
      if (new URL(route.request().url()).searchParams.get('type') !== 'channel') {
        return route.continue();
      }
      await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      return route.continue();
    });
  });

  test('stay mounted, clickable and counted while another tab loads', async ({ page }) => {
    await page.goto('/search?q=launch', { waitUntil: 'networkidle' });
    const tabs = page.getByRole('radiogroup');

    for (const name of TYPES) {
      await expect(page.getByRole('radio', { name: new RegExp(`^${name} \\d`) })).toBeVisible();
    }

    await page.getByRole('radio', { name: /^Channels/ }).click();
    await page.waitForTimeout(1500);

    await expect(tabs).toBeVisible();
    const box = await page.getByRole('radio', { name: /^Videos/ }).boundingBox();
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[role=radio]')?.textContent ?? '',
      { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 }
    );
    expect(hit, 'the pointer lands on the Videos tab during the load').toMatch(/^Videos/);

    await page.getByRole('radio', { name: /^Videos/ }).click();
    await expect(page.getByRole('radio', { name: /^Videos/ })).toBeChecked();
    for (const name of TYPES) {
      await expect(page.getByRole('radio', { name: new RegExp(`^${name} \\d`) })).toBeVisible();
    }
  });
});
