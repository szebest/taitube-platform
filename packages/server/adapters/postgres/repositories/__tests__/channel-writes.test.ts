import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { channelPatch, claimHandle } from '../channel-writes';

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';
const OTHER_ID = '00000000-0000-7000-8000-0000000000a2';
const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-0000000000c2';
const AT = new Date('2026-03-01T00:00:00.000Z');

describe('postgres: channelPatch', () => {
  it('sets only the fields the edit names, and always the update time', () => {
    expect(Object.keys(channelPatch({ displayName: 'New', country: null }))).toEqual([
      'updatedAt',
      'displayName',
      'country',
    ]);
  });

  it('leaves the handle to claimHandle', () => {
    expect(channelPatch({ handle: 'new', handleChangedAt: AT })).not.toHaveProperty('handle');
  });
});

describe('postgres: claimHandle', () => {
  async function seeded() {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    await db
      .insert(schema.users)
      .values([OWNER_ID, OTHER_ID].map((id) => ({ id, email: `${id}@test.local` })));
    await db.insert(schema.channels).values([
      { id: CHANNEL_ID, userId: OWNER_ID, handle: 'owner', displayName: 'Owner' },
      { id: OTHER_CHANNEL_ID, userId: OTHER_ID, handle: 'other', displayName: 'Other' },
    ]);
    return { engine, db };
  }

  it.each([
    {
      scenario: 'a handle another channel holds',
      handle: 'other',
      expected: 'taken',
    },
    {
      scenario: 'the handle the channel already has',
      handle: 'owner',
      expected: { handle: 'owner' },
    },
    {
      scenario: 'a free handle',
      handle: 'fresh',
      expected: { handle: 'fresh', handleChangedAt: AT },
    },
  ])('answers $expected for $scenario', async ({ handle, expected }) => {
    const { engine, db } = await seeded();
    try {
      expect(await claimHandle(db, CHANNEL_ID, handle, AT)).toEqual(expected);
    } finally {
      await engine.close();
    }
  });

  it('retires the handle it leaves, and frees the one it takes back', async () => {
    const { engine, db } = await seeded();
    try {
      await claimHandle(db, CHANNEL_ID, 'fresh', AT);
      expect(await db.select().from(schema.channelHandleHistory)).toMatchObject([
        { handle: 'owner', channelId: CHANNEL_ID, retiredAt: AT },
      ]);

      await db
        .update(schema.channels)
        .set({ handle: 'fresh' })
        .where(eq(schema.channels.id, CHANNEL_ID));
      await claimHandle(db, CHANNEL_ID, 'owner', AT);
      expect(
        (await db.select().from(schema.channelHandleHistory)).map(({ handle }) => handle)
      ).toEqual(['fresh']);
    } finally {
      await engine.close();
    }
  });
});
