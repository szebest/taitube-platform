import { expect, serverHtml, test } from '../../../../../tests/playwright/fixtures';
import { expectNothingRan } from '../../../../../tests/playwright/security/xss';
import { XSS_PAYLOADS } from '../../../../../tests/playwright/xss-payloads';
import { videoCard } from '../video-card';

test.describe('hostile titles and descriptions render as text', () => {
  test('no payload reaches the server HTML of the watch page as markup', async ({
    page,
    stack,
  }) => {
    const html = await serverHtml(page, `/watch/${stack.videos.canvas.id}`);

    for (const { kind, live } of XSS_PAYLOADS) expect(html, kind).not.toContain(live);
  });

  test('every payload reads as text in the title, the queue row and the description on the watch page', async ({
    page,
    stack,
  }) => {
    const { canvas } = stack.videos;

    await page.goto(`/watch/${canvas.id}`);

    await expect(page).toHaveTitle(canvas.title);
    for (const { kind, payload } of XSS_PAYLOADS) {
      await test.step(kind, async () => {
        await expect(page.getByRole('heading', { name: payload })).toBeVisible();
        await expect(page.getByText(payload)).toHaveCount(3);
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
