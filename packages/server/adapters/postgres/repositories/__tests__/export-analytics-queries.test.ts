import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { channelDayRows, retentionRows, videoDailyRows } from '../export-analytics-queries';

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';
const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';
const VIDEO_ID = '00000000-0000-7000-8000-0000000000d1';
const SCOPE = { channelId: CHANNEL_ID, ownerId: OWNER_ID, range: {} };

describe('postgres: export analytics queries', () => {
  async function seeded() {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    await db.insert(schema.users).values({ id: OWNER_ID, email: 'owner@test.local' });
    await db
      .insert(schema.channels)
      .values({ id: CHANNEL_ID, userId: OWNER_ID, handle: 'owner', displayName: 'Owner' });
    await db
      .insert(schema.videos)
      .values({ id: VIDEO_ID, ownerId: OWNER_ID, title: 'Clip', sourceKey: 'raw/v/source.mp4' });
    await db.insert(schema.videoViewsDaily).values(
      ['2026-03-01', '2026-03-02', '2026-03-03'].map((viewDate, n) => ({
        videoId: VIDEO_ID,
        viewDate,
        views: n + 1,
        watchSeconds: 10,
      }))
    );
    await db
      .insert(schema.videoRetentionMilestones)
      .values([0, 5, 10].map((percent) => ({ videoId: VIDEO_ID, percent, viewers: 3 })));
    await db.insert(schema.subscriptionEvents).values([
      {
        id: '00000000-0000-7000-8000-0000000000e1',
        channelId: CHANNEL_ID,
        delta: 1,
        occurredAt: new Date('2026-03-02T10:00:00Z'),
      },
      {
        id: '00000000-0000-7000-8000-0000000000e2',
        channelId: CHANNEL_ID,
        delta: -1,
        occurredAt: new Date('2026-03-05T23:59:59Z'),
      },
    ]);
    return { engine, db };
  }

  it('reads the daily rows after a key, in video and day order', async () => {
    const { engine, db } = await seeded();

    const rows = await videoDailyRows(db, SCOPE, { videoId: VIDEO_ID, day: '2026-03-01' }, 10);

    expect(rows.map(({ day, views }) => [day, views])).toEqual([
      ['2026-03-02', 2],
      ['2026-03-03', 3],
    ]);
    await engine.close();
  });

  it('reads the retention steps after a key, the numeric step compared as a number', async () => {
    const { engine, db } = await seeded();

    const rows = await retentionRows(db, SCOPE, { videoId: VIDEO_ID, percent: 5 }, 10);

    expect(rows.map(({ percent }) => percent)).toEqual([10]);
    await engine.close();
  });

  it('joins views and subscriber changes on their UTC day, narrowed to the range', async () => {
    const { engine, db } = await seeded();

    const rows = await channelDayRows(db, { ...SCOPE, range: { from: '2026-03-02' } }, null, 10);

    expect(rows).toEqual([
      { day: '2026-03-02', views: 2, watchSeconds: 10, subscribersGained: 1, subscribersLost: 0 },
      { day: '2026-03-03', views: 3, watchSeconds: 10, subscribersGained: 0, subscribersLost: 0 },
      { day: '2026-03-05', views: 0, watchSeconds: 0, subscribersGained: 0, subscribersLost: 1 },
    ]);
    await engine.close();
  });
});
