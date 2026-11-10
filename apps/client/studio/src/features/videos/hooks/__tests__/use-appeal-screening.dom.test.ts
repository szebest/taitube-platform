import { appealScreening } from '@vp/api-contracts';
import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, api, apiServer, mockEndpoint, problemReply, video } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import {
  creatorScreening,
  serveScreening,
} from '#app/features/videos/__tests__/screening-api.fixture';
import { libraryKeys } from '#app/features/videos/api/library-queries';
import { videoScreeningQueryOptions } from '#app/features/videos/api/video-screening';
import { useAppealScreening } from '../use-appeal-screening';

const detailKey = videoQueryOptions(api, VIDEO_ID).queryKey;
const screeningKey = videoScreeningQueryOptions(api, VIDEO_ID).queryKey;

const seeded = () => {
  const client = createQueryClient();
  client.setQueryData(detailKey, video({ status: 'REJECTED' }));
  client.setQueryData(libraryKeys.all, []);
  return client;
};

describe('apps/client/studio: useAppealScreening', () => {
  it('sends the message, keeps the answer as the screening and marks the video and library stale', async () => {
    const { appeals } = serveScreening(creatorScreening());
    const client = seeded();

    const settled = await runMutation(
      client,
      () => useAppealScreening(VIDEO_ID),
      'It is mine',
      AppProviders
    );

    expect(settled.status).toBe('fulfilled');
    expect(appeals).toEqual([{ message: 'It is mine' }]);
    expect(client.getQueryData(screeningKey)).toMatchObject({ status: 'HELD' });
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(libraryKeys.all)?.isInvalidated).toBe(true);
  });

  it('rejects when the API refuses the appeal', async () => {
    apiServer.use(mockEndpoint(appealScreening, () => problemReply('FORBIDDEN')));

    const settled = await runMutation(
      seeded(),
      () => useAppealScreening(VIDEO_ID),
      'It is mine',
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
