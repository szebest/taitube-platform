import { expect, serverHtml, test } from '../../../../tests/playwright/fixtures';

test.describe('watch', () => {
  test('the server renders the watch page of a READY video', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    const html = await serverHtml(page, `/watch/${watchable.id}`);

    expect(html).toContain(`<title>${watchable.title}</title>`);
    expect(html).toContain(`>${watchable.title}</h4>`);
  });

  test('the watch page keeps the video once it hydrates', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    await page.goto(`/watch/${watchable.id}`);

    await expect(page).toHaveTitle(watchable.title);
    await expect(page.getByRole('heading', { name: watchable.title })).toBeVisible();
  });

  test('the video element plays the HLS master of a READY video', async ({ page, stack }) => {
    const master = page.waitForResponse((response) => response.url().endsWith('/master.m3u8'));
    await page.goto(`/watch/${stack.videos.watchable.id}`);

    await page.getByRole('button', { name: 'Play', exact: true }).first().click();

    expect((await master).ok()).toBe(true);
    await expect
      .poll(() =>
        page.locator('video').evaluate((element: HTMLVideoElement) => ({
          paused: element.paused,
          moved: element.currentTime > 0,
        }))
      )
      .toEqual({ paused: false, moved: true });
  });
});
