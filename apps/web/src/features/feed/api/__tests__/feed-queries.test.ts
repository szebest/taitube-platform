import type { InfiniteData } from '@tanstack/react-query';
import type { FeedResponse } from '@vp/api-contracts';
import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { VIDEO_ID, videoSummary } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { feedKeys, publicFeedQueryOptions, subscriptionFeedQueryOptions } from '../feed-queries';

const CATEGORY_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

const firstPage = { items: [videoSummary({ title: 'First' })], nextCursor: 'next', total: 2 };
const secondPage = {
  items: [videoSummary({ id: SECOND_VIDEO_ID, title: 'Second' })],
  nextCursor: null,
  total: 2,
};

function ids(feed: InfiniteData<FeedResponse>): string[] {
  return feed.pages.flatMap((page) => page.items.map((item) => item.id));
}

describe('apps/web: feed queries', () => {
  it.each<{ feed: string; fetch: () => Promise<unknown>; url: string }>([
    {
      feed: 'the public feed',
      fetch: () =>
        createQueryClient().fetchInfiniteQuery(
          publicFeedQueryOptions({ sort: 'trending', categoryId: CATEGORY_ID })
        ),
      url: `${API_BASE_URL}/v1/feed?sort=trending&categoryId=${CATEGORY_ID}&limit=30`,
    },
    {
      feed: 'the subscription feed',
      fetch: () => createQueryClient().fetchInfiniteQuery(subscriptionFeedQueryOptions()),
      url: `${API_BASE_URL}/v1/feed/subscriptions?limit=30`,
    },
  ])('reads the first page of $feed with GET $url', async ({ fetch, url }) => {
    const sent = recordRequests(() => jsonResponse(firstPage));

    await fetch();

    expect(sent).toEqual([{ method: 'GET', url, body: undefined }]);
  });

  it('asks for the next page with the cursor the last one returned', async () => {
    const sent = recordRequests((url) =>
      jsonResponse(url.includes('cursor=') ? secondPage : firstPage)
    );

    const feed = await createQueryClient().fetchInfiniteQuery({
      ...publicFeedQueryOptions({ sort: 'recent' }),
      pages: 2,
    });

    expect(ids(feed)).toEqual([VIDEO_ID, SECOND_VIDEO_ID]);
    expect(sent.at(-1)?.url).toBe(`${API_BASE_URL}/v1/feed?sort=recent&limit=30&cursor=next`);
  });

  it('keeps a feed per sort and category, so switching either starts from its first page', () => {
    const keys = [
      publicFeedQueryOptions({ sort: 'recent' }).queryKey,
      publicFeedQueryOptions({ sort: 'trending' }).queryKey,
      publicFeedQueryOptions({ sort: 'recent', categoryId: CATEGORY_ID }).queryKey,
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(3);
  });

  it.each([
    { feed: 'the public feed', queryKey: publicFeedQueryOptions({ sort: 'recent' }).queryKey },
    { feed: 'the subscription feed', queryKey: subscriptionFeedQueryOptions().queryKey },
  ])('files $feed under the feed key, so one invalidation reaches it', ({ queryKey }) => {
    expect(queryKey.slice(0, feedKeys.all.length)).toEqual([...feedKeys.all]);
  });
});
