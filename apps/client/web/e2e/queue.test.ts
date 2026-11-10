import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('the queue: add, undo, reorder with the keyboard, play next', () => {
  test('adds a card to the queue with an Undo, and takes it out again', async ({
    page,
    signIn,
    stack,
  }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    const queue = page.getByRole('region', { name: 'Your queue' });
    const before = await queue.getByRole('listitem').count();

    await page
      .getByRole('region', { name: 'More like this' })
      .getByRole('button', { name: 'Add to queue' })
      .first()
      .click();

    await expect(page.getByText('Added to your queue')).toBeVisible();
    await expect(queue.getByRole('listitem')).toHaveCount(before + 1);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(queue.getByRole('listitem')).toHaveCount(before);
  });

  test('reorders with the keyboard: Space, an arrow, Space', async ({ page, signIn, stack }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    const more = page.getByRole('region', { name: 'More like this' });
    for (let added = 0; added < 2; added += 1) {
      await more.getByRole('button', { name: 'Add to queue' }).nth(added).click();
    }
    const items = page.getByRole('region', { name: 'Your queue' }).getByRole('listitem');
    const first = await items.nth(1).getAttribute('aria-label');

    await items
      .nth(1)
      .getByRole('button', { name: /reorder|drag/i })
      .focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    await expect(items.nth(2)).toHaveAttribute('aria-label', first ?? '');
  });

  test('plays a video next from its card menu', async ({ page, signIn, stack }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    const more = page.getByRole('region', { name: 'More like this' });

    await more.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Play next' }).click();

    await expect(page.getByText('Playing next')).toBeVisible();
    const items = page.getByRole('region', { name: 'Your queue' }).getByRole('listitem');
    await expect(items.nth(1)).toBeVisible();
  });
});
