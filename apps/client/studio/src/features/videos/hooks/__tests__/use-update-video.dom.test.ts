import type { QueryClient } from '@tanstack/react-query';
import { updateCreatorVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, myVideosQueryOptions, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, apiServer, problemReply, video } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { api, mockEndpoint } from '@vp/web-testing';
import { AppProviders } from '#app/__tests__/providers';
import { libraryKeys } from '#app/features/content/api/library-queries';
import { useUpdateVideo } from '../use-update-video';

const detailKey = videoQueryOptions(api, VIDEO_ID).queryKey;
const mineKey = myVideosQueryOptions(api).queryKey;

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(detailKey, video({ title: 'Before' }));
  client.setQueryData(mineKey, { pages: [], pageParams: [] });
  client.setQueryData(libraryKeys.all, []);
  return client;
}

describe('apps/client/studio: useUpdateVideo', () => {
  it('sends the changes with the version the edit started from', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateCreatorVideo, async ({ request }) => {
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
      AppProviders
    );

    expect(bodies).toEqual([{ title: 'After', version: 3 }]);
  });

  it("writes the saved video into the detail and marks the detail, the creator's list and the library stale", async () => {
    apiServer.use(
      mockEndpoint(updateCreatorVideo, () => HttpResponse.json(video({ title: 'After', version: 4 })))
    );
    const client = seeded();

    await runMutation(
      client,
      () => useUpdateVideo(VIDEO_ID),
      { title: 'After', version: 3 },
      AppProviders
    );

    expect(client.getQueryData(detailKey)?.title).toBe('After');
    for (const queryKey of [detailKey, mineKey, libraryKeys.all]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });

  it('keeps the cached video when the save is refused', async () => {
    apiServer.use(mockEndpoint(updateCreatorVideo, () => problemReply(ErrorCodes.VERSION_CONFLICT)));
    const client = seeded();

    const settled = await runMutation(
      client,
      () => useUpdateVideo(VIDEO_ID),
      {
        title: 'After',
        version: 3,
      },
      AppProviders
    );

    expect(settled.status).toBe('rejected');
    expect(client.getQueryData(detailKey)?.title).toBe('Before');
  });
});
