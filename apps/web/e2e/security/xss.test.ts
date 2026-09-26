import { type Page, expect, serverHtml, test } from '../fixtures';
import { HOSTILE_TEXT, XSS_PAYLOADS } from './xss-payloads';

async function expectNothingRan(page: Page): Promise<void> {
  expect(await page.evaluate(() => Reflect.get(window, '__xss'))).toBeUndefined();
  await expect(page.locator('a[href^="javascript:"], img[src="x"], svg[onload]')).toHaveCount(0);
}

test.describe('hostile titles and descriptions render as text', () => {
  for (const { kind, payload, live } of XSS_PAYLOADS) {
    test(`${kind} stays out of the server HTML of the watch page`, async ({ page, stack }) => {
      const html = await serverHtml(page, `/watch/${stack.videos.canvas.id}`);

      expect(html).not.toContain(live);
    });

    test(`${kind} renders as text in the title and description on the watch page`, async ({
      page,
      stack,
    }) => {
      await page.goto(`/watch/${stack.videos.canvas.id}`);

      await expect(page).toHaveTitle(HOSTILE_TEXT);
      await expect(page.getByRole('heading', { name: payload })).toBeVisible();
      await expect(page.getByText(payload).last()).toBeVisible();
      await expectNothingRan(page);
    });

    test(`${kind} renders as text on its home feed card`, async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('link', { name: payload })).toBeVisible();
      await expectNothingRan(page);
    });
  }
});
