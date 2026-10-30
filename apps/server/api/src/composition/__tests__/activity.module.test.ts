import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { Services, registerServices } from '../services.module';

const VIEWER = { id: '00000000-0000-7000-8000-00000000f301', role: 'USER' } as const;
const OWNER = '00000000-0000-7000-8000-00000000f302';
const VIDEO = '00000000-0000-7000-8000-00000000f303';

describe('apps/server/api/composition: activity module', () => {
  it('lists what the viewer liked from the repositories the rest of the API shares', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    const repositories = c.get(Adapters.Repositories);
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Liked once',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/liked.mp4',
      })
    );
    expectOk(await repositories.videoReactions.setReaction(VIDEO, VIEWER.id, 'LIKE'));

    const page = expectOk(await c.get(Services.ViewerActivityService).likedVideos(VIEWER, {}));

    expect(page.items).toMatchObject([{ id: VIDEO, title: 'Liked once' }]);
    expectOk(await c.dispose());
  });
});
