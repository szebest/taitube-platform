import { expect, serverHtml, test } from './fixtures';

test.describe('browse', () => {
  test('the server renders the home page', async ({ page }) => {
    expect(await serverHtml(page, '/')).toContain('All videos:');
  });

  test('a card on the home feed opens the watch page', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    await page.goto('/');
    await page.getByRole('link', { name: watchable.title }).click();

    await expect(page).toHaveURL(`/watch/${watchable.id}`);
    await expect(page.getByRole('heading', { name: watchable.title })).toBeVisible();
  });
});
