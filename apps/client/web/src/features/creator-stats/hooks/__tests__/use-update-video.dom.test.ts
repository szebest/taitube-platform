import { updateCreatorVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, videoKeys } from '@vp/queries';
import { apiServer, channel, mockEndpoint, problemReply, VIDEO_ID, video } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useUpdateVideo } from '../use-update-video';

const WATCHED = video({ title: 'Launch day', version: 3, channel: channel() });

describe('apps/client/web: useUpdateVideo', () => {
  it('sends the change with the version the page holds and keeps the cached channel', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateCreatorVideo, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(video({ title: 'Renamed', version: 4, channel: undefined }));
      })
    );
    const client = createQueryClient();
    client.setQueryData(videoKeys.detail(VIDEO_ID), WATCHED);

    await runMutation(client, () => useUpdateVideo(WATCHED), { title: 'Renamed' }, AppProviders);

    expect(bodies).toEqual([{ title: 'Renamed', version: 3 }]);
    expect(client.getQueryData(videoKeys.detail(VIDEO_ID))).toMatchObject({
      title: 'Renamed',
      version: 4,
      channel: WATCHED.channel,
    });
  });

  it('leaves the cached video alone when the version is stale', async () => {
    apiServer.use(
      mockEndpoint(updateCreatorVideo, () => problemReply(ErrorCodes.VERSION_CONFLICT))
    );
    const client = createQueryClient();
    client.setQueryData(videoKeys.detail(VIDEO_ID), WATCHED);

    const outcome = await runMutation(
      client,
      () => useUpdateVideo(WATCHED),
      { title: 'Renamed' },
      AppProviders
    );

    expect(outcome).toMatchObject({ status: 'rejected' });
    expect(client.getQueryData(videoKeys.detail(VIDEO_ID))).toEqual(WATCHED);
  });
});
