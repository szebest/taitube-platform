import { type ApiStore, createApiStore, recordRequests } from '../../../../__tests__/api-store';
import { VIDEO_ID } from '../../../../__tests__/fixtures';
import { API_BASE_URL } from '../../../../config';
import { reactionsApi } from '../reactions-api';

describe('apps/web: reactions api', () => {
  it.each<{ endpoint: string; send: (store: ApiStore) => unknown; request: unknown }>([
    {
      endpoint: 'myReaction',
      send: (store) => store.dispatch(reactionsApi.endpoints.myReaction.initiate(VIDEO_ID)),
      request: {
        method: 'GET',
        url: `${API_BASE_URL}/v1/videos/${VIDEO_ID}/reactions/me`,
        body: undefined,
      },
    },
    {
      endpoint: 'setReaction',
      send: (store) =>
        store.dispatch(reactionsApi.endpoints.setReaction.initiate({ id: VIDEO_ID, type: 'LIKE' })),
      request: {
        method: 'PUT',
        url: `${API_BASE_URL}/v1/videos/${VIDEO_ID}/reactions`,
        body: { type: 'LIKE' },
      },
    },
  ])('sends $endpoint to the reactions resource', async ({ send, request }) => {
    const sent = recordRequests();

    await send(createApiStore());

    expect(sent).toEqual([request]);
  });
});
