import { type ApiStore, createApiStore, jsonResponse, recordRequests } from '../../../../__tests__/api-store';
import { VIDEO_ID, videoSummary } from '../../../../__tests__/fixtures';
import { API_BASE_URL } from '../../../../config';
import { feedApi } from '../feed-api';

const CATEGORY_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

const firstPage = { items: [videoSummary({ title: 'First' })], nextCursor: 'next', total: 2 };
const secondPage = {
  items: [videoSummary({ id: SECOND_VIDEO_ID, title: 'Second' })],
  nextCursor: null,
  total: 2,
};

describe('apps/web: feed api', () => {
  it.each<{ endpoint: string; send: (store: ApiStore) => unknown; url: string }>([
    {
      endpoint: 'the public feed',
      send: (store) =>
        store.dispatch(
          feedApi.endpoints.publicFeed.initiate({ sort: 'trending', categoryId: CATEGORY_ID, limit: 30 })
        ),
      url: `${API_BASE_URL}/v1/feed?sort=trending&categoryId=${CATEGORY_ID}&limit=30`,
    },
    {
      endpoint: 'the subscription feed',
      send: (store) =>
        store.dispatch(feedApi.endpoints.subscriptionFeed.initiate({ limit: 30, cursor: 'next' })),
      url: `${API_BASE_URL}/v1/feed/subscriptions?limit=30&cursor=next`,
    },
  ])('reads $endpoint with GET $url', async ({ send, url }) => {
    const sent = recordRequests();

    await send(createApiStore());

    expect(sent).toEqual([{ method: 'GET', url, body: undefined }]);
  });

  it('appends the next page to the feed already on screen', async () => {
    const store = createApiStore();
    recordRequests((url) => jsonResponse(url.includes('cursor=') ? secondPage : firstPage));

    await store.dispatch(feedApi.endpoints.publicFeed.initiate({ sort: 'recent' }));
    const feed = await store.dispatch(
      feedApi.endpoints.publicFeed.initiate({ sort: 'recent', cursor: 'next' })
    );

    expect(feed.data?.items.map((item) => item.id)).toEqual([VIDEO_ID, SECOND_VIDEO_ID]);
    expect(feed.data?.nextCursor).toBeNull();
  });

  it('keeps a feed per sort, so switching sort starts from its first page', async () => {
    const store = createApiStore();
    const sent = recordRequests(() => jsonResponse(firstPage));

    await store.dispatch(feedApi.endpoints.publicFeed.initiate({ sort: 'recent' }));
    const trending = await store.dispatch(feedApi.endpoints.publicFeed.initiate({ sort: 'trending' }));

    expect(sent).toHaveLength(2);
    expect(trending.data?.items).toHaveLength(1);
  });
});
