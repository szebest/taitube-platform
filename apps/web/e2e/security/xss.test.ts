import { type Page, expect, serverHtml, test, videoCard } from '../fixtures';
import { XSS_PAYLOADS } from './xss-payloads';

async function expectNothingRan(page: Page): Promise<void> {
  expect(await page.evaluate(() => Reflect.get(window, '__xss'))).toBeUndefined();
  await expect(page.locator('a[href^="javascript:"], img[src="x"], svg[onload]')).toHaveCount(0);
}

test.describe('hostile titles and descriptions render as text', () => {
  test('no payload reaches the server HTML of the watch page as markup', async ({
    page,
    stack,
  }) => {
    const html = await serverHtml(page, `/watch/${stack.videos.canvas.id}`);

    for (const { kind, live } of XSS_PAYLOADS) expect(html, kind).not.toContain(live);
  });

  test('every payload reads as text in the title and description on the watch page', async ({
    page,
    stack,
  }) => {
    const { canvas } = stack.videos;

    await page.goto(`/watch/${canvas.id}`);

    await expect(page).toHaveTitle(canvas.title);
    for (const { kind, payload } of XSS_PAYLOADS) {
      await test.step(kind, async () => {
        await expect(page.getByRole('heading', { name: payload })).toBeVisible();
        await expect(page.getByText(payload)).toHaveCount(2);
      });
    }
    await expectNothingRan(page);
  });

  test('every payload reads as text on the home feed card', async ({ page, stack }) => {
    const card = videoCard(page, stack.videos.canvas.id);

    await page.goto('/');

    for (const { kind, payload } of XSS_PAYLOADS) {
      await test.step(kind, () => expect(card).toContainText(payload));
    }
    await expectNothingRan(page);
  });
});
