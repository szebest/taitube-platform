import { Container } from '@kit/composition';
import { expectOk } from '@kit/testing/result';
import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { replacementSourceKey } from '@vp/storage';
import { registerServices, Services } from '../services.module';

const OWNER = { id: '00000000-0000-7000-8000-00000000f701', role: 'CREATOR' } as const;
const VIDEO = '00000000-0000-7000-8000-00000000f702';

describe('apps/server/api/composition: video pipeline module', () => {
  it('presigns a replacement into the configured raw bucket and queues its render on the outbox', async () => {
    const config = inProcessAppConfig();
    const c = registerServices(await registerAdapters(new Container(), config));
    const repositories = c.get(Adapters.Repositories);
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER.id,
        status: 'READY',
        sourceKey: `raw/${VIDEO}/source.mp4`,
        durationMs: 60_000,
      })
    );
    const replacements = c.get(Services.VideoReplacementService);

    const { generation } = expectOk(
      await replacements.start(OWNER, VIDEO, {
        filename: 'retake.mp4',
        sizeBytes: 1_000,
        contentType: 'video/mp4',
      })
    );
    expectOk(
      await c.get(Adapters.Storage).uploadObject({
        bucket: config.buckets.raw,
        key: replacementSourceKey(VIDEO, generation, '.mp4'),
        body: 'x',
        contentType: 'video/mp4',
      })
    );

    expect(expectOk(await replacements.complete(OWNER, VIDEO, generation))).toEqual({
      generation: 2,
      status: 'rendering',
    });
    expectOk(await c.dispose());
  });
});
