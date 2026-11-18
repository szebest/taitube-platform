import type { NewEntityRevision } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { VideoMetadataSnapshot } from '@vp/domain';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import {
  appendEntityRevision,
  replaceChapters,
  selectChapters,
  toEntityRevision,
} from '../video-revision-writes';

const USER_ID = '00000000-0000-7000-8000-0000000000a1';
const VIDEO_ID = '00000000-0000-7000-8000-0000000000b1';

const snapshot: VideoMetadataSnapshot = {
  title: 'T',
  description: null,
  tags: [],
  categoryId: null,
  visibility: 'public',
  thumbnail: { source: 'poster' },
  chapters: [],
  commentsEnabled: true,
};

async function inEngine(run: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<void>) {
  const engine = await migratedPglite();
  try {
    const db = drizzle(engine, { schema });
    await db.insert(schema.users).values({ id: USER_ID, email: 'u@test.local' });
    await db.insert(schema.videos).values({
      id: VIDEO_ID,
      ownerId: USER_ID,
      title: 'T',
      status: 'READY',
      visibility: 'public',
      sourceKey: 'raw/a.mp4',
    });
    await run(db);
  } finally {
    await engine.close();
  }
}

describe('postgres: video revision writes', () => {
  it('appends a revision once per version and reads it back as an entity revision', async () => {
    await inEngine(async (db) => {
      const revision: NewEntityRevision = {
        entityType: 'video_metadata',
        entityId: VIDEO_ID,
        version: 2,
        snapshot,
        authorUserId: USER_ID,
        note: null,
      };

      await appendEntityRevision(db, revision);
      await appendEntityRevision(db, { ...revision, note: 'again' });

      const rows = await db.select().from(schema.entityRevisions);
      expect(rows.map(toEntityRevision)).toMatchObject([{ version: 2, note: null, snapshot }]);
    });
  });

  it('replaces the chapters of one video in the order given and reads them back', async () => {
    await inEngine(async (db) => {
      await replaceChapters(db, VIDEO_ID, [
        { startMs: 0, title: 'A' },
        { startMs: 30_000, title: 'B' },
      ]);
      await replaceChapters(db, VIDEO_ID, [{ startMs: 5_000, title: 'C' }]);

      expect(await selectChapters(db, VIDEO_ID)).toEqual([{ startMs: 5_000, title: 'C' }]);
      await replaceChapters(db, VIDEO_ID, []);
      expect(await selectChapters(db, VIDEO_ID)).toEqual([]);
    });
  });
});
