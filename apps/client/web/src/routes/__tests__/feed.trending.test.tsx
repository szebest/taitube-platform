import { hashKey } from '@tanstack/react-query';
import { api } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { VideoFeedSkeleton } from '#app/features/browse/components/video-feed/video-feed';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { getRouter } from '#app/router';
import { Route } from '../feed.trending';

async function renderTrending() {
  const answered: string[] = [];
  const rendered = await serverRender(getRouter, '/feed/trending', {
    handlers: loaderApi(answered),
  });
  return { ...rendered, answered };
}

describe('apps/client/web: /feed/trending', () => {
  it('server-renders the first trending cards, dehydrated so the browser does not ask again', async () => {
    const queryHash = hashKey(publicFeedQueryOptions(api, { sort: 'trending' }).queryKey);

    const { status, main, html, answered } = await renderTrending();

    expect(status).toBe(200);
    expect(main).toContain('>Trending</h1>');
    expect(main).toContain('>Feed video</a>');
    expect(main).toContain('50% watched');
    expect(html).toContain(`queryHash:${JSON.stringify(queryHash)}`);
    expect(answered).toEqual(['/v1/feed']);
  });

  it('waits on a skeleton of the feed', () => {
    expect(Route.options.pendingComponent).toBe(VideoFeedSkeleton);
  });
});
