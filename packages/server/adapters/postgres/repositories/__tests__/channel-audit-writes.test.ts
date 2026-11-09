import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { appendChannelAudit } from '../channel-audit-writes';

const USER_ID = '00000000-0000-7000-8000-0000000000a1';
const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';

describe('postgres: appendChannelAudit', () => {
  it('writes one row with an id and a time and reads it back as the entry', async () => {
    const engine = await migratedPglite();
    try {
      const db = drizzle(engine, { schema });
      await db.insert(schema.users).values({ id: USER_ID, email: 'u@test.local' });
      await db
        .insert(schema.channels)
        .values({ id: CHANNEL_ID, userId: USER_ID, handle: 'u', displayName: 'U' });
      const entry = {
        channelId: CHANNEL_ID,
        actorUserId: USER_ID,
        action: 'member.left',
        targetType: 'member',
        targetId: USER_ID,
        meta: { role: 'editor' },
      } as const;

      const written = await appendChannelAudit(db, entry);

      expect(written).toMatchObject(entry);
      expect(await db.select().from(schema.channelAuditLog)).toEqual([written]);
    } finally {
      await engine.close();
    }
  });
});
