import { expect, type Page, test } from '../../../../tests/playwright/fixtures';

const STREAM_ID = '0190c3a0-5e1d-7000-8000-00000000e101';
const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000e102';

const stream = {
  id: STREAM_ID,
  status: 'LIVE',
  title: 'E2E broadcast',
  description: '',
  channel: {
    id: '0190c3a0-5e1d-7000-8000-00000000c001',
    handle: 'marta',
    displayName: 'Marta',
    avatarUrl: null,
  },
  videoId: VIDEO_ID,
  startedAt: '2026-11-05T10:00:00.000Z',
  endedAt: null,
  viewers: 3,
  playbackUrl: `http://localhost:9/live/${STREAM_ID}/master.m3u8`,
  chat: { slowModeSeconds: 0, subscribersOnly: false },
};

const ALLOW_ANY_ORIGIN = { 'access-control-allow-origin': '*' };

/**
 * One broadcast live in this browser: the Live now list, the stream, its video's event stream
 * counting seven viewers and its chat socket, which says hello and replays one line. The stack has
 * no ingest gateway, so nothing else could go live.
 */
async function serveBroadcast(page: Page) {
  await page.route(/\/v1\/live(\?|$)/, (route) =>
    route.fulfill({ json: { items: [stream] }, headers: ALLOW_ANY_ORIGIN })
  );
  await page.route(new RegExp(`/v1/live/${STREAM_ID}$`), (route) =>
    route.fulfill({ json: stream, headers: ALLOW_ANY_ORIGIN })
  );
  await page.route(new RegExp(`/v1/videos/${VIDEO_ID}/events`), (route) =>
    route.fulfill({
      headers: { 'content-type': 'text/event-stream' },
      body: `event: live.viewers\ndata: ${JSON.stringify({ liveStreamId: STREAM_ID, viewers: 7 })}\n\n`,
    })
  );
  await page.route(/\/live\/.*\.m3u8$/, (route) => route.fulfill({ status: 404 }));
  await page.routeWebSocket(/\/v1\/live\/[^/]+\/chat/, (socket) => {
    socket.send(
      JSON.stringify({
        type: 'hello',
        resume: 'fresh',
        mode: stream.chat,
        canSend: false,
        canModerate: false,
      })
    );
    socket.send(
      JSON.stringify({
        type: 'message',
        message: {
          id: '0190c3a0-5e1d-7000-8000-00000000e1a1',
          author: { userId: stream.channel.id, handle: 'ines', displayName: 'Ines', avatarUrl: null },
          message: 'Hello from the chat',
          offsetMs: 1000,
          createdAt: '2026-11-05T10:00:01.000Z',
        },
      })
    );
  });
}

test.describe('live', () => {
  test('the Live now shelf opens a broadcast, with its live badge, viewer count and chat', async ({
    page,
  }) => {
    await serveBroadcast(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await page.getByRole('link', { name: 'E2E broadcast' }).click();
    await page.waitForURL(`/live/${STREAM_ID}`);

    await expect(page.getByRole('heading', { level: 1, name: 'E2E broadcast' })).toBeVisible();
    await expect(page.getByText('7 watching')).toBeVisible();
    const chat = page.getByRole('region', { name: 'Live chat' });
    await expect(chat.getByText('Hello from the chat')).toBeVisible();
    await expect(chat.getByRole('link', { name: 'Sign in to chat' })).toBeVisible();
  });

  test('a broadcast that does not exist is not found', async ({ page }) => {
    const response = await page.goto('/live/0190c3a0-5e1d-7000-8000-00000000e1ff');

    expect(response?.status()).toBe(404);
  });
});
