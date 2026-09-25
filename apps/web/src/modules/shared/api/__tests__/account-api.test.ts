import { type ApiStore, createApiStore, recordRequests } from '#app/__tests__/api-store';
import { CHANNEL_ID } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
import { accountApi } from '../account-api';

describe('apps/web: account api', () => {
  it.each<{ endpoint: string; send: (store: ApiStore) => unknown; url: string }>([
    {
      endpoint: 'account',
      send: (store) => store.dispatch(accountApi.endpoints.account.initiate()),
      url: `${API_BASE_URL}/v1/me/account`,
    },
    {
      endpoint: 'channel',
      send: (store) => store.dispatch(accountApi.endpoints.channel.initiate(CHANNEL_ID)),
      url: `${API_BASE_URL}/v1/channels/${CHANNEL_ID}`,
    },
  ])('reads $endpoint with GET $url', async ({ send, url }) => {
    const sent = recordRequests();

    await send(createApiStore());

    expect(sent).toEqual([{ method: 'GET', url, body: undefined }]);
  });
});
