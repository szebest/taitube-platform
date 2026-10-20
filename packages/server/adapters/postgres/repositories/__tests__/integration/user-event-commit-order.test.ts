import * as schema from '@vp/db';
import { videoStatusChanged } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { OWNER_ID, VIDEO_IDS } from '../../../../__tests__/contract/fixtures';
import { claimRealServices } from '../../../../__tests__/contract/real-services';
import { appendUserEvent, PostgresUserEventRepository } from '../../postgres-user-event-repository';
import type { PostgresDatabase } from '../../types';

async function waitsOnAdvisoryLock(db: PostgresDatabase): Promise<boolean> {
  const [row] = await db
    .select({ waiting: sql<number>`count(*)::int` })
    .from(sql`pg_locks`)
    .where(sql`locktype = 'advisory' and not granted`);
  return (row?.waiting ?? 0) > 0;
}

describe('UserEventRepository contract under concurrent appends', () => {
  let client: postgres.Sql;
  let db: PostgresDatabase;

  beforeAll(async () => {
    const services = claimRealServices();
    if (!services) throw new Error('runs only against the Postgres of the integration run');
    client = postgres(services.databaseUrl, { max: 4, onnotice: () => {} });
    db = drizzle(client, { schema });
    await db.execute(sql`TRUNCATE user_events, outbox, users RESTART IDENTITY CASCADE`);
    await db.insert(schema.users).values({ id: OWNER_ID, email: 'owner@video-pipeline.local' });
  });

  afterAll(async () => {
    await client.end({ timeout: 1 });
  });

  it("never shows a reader one user's higher id while a lower one is uncommitted", async () => {
    const userEvents = new PostgresUserEventRepository(db);
    const event = { userId: OWNER_ID, ...videoStatusChanged(VIDEO_IDS.a, 'READY') };
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    const { promise: lowerAppended, resolve: appendedLower } = Promise.withResolvers<void>();

    const lower = db.transaction(async (tx) => {
      const row = await appendUserEvent(tx, event);
      appendedLower();
      await released;
      return row;
    });

    try {
      await lowerAppended;
      let higherSettled = false;
      const higher = userEvents.append(event).finally(() => {
        higherSettled = true;
      });
      await vi.waitFor(
        async () => {
          if (!(higherSettled || (await waitsOnAdvisoryLock(db)))) {
            throw new Error('the second append neither committed nor waits on the lock');
          }
        },
        { timeout: 5_000, interval: 10 }
      );
      const seenWhileLowerOpen = expectOk(await userEvents.listFrom(OWNER_ID, 0, 10));
      release();
      const lowerRow = await lower;
      const higherRow = expectOk(await higher);

      expect(seenWhileLowerOpen).toEqual([]);
      expect(higherRow.id).toBeGreaterThan(lowerRow.id);
    } finally {
      release();
    }
  }, 10_000);
});
