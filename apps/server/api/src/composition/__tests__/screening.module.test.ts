import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { Services, registerServices } from '../services.module';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000f301', role: 'CREATOR' };
const ADMIN: UserContext = { id: '00000000-0000-7000-8000-00000000f302', role: 'ADMIN' };
const VIDEO_ID = '00000000-0000-7000-8000-00000000f303';

describe('apps/server/api/composition: screening module', () => {
  it('hands the service and the edit screening one set of repositories', async () => {
    const config = inProcessAppConfig();
    const c = registerServices(
      await registerAdapters(new Container(), {
        ...config,
        screening: { ...config.screening, enabled: true },
      })
    );
    const repositories = c.get(Adapters.Repositories);
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        title: 'This is shit',
        status: 'READY',
        sourceKey: 'raw/screening.mp4',
        visibility: 'public',
      })
    );

    const video = expectOk(await repositories.videos.findById(VIDEO_ID));
    if (!video) throw new Error('video missing');
    expectOk(await c.get(Services.MetadataScreening).flag(video));
    const queue = expectOk(await c.get(Services.ScreeningService).queue(ADMIN, {}));

    expect(
      queue.items.map((item) => [item.videoId, item.flags.map(({ reason }) => reason)])
    ).toEqual([[VIDEO_ID, ['METADATA_SPAM']]]);
    expectOk(await c.dispose());
  });
});
