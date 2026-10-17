import type { Page } from '@playwright/test';
import { expect, test } from '../../../../tests/playwright/fixtures';
import { videoCard } from './video-card';

/** The tracer wraps `window.fetch` once both telemetry chunks have loaded after hydration. */
const openWithTelemetry = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !String(window.fetch).includes('[native code]'));
};

test.describe('web telemetry', () => {
  test('a hidden page beacons one batch of its vitals, tagged with the route id', async ({
    page,
  }) => {
    await openWithTelemetry(page);

    const beacon = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/v1/telemetry/vitals')
    );
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const batch = (await beacon).postDataJSON();
    expect(batch.app).toBe('web');
    expect(batch.vitals.map(({ name }: { name: string }) => name)).toEqual(
      expect.arrayContaining(['TTFB', 'FCP'])
    );
    expect(new Set(batch.vitals.map(({ route }: { route: string }) => route))).toEqual(
      new Set(['/'])
    );
  });

  test('a fetch to the API carries traceparent', async ({ page, stack }) => {
    await openWithTelemetry(page);

    const videoRead = page.waitForRequest((request) =>
      request.url().includes(`/v1/videos/${stack.videos.watchable.id}`)
    );
    await videoCard(page, stack.videos.watchable.id).click();

    expect((await videoRead).headers().traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });
});
