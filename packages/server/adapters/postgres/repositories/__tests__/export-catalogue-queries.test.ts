import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { commentRows, videoRows } from '../export-catalogue-queries';

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';
const FAN_ID = '00000000-0000-7000-8000-0000000000a2';
const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';
const FAN_CHANNEL_ID = '00000000-0000-7000-8000-0000000000c2';
const VIDEO_ID = '00000000-0000-7000-8000-0000000000d1';
const commentId = (n: number) => `00000000-0000-7000-8000-0000000000f${n}`;
const SCOPE = { channelId: CHANNEL_ID, ownerId: OWNER_ID, range: {} };
const AT = Date.parse('2026-03-01T12:00:00.000Z');

describe('postgres: export catalogue queries', () => {
  async function seeded() {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    await db.insert(schema.users).values([
      { id: OWNER_ID, email: 'owner@test.local' },
      { id: FAN_ID, email: 'fan@test.local' },
    ]);
    await db.insert(schema.channels).values([
      { id: CHANNEL_ID, userId: OWNER_ID, handle: 'owner', displayName: 'Owner' },
      { id: FAN_CHANNEL_ID, userId: FAN_ID, handle: 'fan', displayName: 'Fan' },
    ]);
    await db.insert(schema.videos).values({
      id: VIDEO_ID,
      ownerId: OWNER_ID,
      channelId: CHANNEL_ID,
      title: 'Clip',
      sourceKey: 'raw/v/source.mp4',
      createdAt: new Date(AT),
    });
    await db.insert(schema.comments).values(
      [1, 2, 3].map((n) => ({
        id: commentId(n),
        targetType: 'video' as const,
        targetId: VIDEO_ID,
        channelId: CHANNEL_ID,
        authorId: FAN_ID,
        authorChannelId: FAN_CHANNEL_ID,
        content: `comment ${n}`,
        createdAt: new Date(AT + n * 86_400_000),
        deletedAt: n === 3 ? new Date(AT) : null,
      }))
    );
    return { engine, db };
  }

  it('reads the standing comments after a key, oldest first, each by the channel it was posted as', async () => {
    const { engine, db } = await seeded();

    const rows = await commentRows(
      db,
      SCOPE,
      { createdAt: new Date(AT + 86_400_000), id: commentId(1) },
      10
    );

    expect(rows).toEqual([
      expect.objectContaining({ commentId: commentId(2), authorHandle: 'fan', hearted: false }),
    ]);
    await engine.close();
  });

  it('keeps the last day of the range whole', async () => {
    const { engine, db } = await seeded();

    const rows = await commentRows(db, { ...SCOPE, range: { to: '2026-03-02' } }, null, 10);

    expect(rows.map(({ commentId: id }) => id)).toEqual([commentId(1)]);
    await engine.close();
  });

  it('reads the owner videos with their category slug, or none', async () => {
    const { engine, db } = await seeded();

    const rows = await videoRows(db, SCOPE, null, 10);

    expect(rows).toEqual([
      expect.objectContaining({
        videoId: VIDEO_ID,
        category: null,
        createdAt: new Date(AT).toISOString(),
      }),
    ]);
    await engine.close();
  });
});
