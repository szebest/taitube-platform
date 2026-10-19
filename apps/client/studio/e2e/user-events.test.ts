import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { FIXTURE_VIDEO, expect, test } from '../../../../tests/playwright/fixtures';

const READY_TIMEOUT_MS = 120_000;
const USER_EVENTS_PATH = '/api/v1/me/events';

type StartedUpload = { videoId: string; uploadId: string; singleUrl: string };

test.describe('user events', () => {
  test.setTimeout(READY_TIMEOUT_MS + 30_000);

  test('a processing upload updates two open studio tabs over one connection', async ({
    context,
    page,
    signIn,
    api,
  }) => {
    await signIn('creator');
    const creator = await api('creator');
    const started = await creator.post('/v1/uploads', {
      data: {
        filename: basename(FIXTURE_VIDEO),
        sizeBytes: (await stat(FIXTURE_VIDEO)).size,
        contentType: 'video/mp4',
        strategy: 'single',
        title: 'E2E two tabs',
        visibility: 'private',
      },
    });
    const upload = (await started.json()) as StartedUpload;

    const streams: string[] = [];
    context.on('request', (request) => {
      if (new URL(request.url()).pathname === USER_EVENTS_PATH) streams.push(request.url());
    });
    const streamOpened = context.waitForEvent('response', (response) =>
      response.url().includes(USER_EVENTS_PATH)
    );
    const tabs = [page, await context.newPage()];
    for (const tab of tabs) {
      await tab.goto(`/upload/edit/${upload.videoId}`);
      await expect(tab.getByRole('status')).toHaveText('Uploading, 0% encoded');
    }
    expect((await streamOpened).headers()['content-type']).toContain('text/event-stream');

    const storage = await api();
    await storage.put(upload.singleUrl, {
      headers: { 'content-type': 'video/mp4' },
      data: await readFile(FIXTURE_VIDEO),
    });
    await creator.post(`/v1/uploads/${upload.uploadId}/complete`, { data: {} });

    for (const tab of tabs) {
      await expect(tab.getByRole('status')).toHaveText(/^Ready, \d+% encoded$/, {
        timeout: READY_TIMEOUT_MS,
      });
    }
    expect(streams).toHaveLength(1);
  });
});
