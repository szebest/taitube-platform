import { type ApiStore, createApiStore, recordRequests } from '../../../../__tests__/api-store';
import { VIDEO_ID } from '../../../../__tests__/fixtures';
import { API_BASE_URL } from '../../../../config';
import { videosApi } from '../videos-api';

const VIDEO_URL = `${API_BASE_URL}/v1/videos/${VIDEO_ID}`;

describe('apps/web: videos api', () => {
  it.each<{ endpoint: string; send: (store: ApiStore) => unknown; request: unknown }>([
    {
      endpoint: 'video',
      send: (store) => store.dispatch(videosApi.endpoints.video.initiate(VIDEO_ID)),
      request: { method: 'GET', url: VIDEO_URL, body: undefined },
    },
    {
      endpoint: 'myVideos',
      send: (store) => store.dispatch(videosApi.endpoints.myVideos.initiate({ limit: 30 })),
      request: { method: 'GET', url: `${API_BASE_URL}/v1/videos?limit=30`, body: undefined },
    },
    {
      endpoint: 'updateVideo',
      send: (store) =>
        store.dispatch(
          videosApi.endpoints.updateVideo.initiate({ id: VIDEO_ID, title: 'Renamed', version: 3 })
        ),
      request: { method: 'PATCH', url: VIDEO_URL, body: { title: 'Renamed', version: 3 } },
    },
    {
      endpoint: 'deleteVideo',
      send: (store) => store.dispatch(videosApi.endpoints.deleteVideo.initiate(VIDEO_ID)),
      request: { method: 'DELETE', url: VIDEO_URL, body: undefined },
    },
  ])('sends $endpoint to the videos resource', async ({ send, request }) => {
    const sent = recordRequests();

    await send(createApiStore());

    expect(sent).toEqual([request]);
  });
});
