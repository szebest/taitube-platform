import { VIDEO_ID, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';
import { getRouter } from '#app/router';

function renderEditor(path: string, stored = video()) {
  serveEditor(stored);
  return serverRender(getRouter, path, { handlers: [accountOf()], headers: { cookie: SESSION } });
}

describe('apps/client/studio: /videos/$videoId/edit', () => {
  it.each([
    { scenario: 'a video id', path: `/videos/${VIDEO_ID}/edit`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/videos/nope/edit', status: 404 },
  ])('answers $scenario with $status', async ({ path, status }) => {
    const rendered = await renderEditor(path);

    expect(rendered.status).toBe(status);
  });

  it('renders the editor and the processing status the loader fetched on the server', async () => {
    const rendered = await renderEditor(
      `/videos/${VIDEO_ID}/edit`,
      video({ title: 'Launch day', status: 'PROCESSING', progress: { overall: 42.4, byRendition: {} } })
    );

    expect(rendered.main).toContain('Editing video: Launch day');
    expect(rendered.main).toContain('Processing, 42% encoded');
  });
});
