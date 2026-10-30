import { getFeed, getShorts, getSubscriptionFeed } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { VIDEO_ID, apiServer, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { api, mockEndpoint } from '@vp/web-testing';
import {
  feedKeys,
  publicFeedQueryOptions,
  shortsFeedQueryOptions,
  subscriptionFeedQueryOptions,
} from '../feed-queries';

const CATEGORY_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

const firstPage = { items: [videoSummary({ title: 'First' })], nextCursor: 'next', total: 2 };
const secondPage = {
  items: [videoSummary({ id: SECOND_VIDEO_ID, title: 'Second' })],
  nextCursor: null,
  total: 2,
};

function pagedFeed(searches: string[]) {
  return mockEndpoint(getFeed, ({ request }) => {
    const { searchParams } = new URL(request.url);
    searches.push(searchParams.toString());
    return HttpResponse.json(searchParams.has('cursor') ? secondPage : firstPage);
  });
}

describe('apps/client/web: feed queries', () => {
  it('reads the public feed for its sort and category, a page at a time', async () => {
    const searches: string[] = [];
    apiServer.use(pagedFeed(searches));

    await createQueryClient().fetchInfiniteQuery(
      publicFeedQueryOptions(api, { sort: 'trending', categoryId: CATEGORY_ID })
    );

    expect(searches).toEqual([`sort=trending&categoryId=${CATEGORY_ID}&limit=30`]);
  });

  it('reads the subscription feed a page at a time', async () => {
    const searches: string[] = [];
    apiServer.use(
      mockEndpoint(getSubscriptionFeed, ({ request }) => {
        searches.push(new URL(request.url).searchParams.toString());
        return HttpResponse.json(secondPage);
      })
    );

    await createQueryClient().fetchInfiniteQuery(subscriptionFeedQueryOptions(api));

    expect(searches).toEqual(['limit=30']);
  });

  it('asks for the next page with the cursor the last one returned', async () => {
    const searches: string[] = [];
    apiServer.use(pagedFeed(searches));

    const feed = await createQueryClient().fetchInfiniteQuery({
      ...publicFeedQueryOptions(api, { sort: 'recent' }),
      pages: 2,
    });

    expect(feed.pages.flatMap((page) => page.items.map((item) => item.id))).toEqual([
      VIDEO_ID,
      SECOND_VIDEO_ID,
    ]);
    expect(searches.at(-1)).toBe('sort=recent&limit=30&cursor=next');
  });

  it('reads the Shorts feed a page at a time, carrying the cursor the last page returned', async () => {
    const searches: string[] = [];
    apiServer.use(
      mockEndpoint(getShorts, ({ request }) => {
        const { searchParams } = new URL(request.url);
        searches.push(searchParams.toString());
        return HttpResponse.json(searchParams.has('cursor') ? secondPage : firstPage);
      })
    );

    await createQueryClient().fetchInfiniteQuery({ ...shortsFeedQueryOptions(api), pages: 2 });

    expect(searches).toEqual(['limit=30', 'limit=30&cursor=next']);
  });

  it('keeps a feed per sort and category, so switching either starts from its first page', () => {
    const keys = [
      publicFeedQueryOptions(api, { sort: 'recent' }).queryKey,
      publicFeedQueryOptions(api, { sort: 'trending' }).queryKey,
      publicFeedQueryOptions(api, { sort: 'recent', categoryId: CATEGORY_ID }).queryKey,
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(3);
  });

  it.each([
    { feed: 'the public feed', queryKey: publicFeedQueryOptions(api, { sort: 'recent' }).queryKey },
    { feed: 'the subscription feed', queryKey: subscriptionFeedQueryOptions(api).queryKey },
    { feed: 'the Shorts feed', queryKey: shortsFeedQueryOptions(api).queryKey },
  ])('files $feed under the feed key, so one invalidation reaches it', ({ queryKey }) => {
    expect(queryKey.slice(0, feedKeys.all.length)).toEqual([...feedKeys.all]);
  });
});
