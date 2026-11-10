import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { drizzle } from 'drizzle-orm/pglite';
import {
  OWNER_ID,
  OTHER_OWNER_ID,
  publicVideo,
  seedOwners,
  VIDEO_IDS,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { insertComment, isLive, lockVideo } from '../comment-writes';
import { PostgresRepositories } from '../postgres-repositories';

const ROOT_ID = '00000000-0000-7000-8000-0000000005a1';
const REPLY_ID = '00000000-0000-7000-8000-0000000005a2';
const GONE_ID = '00000000-0000-7000-8000-0000000005a3';

async function seeded() {
  const engine = await migratedPglite();
  const db = drizzle(engine, { schema });
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  await seedOwners(repositories);
  expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a })));
  return { db, engine, repositories };
}

const comment = (id: string, parentId: string | null) => ({
  id,
  videoId: VIDEO_IDS.a,
  authorId: OTHER_OWNER_ID,
  parentId,
  content: 'hello',
});

describe('adapters/postgres: comment writes', () => {
  it('locks the video and answers its owner, or nothing for a missing one', async () => {
    const { db, engine } = await seeded();

    expect(await lockVideo(db, VIDEO_IDS.a)).toMatchObject({ ownerId: OWNER_ID });
    expect(await lockVideo(db, VIDEO_IDS.b)).toBeUndefined();
    await engine.close();
  });

  it('inserts a comment, counts it and refuses a reply to a parent that is not there', async () => {
    const { db, engine, repositories } = await seeded();

    expect(await insertComment(db, comment(ROOT_ID, null))).toMatchObject({ id: ROOT_ID });
    expect(await insertComment(db, comment(REPLY_ID, GONE_ID))).toBeNull();
    expect(expectOk(await repositories.videos.findById(VIDEO_IDS.a))?.commentsCount).toBe(1);
    expect(await isLive(db, ROOT_ID)).toBe(true);
    expect(await isLive(db, GONE_ID)).toBe(false);
    await engine.close();
  });
});
