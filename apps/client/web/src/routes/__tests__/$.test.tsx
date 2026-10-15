import { serverRender } from '@vp/web-testing';

import { getRouter } from '#app/router';

describe('apps/client/web: unmatched paths', () => {
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
    const rendered = await serverRender(getRouter, path);

    expect(rendered.status).toBe(307);
    expect(rendered.location).toBe(location);
  });
});
