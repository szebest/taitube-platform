import { getFeed } from '@vp/api-contracts';
import { apiServer, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { getHandler } from '#app/__tests__/get-handler';
import { Route } from '../feeds.videos[.]xml';

describe('apps/client/web: /feeds/videos.xml', () => {
  it('answers an RSS feed of the public videos on the web origin', async () => {
    apiServer.use(
      mockEndpoint(getFeed, () =>
        HttpResponse.json({ items: [videoSummary()], nextCursor: null, total: 1 })
      )
    );
    const response = await getHandler(Route)();

    expect(response.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8');
    expect(await response.text()).toContain(
      '<link>http://localhost:5173/watch/0190c3a0-5e1d-7000-8000-00000000a001</link>'
    );
  });
});
