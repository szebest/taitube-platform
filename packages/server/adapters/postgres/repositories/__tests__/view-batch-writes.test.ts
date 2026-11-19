import { expectErr, expectOk } from '@kit/testing/result';
import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { VIDEO_IDS, publicVideo, seedOwners } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { PostgresRepositories } from '../postgres-repositories';

describe('applyViewBatch transaction', () => {
  it('rolls the views back when the retention insert of the same batch fails', async () => {
    const engine = await migratedPglite();
    const repositories = new PostgresRepositories({
      type: 'drizzle',
      db: drizzle(engine, { schema }),
    });
    await seedOwners(repositories);
    expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a })));
    const batch = {
      batchId: 'batch-1',
      counts: [{ videoId: VIDEO_IDS.a, viewDate: '2026-03-10', views: 3, watchSeconds: 30 }],
      retention: [{ videoId: VIDEO_IDS.a, percent: 100_000, viewers: 1 }],
      hourly: [],
      devices: [],
    };

    expectErr(await repositories.videoViews.applyBatch(batch));

    expect(expectOk(await repositories.videos.findById(VIDEO_IDS.a))?.viewsCount).toBe(0);
    expect(expectOk(await repositories.videoViews.applyBatch({ ...batch, retention: [] }))).toEqual(
      { type: 'applied', views: 3 }
    );
    await engine.close();
  });
});
