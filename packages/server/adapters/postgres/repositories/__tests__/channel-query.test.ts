import type { PGlite } from '@electric-sql/pglite';
import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { channelColumns, toChannel } from '../channel-query';
import type { PostgresDatabase } from '../types';

const OWNER = '00000000-0000-7000-8000-000000000101';
const OTHER = '00000000-0000-7000-8000-000000000102';
const CHANNELS = {
  [OWNER]: '00000000-0000-7000-8000-000000000301',
  [OTHER]: '00000000-0000-7000-8000-000000000302',
};

describe('adapters/postgres: channel query', () => {
  let engine: PGlite;
  let db: PostgresDatabase;

  beforeAll(async () => {
    engine = await migratedPglite();
    db = drizzle(engine, { schema });
    await db.insert(schema.users).values([
      { id: OWNER, email: 'owner@x.local' },
      { id: OTHER, email: 'other@x.local' },
    ]);
    await db.insert(schema.channels).values([
      { id: CHANNELS[OWNER], userId: OWNER, handle: 'owner', displayName: 'Owner' },
      { id: CHANNELS[OTHER], userId: OTHER, handle: 'other', displayName: 'Other' },
    ]);
    const video = (
      n: number,
      ownerId: string,
      overrides: Partial<typeof schema.videos.$inferInsert>
    ) => ({
      id: `00000000-0000-7000-8000-0000000000${n}0`,
      ownerId,
      sourceKey: `raw/${n}/source.mp4`,
      status: 'READY' as const,
      visibility: 'public' as const,
      viewsCount: 10,
      ...overrides,
    });
    await db
      .insert(schema.videos)
      .values([
        video(1, OWNER, {}),
        video(2, OWNER, { viewsCount: 5 }),
        video(3, OWNER, { visibility: 'private' }),
        video(4, OWNER, { status: 'PROCESSING' }),
        video(5, OWNER, { deletedAt: new Date() }),
        video(6, OTHER, { viewsCount: 100 }),
      ]);
  });

  afterAll(async () => {
    await engine.close();
  });

  it('counts, per channel and in the statement that reads it, what the public feed shows of its owner', async () => {
    const rows = await db.select(channelColumns).from(schema.channels);

    expect(
      Object.fromEntries(rows.map((row) => [row.handle, [row.videoCount, row.totalViews]]))
    ).toEqual({ owner: [2, 15], other: [1, 100] });
  });

  it('reads a channel row as the domain channel', async () => {
    const [row] = await db
      .select(channelColumns)
      .from(schema.channels)
      .where(eq(schema.channels.id, CHANNELS[OWNER]));

    expect(row && toChannel(row)).toMatchObject({
      id: CHANNELS[OWNER],
      handle: 'owner',
      links: [],
      videoCount: 2,
      totalViews: 15,
    });
  });
});
