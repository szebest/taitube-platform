import { VIDEO_ID } from '#app/__tests__/fixtures';
import { serverRender } from '#app/__tests__/server-render';

describe('apps/client/web: /upload/edit/$videoId', () => {
  it.each([
    { scenario: 'a video id', path: `/upload/edit/${VIDEO_ID}`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/upload/edit/nope', status: 404 },
  ])('answers $scenario with $status, in the narrowed layout', async ({ path, status }) => {
    const rendered = await serverRender(path);

    expect(rendered.status).toBe(status);
    expect(rendered.main).toContain('max-width:1280px');
  });
});
