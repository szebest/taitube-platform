import { type ApiStore, createApiStore, recordRequests } from '../../../../__tests__/api-store';
import { CHANNEL_ID } from '../../../../__tests__/fixtures';
import { API_BASE_URL } from '../../../../config';
import { subscriptionsApi } from '../subscriptions-api';

const SUBSCRIBERS_URL = `${API_BASE_URL}/v1/channels/${CHANNEL_ID}/subscribers`;

describe('apps/web: subscriptions api', () => {
  it.each<{ endpoint: string; send: (store: ApiStore) => unknown; method: string; url: string }>([
    {
      endpoint: 'mySubscriptions with no page asked for',
      send: (store) => store.dispatch(subscriptionsApi.endpoints.mySubscriptions.initiate()),
      method: 'GET',
      url: `${API_BASE_URL}/v1/me/subscriptions`,
    },
    {
      endpoint: 'mySubscriptions for the next page',
      send: (store) =>
        store.dispatch(subscriptionsApi.endpoints.mySubscriptions.initiate({ cursor: 'next' })),
      method: 'GET',
      url: `${API_BASE_URL}/v1/me/subscriptions?cursor=next`,
    },
    {
      endpoint: 'isSubscribed',
      send: (store) => store.dispatch(subscriptionsApi.endpoints.isSubscribed.initiate(CHANNEL_ID)),
      method: 'GET',
      url: `${SUBSCRIBERS_URL}/me`,
    },
    {
      endpoint: 'subscribe',
      send: (store) => store.dispatch(subscriptionsApi.endpoints.subscribe.initiate(CHANNEL_ID)),
      method: 'POST',
      url: SUBSCRIBERS_URL,
    },
    {
      endpoint: 'unsubscribe',
      send: (store) => store.dispatch(subscriptionsApi.endpoints.unsubscribe.initiate(CHANNEL_ID)),
      method: 'DELETE',
      url: SUBSCRIBERS_URL,
    },
  ])('sends $endpoint as $method $url', async ({ send, method, url }) => {
    const sent = recordRequests();

    await send(createApiStore());

    expect(sent).toEqual([{ method, url, body: undefined }]);
  });
});
