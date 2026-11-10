import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { drizzle } from 'drizzle-orm/pglite';
import {
  OTHER_OWNER_ID,
  OWNER_ID,
  publicVideo,
  seedOwners,
  VIDEO_IDS,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { recountAuthored } from '../comment-recount';
import { PostgresRepositories } from '../postgres-repositories';

const COMMENT_ID = '00000000-0000-7000-8000-0000000005c1';

describe('adapters/postgres: recountAuthored', () => {
  it('sets the count of every video of the channel the user commented on, and names them', async () => {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    const repositories = new PostgresRepositories({ type: 'drizzle', db });
    await seedOwners(repositories);
    const channel = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a })));
    expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.b })));
    expectOk(
      await repositories.comments.create({
        id: COMMENT_ID,
        videoId: VIDEO_IDS.a,
        authorId: OTHER_OWNER_ID,
        parentId: null,
        content: 'hello',
      })
    );
    await db.update(schema.videos).set({ commentsCount: 7 });

    const touched = await recountAuthored(db, channel.id, OTHER_OWNER_ID);

    expect(touched).toEqual([VIDEO_IDS.a]);
    expect(expectOk(await repositories.videos.findById(VIDEO_IDS.a))?.commentsCount).toBe(1);
    expect(expectOk(await repositories.videos.findById(VIDEO_IDS.b))?.commentsCount).toBe(7);
    await engine.close();
  });
});
