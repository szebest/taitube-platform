import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { insertOwnedChannel, newChannelRow, promoteChannel } from '../channel-ownership';

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';
const PRIMARY_ID = '00000000-0000-7000-8000-0000000000c1';
const SECOND_ID = '00000000-0000-7000-8000-0000000000c2';

async function seeded() {
  const queries: string[] = [];
  const engine = await migratedPglite();
  const db = drizzle(engine, { schema, logger: { logQuery: (query) => queries.push(query) } });
  await db.insert(schema.users).values({ id: OWNER_ID, email: 'owner@test.local' });
  await db.insert(schema.channels).values([
    { id: PRIMARY_ID, userId: OWNER_ID, handle: 'primary', displayName: 'P', isPrimary: true },
    { id: SECOND_ID, userId: OWNER_ID, handle: 'second', displayName: 'S' },
  ]);
  queries.length = 0;
  return { engine, db, queries };
}

describe('postgres: newChannelRow', () => {
  it('lower-cases the handle and fills the defaults', () => {
    expect(
      newChannelRow({ id: 'c', userId: 'u', handle: 'MiXed', displayName: 'D' }, false)
    ).toEqual({
      id: 'c',
      userId: 'u',
      isPrimary: false,
      handle: 'mixed',
      displayName: 'D',
      avatarUrl: null,
      bannerUrl: null,
      brandColor: null,
      bio: null,
      subscriberCount: 0,
    });
  });
});

describe('postgres: insertOwnedChannel', () => {
  it("locks the owner's row before it counts, so racing creates count one after another", async () => {
    const { engine, db, queries } = await seeded();

    await insertOwnedChannel(db, { userId: OWNER_ID, handle: 'third', displayName: 'T' }, 5);

    const lock = queries.findIndex((query) => /from "users".*for update/i.test(query));
    const count = queries.findIndex((query) => /count\(\*\)/.test(query));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(count);
    await engine.close();
  });

  it.each([
    { limit: 2, expected: 'limit' },
    { limit: 3, expected: expect.objectContaining({ handle: 'third', isPrimary: false }) },
  ])('answers $expected at a limit of $limit for an owner of two', async ({ limit, expected }) => {
    const { engine, db } = await seeded();

    expect(
      await insertOwnedChannel(db, { userId: OWNER_ID, handle: 'Third', displayName: 'T' }, limit)
    ).toEqual(expected);
    await engine.close();
  });
});

describe('postgres: promoteChannel', () => {
  it('steps the old primary down before the new one rises', async () => {
    const { engine, db } = await seeded();

    expect(await promoteChannel(db, OWNER_ID, SECOND_ID)).toMatchObject({
      id: SECOND_ID,
      isPrimary: true,
    });
    const rows = await db.select().from(schema.channels);
    expect(rows.filter((row) => row.isPrimary).map((row) => row.id)).toEqual([SECOND_ID]);
    await engine.close();
  });

  it('answers undefined and changes nothing for a channel the user does not own', async () => {
    const { engine, db } = await seeded();

    expect(
      await promoteChannel(db, '00000000-0000-7000-8000-0000000000a9', SECOND_ID)
    ).toBeUndefined();
    const rows = await db.select().from(schema.channels);
    expect(rows.filter((row) => row.isPrimary).map((row) => row.id)).toEqual([PRIMARY_ID]);
    await engine.close();
  });
});
