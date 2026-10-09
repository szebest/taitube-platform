import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { Services, registerServices } from '../services.module';

const CREATOR: UserContext = { id: '00000000-0000-7000-8000-00000000f101', role: 'CREATOR' };
const VIDEO_ID = '00000000-0000-7000-8000-00000000f102';

describe('apps/api/composition: studio module', () => {
  it('hands the studio the same repositories and CDN the rest of the API reads', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    expectOk(
      await c.get(Adapters.Repositories).videos.create({
        id: VIDEO_ID,
        ownerId: CREATOR.id,
        status: 'READY',
        sourceKey: 'raw/studio.mp4',
        posterKey: `videos/${VIDEO_ID}/thumbs/poster.jpg`,
      })
    );

    const page = expectOk(
      await c.get(Services.CreatorStudioService).library(CREATOR, { sort: 'newest' })
    );

    expect(page.items.map((item) => [item.id, item.thumbnailUrl])).toEqual([
      [VIDEO_ID, `http://cdn.example/videos/${VIDEO_ID}/thumbs/poster.jpg`],
    ]);
    expectOk(await c.dispose());
  });
});
