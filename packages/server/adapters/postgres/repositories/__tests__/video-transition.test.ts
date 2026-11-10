import * as schema from '@vp/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { OWNER_ID, seedOwners, VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { PostgresRepositories } from '../postgres-repositories';
import { commitVideoTransition } from '../video-transition';

async function seeded() {
  const db = drizzle(await migratedPglite(), { schema });
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  await seedOwners(repositories);
  await repositories.videos.create({
    id: VIDEO_IDS.a,
    ownerId: OWNER_ID,
    sourceKey: 'raw/a/source.mp4',
    status: 'PROCESSING',
  });
  return db;
}

const events = (db: Awaited<ReturnType<typeof seeded>>) =>
  db.select().from(schema.videoEvents).where(eq(schema.videoEvents.videoId, VIDEO_IDS.a));

describe('commitVideoTransition', () => {
  it('commits the status, its event and the owner announcement together', async () => {
    const db = await seeded();

    const committed = await db.transaction((tx) =>
      commitVideoTransition(tx, {
        videoId: VIDEO_IDS.a,
        from: 'PROCESSING',
        to: 'HELD',
        eventType: 'video.held',
      })
    );

    expect(committed).toBe(true);
    expect((await events(db)).map((event) => event.type)).toEqual(['video.held']);
    expect(await db.select().from(schema.userEvents)).toHaveLength(1);
  });

  it('writes nothing when the status moved on, and rolls back with its transaction', async () => {
    const db = await seeded();
    const hold = (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) =>
      commitVideoTransition(tx, {
        videoId: VIDEO_IDS.a,
        from: 'PROCESSING',
        to: 'HELD',
        eventType: 'video.held',
      });

    await expect(
      db.transaction(async (tx) => {
        await hold(tx);
        throw new Error('later step failed');
      })
    ).rejects.toThrow('later step failed');
    expect(await events(db)).toEqual([]);

    expect(await db.transaction(hold)).toBe(true);
    expect(await db.transaction(hold)).toBe(false);
    expect(await events(db)).toHaveLength(1);
  });
});
