import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const VIEWER = { id: '00000000-0000-7000-8000-00000000f401', role: 'USER' } as const;
const OWNER = '00000000-0000-7000-8000-00000000f402';
const VIDEO = '00000000-0000-7000-8000-00000000f403';

describe('apps/server/api/composition: clip module', () => {
  it('clips a video from the repositories the rest of the API shares', async () => {
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
        durationMs: 120_000,
      })
    );

    const clip = expectOk(
      await c
        .get(Services.ClipService)
        .create(VIEWER, VIDEO, { startMs: 0, endMs: 10_000, title: 'Start' })
    );

    expect(clip).toMatchObject({ videoId: VIDEO, userId: VIEWER.id, video: { title: 'Match' } });
    expectOk(await c.dispose());
  });
});
