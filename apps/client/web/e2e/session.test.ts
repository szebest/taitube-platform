import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('one session for both apps', () => {
  test('signed in on web is signed in on the studio, and signing out of the studio signs out of both', async ({
    page,
    context,
    signIn,
    alongsideUrl,
  }) => {
    await signIn('creator');

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();

    await page.goto(`${alongsideUrl}/upload`);
    await expect(page.getByLabel('Video title')).toBeVisible();
    expect((await context.cookies()).find(({ name }) => name === 'vp.session')?.httpOnly).toBe(
      true
    );

    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(`${alongsideUrl}/login?redirect=%2Fupload`);

    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account' })).toHaveCount(0);
    expect((await context.cookies()).map(({ name }) => name)).not.toContain('vp.session');
  });

  test('a guest on a members-only page of either app signs in on that app', async ({
    page,
    alongsideUrl,
  }) => {
    await page.goto('/subscriptions');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsubscriptions$/);

    await page.goto(`${alongsideUrl}/upload`);
    await expect(page).toHaveURL(`${alongsideUrl}/login?redirect=%2Fupload`);
    await expect(page.getByText('No sign-in provider is configured for this build.')).toBeVisible();
  });
});
