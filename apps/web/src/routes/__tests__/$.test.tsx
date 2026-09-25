import { recordRequests } from '../../__tests__/api-store';
import { serverRender } from '../../__tests__/server-render';

describe('apps/web: unmatched paths', () => {
  it.each([
    { path: '/no-such-page', location: '/' },
    { path: '/watch', location: '/' },
    { path: '/watch/a/b', location: '/' },
    { path: '/channel', location: '/' },
    { path: '/trending/anything', location: '/trending' },
    { path: '/subscriptions/anything', location: '/subscriptions/videos' },
    { path: '/upload/edit', location: '/upload' },
    { path: '/upload/anything/else', location: '/upload' },
  ])('redirects $path to $location, as the legacy router did', async ({ path, location }) => {
    recordRequests();

    const rendered = await serverRender(path);

    expect(rendered.status).toBe(307);
    expect(rendered.location).toBe(location);
  });
});
