import { expect, serverHtml, test } from '../../../../../tests/playwright/fixtures';
import { expectNothingRan } from '../../../../../tests/playwright/security/xss';
import {
  HOSTILE_CHANNEL_NAMES,
  HOSTILE_TEXT,
  XSS_PAYLOADS,
} from '../../../../../tests/playwright/xss-payloads';
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
        await expect(
          page.getByRole('list', { name: 'Your queue' }).getByRole('listitem')
        ).toContainText(payload);
        await expect(page.locator('[data-slot="liner-notes-body"]')).toContainText(payload);
      });
    }
    await expectNothingRan(page);
  });

  test('the comment, its author and the channel name read as text on the watch page', async ({
    page,
    stack,
  }) => {
    await page.goto(`/watch/${stack.videos.canvas.id}`);

    const comment = page.locator('[data-slot="comment-item"]');
    await expect(comment.locator('[data-slot="comment-item-body"]')).toContainText(HOSTILE_TEXT);
    await expect(comment.locator('[data-slot="comment-item-author"]')).toContainText(
      HOSTILE_CHANNEL_NAMES.viewer
    );
    await expect(page.locator('a[href^="/channel/"]').first()).toContainText(
      HOSTILE_CHANNEL_NAMES.creator
    );
    await expectNothingRan(page);
  });

  test('every payload reads as text on the home feed card', async ({ page, stack }) => {
    const card = videoCard(page, stack.videos.canvas.id).first();

    await page.goto('/');

    for (const { kind, payload } of XSS_PAYLOADS) {
      await test.step(kind, () => expect(card).toContainText(payload));
    }
    await expectNothingRan(page);
  });
});
