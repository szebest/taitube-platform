import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('a guest is asked to sign in in place, never sent to /login by an action', () => {
  test.beforeEach(async ({ page, stack }) => {
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
  });

  for (const { control, reason } of [
    { control: /^Like/, reason: 'Sign in to like this' },
    { control: /^Subscribe$/, reason: 'Sign in to subscribe to this channel' },
  ]) {
    test(`${reason}`, async ({ page }) => {
      const watchUrl = new URL(page.url()).pathname;

      await page.getByRole('button', { name: control }).first().click();

      const dialog = page.getByRole('dialog', { name: reason });
      await expect(dialog).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(watchUrl);

      await dialog.getByRole('button', { name: 'Not now' }).click();
      await expect(dialog).toBeHidden();
    });
  }

  test('commenting and saving ask for an account too', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).last().click();
    await expect(page.getByRole('dialog', { name: 'Sign in to comment' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in to save this video' })).toBeVisible();
  });

  test('the Sign in button of the prompt leads to /login and back to the same page', async ({
    page,
  }) => {
    const watchUrl = new URL(page.url()).pathname;
    await page.getByRole('button', { name: /^Like/ }).first().click();

    await page.getByRole('dialog').getByRole('link', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(
      new RegExp(`/login\\?redirect=${encodeURIComponent(watchUrl).replaceAll('.', '\\.')}`)
    );
  });
});
