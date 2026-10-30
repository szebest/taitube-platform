import { hashKey } from '@tanstack/react-query';
import { api } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { headOf, jsonLdOf } from '#app/__tests__/head-tags';
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
    expect(main).toMatch(/aria-valuenow="50"[^>]*role="progressbar"[^>]*aria-label="Watched"/);
    expect(html).toContain(`queryHash:${JSON.stringify(queryHash)}`);
    expect(answered).toEqual(['/v1/feed']);
  });

  it('server-renders its title, description, canonical URL and an ItemList of the first cards, from the one feed request', async () => {
    const { html, answered } = await renderTrending();

    const head = headOf(html);
    expect(head).toContain('<title>Trending</title>');
    expect(head).toContain(
      '<meta name="description" content="The videos people are watching on Taitube right now.">'
    );
    expect(head).toContain('<link rel="canonical" href="http://localhost:5173/feed/trending">');
    expect(jsonLdOf(html)).toMatchObject([
      { '@type': 'ItemList', itemListElement: [{ item: { name: 'Feed video' } }] },
    ]);
    expect(answered).toEqual(['/v1/feed']);
  });

  it('waits on a skeleton of the feed', () => {
    expect(Route.options.pendingComponent).toBe(VideoFeedSkeleton);
  });
});
