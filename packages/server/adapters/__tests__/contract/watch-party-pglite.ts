import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { PostgresRepositories } from '../../postgres/repositories/postgres-repositories';
import { publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import { migratedPglite } from './pglite-snapshot';
import { roomSeed } from './watch-party-fixtures';

/** A migrated PGlite holding the two accounts and two videos; `reset` leaves one room with both videos queued. */
export async function setUpWatchPartyDatabase() {
  const engine = await migratedPglite();
  const db = drizzle(engine, { schema });
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  await seedOwners(repositories);
  for (const id of [VIDEO_IDS.a, VIDEO_IDS.b]) {
    expectOk(await repositories.videos.create(publicVideo({ id })));
  }
  return {
    db,
    reset: async () => {
      await db.execute(sql`TRUNCATE watch_party_rooms CASCADE`);
      expectOk(
        await repositories.watchPartyRooms.create(
          roomSeed({ videoIds: [VIDEO_IDS.a, VIDEO_IDS.b] })
        )
      );
    },
    close: () => engine.close(),
  };
}
