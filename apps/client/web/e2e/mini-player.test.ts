import type { Page } from '@playwright/test';
import { expect, test } from '../../../../tests/playwright/fixtures';

const oneVideo = (page: Page) => page.locator('video');

test.describe('the mini player follows the viewer, on one player that never moves', () => {
  test('keeps playing across a route change, with one video element, and docks back without restarting', async ({
    page,
    signIn,
    stack,
  }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    await expect(oneVideo(page)).toHaveCount(1);
    const host = page.locator('[data-slot=playback-host]');
    await expect(host).toHaveAttribute('data-state', 'docked');
    await page.getByRole('button', { name: 'Play', exact: true }).first().click();
    await expect
      .poll(() => oneVideo(page).evaluate((video: HTMLVideoElement) => video.paused))
      .toBe(false);
    await oneVideo(page).evaluate((video) => {
      (video as HTMLVideoElement & { marker?: string }).marker = 'same';
    });

    for (const link of ['Home', 'Trending', 'Subscriptions']) {
      await page.getByRole('link', { name: link, exact: true }).first().click();
      await expect(page.getByRole('region', { name: 'Now playing' })).toBeVisible();
      await expect(oneVideo(page)).toHaveCount(1);
      await expect(host).toHaveAttribute('data-state', 'mini');
      expect(
        await oneVideo(page).evaluate(
          (video) => (video as HTMLVideoElement & { marker?: string }).marker
        )
      ).toBe('same');
    }

    await expect
      .poll(() => oneVideo(page).evaluate((video: HTMLVideoElement) => video.paused))
      .toBe(false);
  });

  test('expands from the mini player to the page, docking the same host', async ({
    page,
    signIn,
    stack,
  }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Home' }).first().click();
    const bar = page.getByRole('region', { name: 'Now playing' });
    await expect(bar).toBeVisible();

    await bar.getByRole('link', { name: 'Back to the video' }).click();

    await expect(page).toHaveURL(new RegExp(`/watch/${stack.videos.watchable.id}`));
    await expect(page.locator('[data-slot=playback-host]')).toHaveAttribute('data-state', 'docked');
    await expect(oneVideo(page)).toHaveCount(1);
  });

  test('clears the tab bar at 375 px and sits on the pip layer', async ({
    page,
    signIn,
    stack,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Home' }).first().click();
    const host = page.locator('[data-slot=playback-host]');
    await expect(host).toHaveAttribute('data-state', 'mini');

    const box = await host.boundingBox();
    const tabBar = await page.getByRole('navigation', { name: 'Main' }).last().boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(tabBar?.y ?? 0);
    expect(await host.evaluate((element) => getComputedStyle(element).zIndex)).toBe('35');
  });
});
