import type { QueryClient } from '@tanstack/react-query';
import { updateVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, myVideosQueryOptions, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, apiServer, problemReply, video } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { WithApi, api, mockEndpoint } from '#app/__tests__/api';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { useUpdateVideo } from '../use-update-video';

const detailKey = videoQueryOptions(api, VIDEO_ID).queryKey;
const mineKey = myVideosQueryOptions(api).queryKey;
const feedKey = publicFeedQueryOptions(api, { sort: 'recent' }).queryKey;

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(detailKey, video({ title: 'Before' }));
  client.setQueryData(mineKey, { pages: [], pageParams: [] });
  client.setQueryData(feedKey, { pages: [], pageParams: [] });
  return client;
}

describe('apps/client/web: useUpdateVideo', () => {
  it('sends the changes with the version the edit started from', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateVideo, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(video({ title: 'After', version: 4 }));
      })
    );

    await runMutation(
      seeded(),
      () => useUpdateVideo(VIDEO_ID),
      {
        title: 'After',
        version: 3,
      },
      WithApi
    );

    expect(bodies).toEqual([{ title: 'After', version: 3 }]);
  });

  it('writes the saved video into the detail and marks the detail and every list stale', async () => {
    apiServer.use(
      mockEndpoint(updateVideo, () => HttpResponse.json(video({ title: 'After', version: 4 })))
    );
    const client = seeded();

    await runMutation(
      client,
      () => useUpdateVideo(VIDEO_ID),
      { title: 'After', version: 3 },
      WithApi
    );

    expect(client.getQueryData(detailKey)?.title).toBe('After');
    for (const queryKey of [detailKey, mineKey, feedKey]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });

  it('keeps the cached video when the save is refused', async () => {
    apiServer.use(mockEndpoint(updateVideo, () => problemReply(ErrorCodes.VERSION_CONFLICT)));
    const client = seeded();

    const settled = await runMutation(
      client,
      () => useUpdateVideo(VIDEO_ID),
      {
        title: 'After',
        version: 3,
      },
      WithApi
    );

    expect(settled.status).toBe('rejected');
    expect(client.getQueryData(detailKey)?.title).toBe('Before');
  });
});
