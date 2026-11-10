import { createQueryClient } from '@vp/queries';
import { VIDEO_ID, api } from '@vp/web-testing';
import {
  creatorScreening,
  serveScreening,
} from '#app/features/videos/__tests__/screening-api.fixture';
import { videoScreeningQueryOptions } from '../video-screening';

describe('apps/client/studio: videoScreeningQueryOptions', () => {
  it("reads the owner's view of the screening under a key per video", async () => {
    const screening = creatorScreening({ reasons: ['NSFW'] });
    serveScreening(screening);
    const options = videoScreeningQueryOptions(api, VIDEO_ID);

    const data = await createQueryClient().query(options);

    expect(options.queryKey).toEqual(['creator', 'screening', VIDEO_ID]);
    expect(data).toEqual(screening);
  });
});
