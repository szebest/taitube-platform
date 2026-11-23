import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('the studio across several accounts', () => {
  test('switching on a video of a channel the new account cannot see lands on a page it can', async ({
    page,
    stack,
    signInSlots,
  }) => {
    const [, viewer = ''] = await signInSlots(['creator', 'viewer']);
    await page.goto(`/u/0/videos/${stack.videos.draft.id}/edit`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitemradio', { name: new RegExp(viewer) }).click();

    await expect(page).toHaveURL(/\/u\/1\/videos(\?|$)/);
    await expect(
      page
        .locator('[aria-live="polite"][data-slot="visually-hidden"]')
        .filter({ hasText: `Now browsing as ${viewer}` })
    ).toBeAttached();
  });

  test('opening the studio for a channel acts as the account that owns it', async ({
    page,
    api,
    signInSlots,
  }) => {
    await signInSlots(['viewer', 'creator']);
    const creator = await (await (await api('creator')).get('/v1/me/account')).json();

    await page.goto(`/for/${creator.channel.handle}?next=/videos`);

    await expect(page).toHaveURL(/\/u\/1\/videos(\?|$)/);
    await expect(page.getByRole('heading', { name: 'Your videos' })).toBeVisible();
  });

  test('the way back to web keeps the tab on its account', async ({ page, signInSlots }) => {
    await signInSlots(['creator', 'viewer']);
    await page.goto('/u/1/videos');

    await expect(page.getByRole('link', { name: 'Back to Taitube' })).toHaveAttribute(
      'href',
      /\/u\/1$/
    );
  });
});
