import { recordRequests } from '../../../../__tests__/api-store';
import { VIDEO_ID } from '../../../../__tests__/fixtures';
import { serverRender } from '../../../../__tests__/server-render';

describe('apps/web: /upload/edit/$videoId', () => {
  it.each([
    { scenario: 'a video id', path: `/upload/edit/${VIDEO_ID}`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/upload/edit/nope', status: 404 },
  ])('answers $scenario with $status, in the narrowed layout', async ({ path, status }) => {
    recordRequests();

    const rendered = await serverRender(path);

    expect(rendered.status).toBe(status);
    expect(rendered.main).toContain('max-width:1280px');
  });
});
