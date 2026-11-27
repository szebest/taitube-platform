import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import { VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { AT, lineAt, lineId, ROOM_ID } from '../../../__tests__/contract/watch-party-fixtures';
import { setUpWatchPartyDatabase } from '../../../__tests__/contract/watch-party-pglite';
import { bumpQueueVersion, bumpRolesVersion, insertSystemLine } from '../watch-party-writes';

const UNKNOWN_ROOM_ID = '00000000-0000-7000-8000-00000000e0ff';

describe('watch party write helpers', () => {
  let database: Awaited<ReturnType<typeof setUpWatchPartyDatabase>>;
  const room = async () => {
    const [row] = await database.db
      .select()
      .from(schema.watchPartyRooms)
      .where(eq(schema.watchPartyRooms.id, ROOM_ID));
    return row;
  };

  beforeAll(async () => {
    database = await setUpWatchPartyDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.reset();
  });

  it('stores a system line with no author, carrying its event and place', async () => {
    await insertSystemLine(database.db, ROOM_ID, {
      ...lineAt(1),
      videoId: VIDEO_IDS.a,
      positionMs: 4_000,
    });

    const [stored] = await database.db.select().from(schema.watchPartyMessages);

    expect(stored).toMatchObject({
      id: lineId(1),
      roomId: ROOM_ID,
      authorKey: null,
      kind: 'system',
      system: { event: 'settings_changed' },
      videoId: VIDEO_IDS.a,
      positionMs: 4_000,
      createdAt: AT,
    });
  });

  it.each([
    { scenario: 'a room that exists', roomId: ROOM_ID, rolesVersion: 1 },
    { scenario: 'a room that is gone', roomId: UNKNOWN_ROOM_ID, rolesVersion: null },
  ])('bumps the roles version of $scenario', async ({ roomId, rolesVersion }) => {
    expect(await bumpRolesVersion(database.db, roomId, AT)).toBe(rolesVersion);
  });

  it('recounts the queue without removed items and bumps its version', async () => {
    await database.db
      .update(schema.watchPartyQueueItems)
      .set({ removedAt: AT })
      .where(eq(schema.watchPartyQueueItems.videoId, VIDEO_IDS.b));

    expect(await bumpQueueVersion(database.db, ROOM_ID)).toBe(1);
    expect(await room()).toMatchObject({ queueLength: 1, queueVersion: 1 });
    expect(await bumpQueueVersion(database.db, UNKNOWN_ROOM_ID)).toBeNull();
  });
});
