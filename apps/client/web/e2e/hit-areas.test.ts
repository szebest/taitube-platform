import type { Page } from '@playwright/test';
import { expect, test } from '../../../../tests/playwright/fixtures';
import { deadPoints } from '../../../../tests/playwright/hit-areas';

async function creatorChannel(page: Page, creator: Awaited<ReturnType<typeof page.request.get>>) {
  const { channel } = (await creator.json()) as { channel: { id: string; displayName: string } };
  return channel;
}

test.describe('a result row, a card and a header are one link over their whole box', () => {
  test('a video result row on the search page', async ({ page, signIn, stack }) => {
    await signIn('viewer');
    await page.goto(`/search?q=${encodeURIComponent(stack.videos.watchable.title)}`, {
      waitUntil: 'networkidle',
    });

    const rows = page.locator('main ul[aria-labelledby] > li');
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      expect(await deadPoints(row)).toEqual([]);
    }
  });

  test('a card on the home feed', async ({ page, signIn }) => {
    await signIn('viewer');
    await page.goto('/', { waitUntil: 'networkidle' });

    const cards = page.locator('main li [data-slot="video-card"]');
    await expect(cards.first()).toBeVisible();
    for (const card of (await cards.all()).slice(0, 6)) {
      expect(await deadPoints(card)).toEqual([]);
    }
  });

  test('the channel header that spotlights a channel named by the search', async ({
    page,
    api,
    signIn,
  }) => {
    const creator = await api('creator');
    const channel = await creatorChannel(page, await creator.get('/v1/me/account'));
    await signIn('viewer');
    await page.goto(`/search?q=${encodeURIComponent(channel.displayName)}`, {
      waitUntil: 'networkidle',
    });

    const header = page.locator('[data-slot="channel-header"]').first();
    await expect(header).toBeVisible();
    expect(await deadPoints(header)).toEqual([]);
  });

  test('the Start here cards on a channel page', async ({ page, api, signIn, stack }) => {
    const creator = await api('creator');
    const { watchable, canvas } = stack.videos;
    await creator.put('/v1/me/channel/featured', { data: { videoIds: [watchable.id, canvas.id] } });
    const channel = await creatorChannel(page, await creator.get('/v1/me/account'));
    await signIn('viewer');
    await page.goto(`/channel/${channel.id}`, { waitUntil: 'networkidle' });

    const cards = page.getByRole('region', { name: 'Start here' }).getByRole('listitem');
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      expect(await deadPoints(card)).toEqual([]);
    }
  });
});
