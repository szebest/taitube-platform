import { expect, type Page, serverHtml, test } from '../../../../tests/playwright/fixtures';

const COMPACT = { width: 390, height: 844 };
const EXPANDED = { width: 1280, height: 900 };

const box = async (locator: ReturnType<Page['locator']>) => {
  const found = await locator.boundingBox();
  if (!found) throw new Error('the element has no box on the page');
  return found;
};

test.describe('watch', () => {
  test('the server renders the watch page of a READY video', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    const html = await serverHtml(page, `/watch/${watchable.id}`);

    expect(html).toContain(`<title>${watchable.title}</title>`);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${watchable.title}</h1>`));
    expect(html).toContain('data-slot="stage-poster"');
  });

  test('the watch page keeps the video once it hydrates', async ({ page, stack }) => {
    const { watchable } = stack.videos;

    await page.goto(`/watch/${watchable.id}`);

    await expect(page).toHaveTitle(watchable.title);
    await expect(page.getByRole('heading', { level: 1, name: watchable.title })).toBeVisible();
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

  test('the video keeps playing in the now playing bar and comes back to the stage, and a page with its own player silences it', async ({
    page,
    context,
    signIn,
    stack,
  }) => {
    const { clippable } = stack.videos;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signIn('viewer');
    await page.setViewportSize(EXPANDED);
    await page.goto(`/watch/${clippable.id}`);
    await page.getByRole('button', { name: 'Clip', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Clip this video' });
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Bar clip');
    await dialog.getByRole('button', { name: 'Save clip' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Play', exact: true }).first().click();
    const video = page.locator('video').first();
    await video.evaluate((element) => {
      (window as unknown as { sessionVideo: HTMLVideoElement }).sessionVideo =
        element as HTMLVideoElement;
    });
    const playhead = () => video.evaluate((element: HTMLVideoElement) => element.currentTime);
    const advancing = async () => {
      const before = await playhead();
      await expect.poll(playhead).toBeGreaterThan(before);
    };
    await advancing();

    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(page.getByRole('region', { name: 'Now playing' })).toBeVisible();
    await advancing();

    await page.getByRole('link', { name: 'Back to the video' }).click();
    await expect(page.getByRole('region', { name: 'Video player' })).toBeVisible();
    expect(
      await video.evaluate(
        (element) =>
          element === (window as unknown as { sessionVideo: HTMLVideoElement }).sessionVideo
      )
    ).toBe(true);
    await advancing();

    await page.setViewportSize(COMPACT);
    await page.getByRole('link', { name: 'You' }).first().click();
    await page.getByRole('link', { name: 'Bar clip' }).first().click();
    await expect(page).toHaveURL(/\/clip\//);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { sessionVideo: HTMLVideoElement }).sessionVideo.paused
        )
      )
      .toBe(true);
  });

  test('a member likes the video and takes the like back', async ({ page, signIn, stack }) => {
    await signIn('viewer');
    await page.goto(`/watch/${stack.videos.watchable.id}`);
    const like = page.getByRole('toolbar', { name: 'Video actions' }).getByRole('button', {
      name: /^Like/,
    });

    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');

    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'false');
  });

  test('the share dialog copies a link that starts at the playhead when asked', async ({
    page,
    stack,
  }) => {
    await page.goto(`/watch/${stack.videos.watchable.id}`);
    const seekBar = page.getByRole('slider', { name: 'Seek' });
    await expect.poll(async () => Number(await seekBar.getAttribute('max'))).toBeGreaterThan(1);
    await seekBar.fill('1');
    await expect
      .poll(() =>
        page
          .locator('video')
          .evaluate((video: HTMLVideoElement) => !video.seeking && video.currentTime >= 1)
      )
      .toBe(true);

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this video' });
    const link = dialog.getByRole('textbox', { name: 'Link' });
    await expect(link).toHaveText(new RegExp(`/watch/${stack.videos.watchable.id}$`));

    await dialog.getByRole('checkbox', { name: /^Start at/ }).check();

    await expect(link).toHaveText(new RegExp(`/watch/${stack.videos.watchable.id}\\?t=\\d+$`));
  });

  test('the queue holds the video on the stage, beside it on an expanded screen', async ({
    page,
    stack,
  }) => {
    await page.setViewportSize(EXPANDED);
    await page.goto(`/watch/${stack.videos.watchable.id}`);

    const stage = page.getByRole('region', { name: 'Video player' });
    const queue = page.getByRole('region', { name: 'Your queue' });
    await expect(queue.getByRole('list', { name: 'Your queue' }).getByRole('listitem')).toHaveCount(
      1
    );
    await expect(queue.getByText('Now playing')).toBeVisible();

    const [stageBox, queueBox] = [await box(stage), await box(queue)];
    expect(queueBox.x).toBeGreaterThanOrEqual(stageBox.x + stageBox.width);
    expect(queueBox.y).toBeLessThan(stageBox.y + stageBox.height);
  });

  test('theater mode runs the stage the full width and moves the queue below it', async ({
    page,
    stack,
  }) => {
    await page.setViewportSize(EXPANDED);
    await page.goto(`/watch/${stack.videos.watchable.id}`);
    const stage = page.getByRole('region', { name: 'Video player' });
    const queue = page.getByRole('region', { name: 'Your queue' });
    const standard = await box(stage);

    await page.locator('[data-slot=playback-host]').hover();
    await page.getByRole('button', { name: 'Theater mode' }).click();

    await expect.poll(async () => (await box(stage)).width).toBeGreaterThan(standard.width);
    const [stageBox, queueBox] = [await box(stage), await box(queue)];
    expect(queueBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height);
  });

  test('the queue opens in a drawer behind a Queue button on a compact screen', async ({
    page,
    stack,
  }) => {
    await page.setViewportSize(COMPACT);
    await page.goto(`/watch/${stack.videos.watchable.id}`);
    await expect(page.getByRole('region', { name: 'Your queue' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Queue', exact: true }).click();

    await expect(
      page.getByRole('dialog').getByRole('region', { name: 'Your queue' })
    ).toBeVisible();
  });
});
