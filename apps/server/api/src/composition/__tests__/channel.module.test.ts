import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const OWNER = { id: '00000000-0000-7000-8000-00000000f501', role: 'CREATOR' } as const;
const VIDEO = '00000000-0000-7000-8000-00000000f503';

describe('apps/server/api/composition: channel module', () => {
  it('pins a video through the repositories the rest of the API shares', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    const { videos, channels } = c.get(Adapters.Repositories);
    expectOk(await channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' }));
    expectOk(
      await videos.create({
        id: VIDEO,
        ownerId: OWNER.id,
        title: 'Match',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/match.mp4',
      })
    );

    const view = expectOk(await c.get(Services.ChannelFeaturedService).replace(OWNER, [VIDEO]));

    expect(view).toMatchObject({ source: 'pinned', items: [{ id: VIDEO, title: 'Match' }] });
    expect(expectOk(await c.get(Services.ChannelService).getPublicChannel('@owner')).handle).toBe(
      'owner'
    );
    expectOk(await c.dispose());
  });
});
