import { expect, type Page, test } from '../../../../tests/playwright/fixtures';

const SYNC_TAG = 'workbox-background-sync:taitube-sync-v1';
const MEDIA_CACHE = 'taitube-media-v1';
const API_CACHE = 'taitube-api-v1';

async function controlledAt(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

function cachedUrls(page: Page, cacheName: string) {
  return page.evaluate(
    async (name) => (await (await caches.open(name)).keys()).map(({ url }) => url),
    cacheName
  );
}

test.describe('pwa: installability', () => {
  test('links a manifest that names the app, its standalone mode and a PNG icon set', async ({
    page,
  }) => {
    await controlledAt(page, '/');

    const href = await page
      .locator('link[rel="manifest"]')
      .evaluate((link) => (link as HTMLLinkElement).href);
    const response = await page.request.get(href);
    const manifest = await response.json();

    expect(manifest).toMatchObject({
      name: 'Taitube',
      start_url: '/',
      display: 'standalone',
      scope: '/',
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', type: 'image/png', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
      ])
    );
    for (const { src } of manifest.icons) {
      const icon = await page.request.get(src);
      expect(icon.headers()['content-type'], src).toBe('image/png');
    }
  });

  test('registers a service worker that controls the page and holds the offline page', async ({
    page,
  }) => {
    await controlledAt(page, '/');

    expect(
      await page.evaluate(() => caches.match('/offline/', { ignoreSearch: true }).then(Boolean))
    ).toBe(true);
  });
});

test.describe('pwa: offline', () => {
  test('shows OfflineState for a page that was never cached', async ({ page, context }) => {
    await controlledAt(page, '/');

    await context.setOffline(true);
    await page.goto('/not-visited-before');

    await expect(page).toHaveURL(/\/offline\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'You are offline' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Home' })).toBeVisible();
  });

  test('serves a poster the viewer already saw from the cache with no network', async ({
    page,
    context,
  }) => {
    await controlledAt(page, '/');
    const poster = await page
      .locator('img[src$="/thumbs/poster.jpg"]')
      .first()
      .evaluate((image) => (image as HTMLImageElement).src);
    await expect.poll(() => cachedUrls(page, MEDIA_CACHE)).toContain(poster);

    await context.setOffline(true);
    const served = await page.evaluate(
      (url) =>
        fetch(url, { mode: 'no-cors', cache: 'reload' }).then(
          ({ type }) => type,
          () => 'network error'
        ),
      poster
    );

    expect(['cors', 'opaque']).toContain(served);
  });

  test('falls back to the cached feed response when the network is gone', async ({
    page,
    context,
  }) => {
    await controlledAt(page, '/');
    const feedRequest = page.waitForRequest((request) => request.url().includes('/api/v1/feed?'));
    await page.getByRole('link', { name: 'Trending' }).first().click();
    const url = (await feedRequest).url();
    await expect
      .poll(async () => (await cachedUrls(page, API_CACHE)).some((cached) => cached === url))
      .toBe(true);

    await context.setOffline(true);
    const status = await page.evaluate((feed) => fetch(feed).then(({ status }) => status), url);

    expect(status).toBe(200);
  });

  test('announces the drop with a toast and takes it back on reconnection', async ({
    page,
    context,
  }) => {
    await controlledAt(page, '/');
    const toast = page.locator('[data-slot="toast"]', { hasText: 'You are offline' });

    await context.setOffline(true);
    await expect(toast).toBeVisible();

    await context.setOffline(false);
    await expect(toast).toBeHidden();
  });
});

test.describe('pwa: background sync', () => {
  test('queues a reaction made offline and delivers it once the sync event fires', async ({
    page,
    context,
    signIn,
    stack,
    api,
  }) => {
    const { canvas } = stack.videos;
    await signIn('viewer');
    await controlledAt(page, `/watch/${canvas.id}`);
    const cdp = await context.newCDPSession(page);
    const registration = new Promise<string>((resolve) => {
      cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
        const [first] = registrations;
        if (first) resolve(first.registrationId);
      });
    });
    await cdp.send('ServiceWorker.enable');
    const like = page.getByRole('toolbar', { name: 'Video actions' }).getByRole('button', {
      name: /^Like/,
    });

    await context.setOffline(true);
    await like.click();

    await expect(page.locator('[data-slot="offline-state-description"]')).toHaveText(
      '1 change will sync when the connection returns.'
    );

    await context.setOffline(false);
    await cdp.send('ServiceWorker.dispatchSyncEvent', {
      origin: new URL(page.url()).origin,
      registrationId: await registration,
      tag: SYNC_TAG,
      lastChance: false,
    });

    const viewer = await api('viewer');
    await expect
      .poll(async () => (await viewer.get(`/v1/videos/${canvas.id}/reactions/me`)).json())
      .toMatchObject({ reaction: 'LIKE' });
    await expect(like).toHaveAttribute('aria-pressed', 'true');
  });
});
