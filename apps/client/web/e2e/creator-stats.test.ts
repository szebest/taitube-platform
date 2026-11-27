import { expect, test } from '../../../../tests/playwright/fixtures';

const STATS_PATH = /\/v1\/videos\/[^/]+\/creator-stats/;

test.describe('creator stats on the watch page', () => {
  test('the owner sees the stats panel above the description', async ({ page, signIn, stack }) => {
    await signIn('creator');
    await page.goto(`/watch/${stack.videos.watchable.id}`);

    const panel = page.getByRole('region', { name: 'Creator stats' });

    await expect(panel).toBeVisible();
    await expect(panel.getByText('Only you and your team see this')).toBeVisible();
    await expect(panel.getByText('Views', { exact: true })).toBeVisible();
  });

  test('another viewer sees no panel and the page asks for no stats', async ({
    page,
    signIn,
    stack,
  }) => {
    const statsRequests: string[] = [];
    page.on('request', (request) => {
      if (STATS_PATH.test(request.url())) statsRequests.push(request.url());
    });
    await signIn('stranger');
    await page.goto(`/watch/${stack.videos.watchable.id}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('region', { name: 'Creator stats' })).toHaveCount(0);
    expect(statsRequests).toEqual([]);
  });
});
