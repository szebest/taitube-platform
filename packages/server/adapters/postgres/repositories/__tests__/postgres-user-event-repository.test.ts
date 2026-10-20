import * as schema from '@vp/db';
import { videoStatusChanged } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { OWNER_ID, VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeUserEventRepositoryContract } from '../../../__tests__/contract/user-event-repository.contract';
import { appendUserEvent } from '../postgres-user-event-repository';
import type { PostgresDatabase } from '../types';

describeUserEventRepositoryContract(postgresSubject);

describe('appendUserEvent', () => {
  it("holds the user's lock until the transaction ends, so one user's ids commit in order", async () => {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    const advisoryLocks = async (tx: PostgresDatabase) => {
      const [row] = await tx
        .select({ held: sql<number>`count(*)::int` })
        .from(sql`pg_locks`)
        .where(sql`locktype = 'advisory'`);
      return row?.held;
    };
    await db.insert(schema.users).values({ id: OWNER_ID, email: 'owner@video-pipeline.local' });

    const heldInside = await db.transaction(async (tx) => {
      await appendUserEvent(tx, { userId: OWNER_ID, ...videoStatusChanged(VIDEO_IDS.a, 'READY') });
      return advisoryLocks(tx);
    });

    expect(heldInside).toBe(1);
    expect(await advisoryLocks(db)).toBe(0);
    await engine.close();
  });
});
