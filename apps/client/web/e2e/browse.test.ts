import { expect, serverHtml, test } from '../../../../tests/playwright/fixtures';
import { videoCard } from './video-card';

test.describe('browse', () => {
  test('the server renders the home page', async ({ page }) => {
    expect(await serverHtml(page, '/')).toContain('Trending now');
  });

  test('a card on the home feed opens the watch page', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    await page.goto('/');
    await videoCard(page, watchable.id).first().click();

    await expect(page).toHaveURL(`/watch/${watchable.id}`);
    await expect(page.getByRole('heading', { name: watchable.title })).toBeVisible();
  });

  test('the server renders the trending cards, and the browser does not ask for them again', async ({
    page,
    stack,
  }) => {
    const { watchable } = stack.videos;
    const feedRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname !== '/v1/feed') {
        return;
      }

      feedRequests.push(request.url());
    });

    await page.goto('/feed/trending');

    await expect(page.getByRole('heading', { name: 'Trending' })).toBeVisible();
    await expect(videoCard(page, watchable.id)).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(feedRequests).toEqual([]);
  });

  test('/trending moves to /feed/trending', async ({ page }) => {
    await page.goto('/trending');

    await expect(page).toHaveURL('/feed/trending');
  });
});
