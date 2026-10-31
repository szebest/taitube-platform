import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const ADMIN = { id: '00000000-0000-7000-8000-00000000f501', role: 'ADMIN' } as const;
const OWNER = '00000000-0000-7000-8000-00000000f502';
const VIDEO = '00000000-0000-7000-8000-00000000f503';
const HOUR = 3_600_000;

describe('apps/server/api/composition: pick module', () => {
  it('schedules a pick over the repositories and the cache the rest of the API shares', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    expectOk(
      await c.get(Adapters.Repositories).videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Match',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/match.mp4',
      })
    );
    const service = c.get(Services.PickService);
    const current = c.get(Services.CurrentPickService);

    expectOk(
      await service.create(ADMIN, {
        videoId: VIDEO,
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + HOUR).toISOString(),
        note: 'Worth it',
      })
    );

    expect(expectOk(await current.current()).data).toMatchObject({
      source: 'scheduled',
      note: 'Worth it',
      video: { title: 'Match' },
    });
    expectOk(await c.dispose());
  });
});
