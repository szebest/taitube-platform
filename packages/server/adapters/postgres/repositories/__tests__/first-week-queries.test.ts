import { expectOk } from '@kit/testing/result';
import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import {
  OWNER_CHANNEL_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { firstWeekRows, recentPeerVideos } from '../first-week-queries';
import { PostgresRepositories } from '../postgres-repositories';

const READY = new Date('2026-03-10T23:30:00.000Z');

async function seeded() {
  const engine = await migratedPglite();
  const db = drizzle(engine, { schema });
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  await seedOwners(repositories);
  return { engine, db, repositories };
}

describe('first week queries', () => {
  it('offsets each day from the UTC day of ready_at, and keeps the first seven days only', async () => {
    const { engine, db, repositories } = await seeded();
    expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a, readyAt: READY })));
    const counts = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-16', '2026-03-17'].map(
      (viewDate) => ({ videoId: VIDEO_IDS.a, viewDate, views: 1, watchSeconds: 0 })
    );
    expectOk(
      await repositories.videoViews.applyBatch({
        batchId: 'b',
        counts,
        retention: [],
        hourly: [],
        devices: [],
        shareLinks: [],
        experiments: [],
      })
    );

    const rows = await firstWeekRows(db, [VIDEO_IDS.a]);

    expect(rows.map(({ dayOffset }) => Number(dayOffset)).sort((a, b) => a - b)).toEqual([0, 1, 6]);
    await engine.close();
  });

  it('reads nothing for no videos', async () => {
    const { engine, db } = await seeded();

    expect(await firstWeekRows(db, [])).toEqual([]);
    await engine.close();
  });

  it('lists the channel public ready videos at or before the limit, newest first', async () => {
    const { engine, db, repositories } = await seeded();
    expectOk(
      await repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.a, readyAt: new Date('2026-03-01T00:00:00.000Z') })
      )
    );
    expectOk(
      await repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.b, readyAt: new Date('2026-03-05T00:00:00.000Z') })
      )
    );
    expectOk(
      await repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.c, readyAt: new Date('2026-03-25T00:00:00.000Z') })
      )
    );

    const peers = await recentPeerVideos(
      db,
      OWNER_CHANNEL_ID,
      VIDEO_IDS.f,
      new Date('2026-03-20'),
      10
    );

    expect(peers.map(({ videoId }) => videoId)).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
    await engine.close();
  });
});
