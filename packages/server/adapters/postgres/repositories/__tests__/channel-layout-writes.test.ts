import * as schema from '@vp/db';
import { standardChannelLayout } from '@vp/domain';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { publishLayoutRevision, toPublishedLayout } from '../channel-layout-writes';

const USER = '00000000-0000-7000-8000-0000000000a1';
const CHANNEL = '00000000-0000-7000-8000-0000000000c1';

describe('publishLayoutRevision', () => {
  it('gives the channel its next version and reads the row back as a published layout', async () => {
    const engine = await migratedPglite();
    try {
      const db = drizzle(engine, { schema });
      await db.insert(schema.users).values({ id: USER, email: 'u@test.local' });
      await db
        .insert(schema.channels)
        .values({ id: CHANNEL, userId: USER, handle: 'u', displayName: 'U', isPrimary: true });
      const publish = (note: string) =>
        db.transaction((tx) =>
          publishLayoutRevision(tx, {
            channelId: CHANNEL,
            document: standardChannelLayout(),
            authorUserId: USER,
            note,
            restoredFromVersion: null,
            audit: null,
          })
        );

      expect((await publish('one')).version).toBe(1);
      expect((await publish('two')).version).toBe(2);

      const rows = await db.select().from(schema.entityRevisions);
      expect(rows.map((row) => toPublishedLayout(row).note).sort()).toEqual(['one', 'two']);
    } finally {
      await engine.close();
    }
  });
});
