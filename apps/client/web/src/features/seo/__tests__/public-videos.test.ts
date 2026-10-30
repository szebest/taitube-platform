import { getFeed } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { listPublicVideos } from '../public-videos';

function pagedFeed(asked: string[]) {
  return mockEndpoint(getFeed, ({ request }) => {
    const { searchParams } = new URL(request.url);
    asked.push(searchParams.toString());
    const second = searchParams.has('cursor');
    return HttpResponse.json({
      items: [videoSummary({ title: second ? 'Second' : 'First' })],
      nextCursor: second ? null : 'next',
      total: 2,
    });
  });
}

describe('apps/client/web: listPublicVideos', () => {
  it('walks the recent feed by cursor until it ends', async () => {
    const asked: string[] = [];
    apiServer.use(pagedFeed(asked));

    const videos = await listPublicVideos(api, 500);

    expect(videos.map((video) => video.title)).toEqual(['First', 'Second']);
    expect(asked).toEqual(['sort=recent&limit=100', 'sort=recent&limit=100&cursor=next']);
  });

  it('stops at the limit, asking for no more than it needs', async () => {
    const asked: string[] = [];
    apiServer.use(pagedFeed(asked));

    const videos = await listPublicVideos(api, 1);

    expect(videos).toHaveLength(1);
    expect(asked).toEqual(['sort=recent&limit=1']);
  });
});
