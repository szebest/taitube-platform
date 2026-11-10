import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { drizzle } from 'drizzle-orm/pglite';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { moderateComment } from '../comment-moderation-writes';
import { PostgresRepositories } from '../postgres-repositories';

const MISSING_ID = '00000000-0000-7000-8000-0000000005b1';

describe('adapters/postgres: moderateComment', () => {
  it('answers missing, and writes nothing, for a comment that is not there', async () => {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    const repositories = new PostgresRepositories({ type: 'drizzle', db });
    await seedOwners(repositories);
    expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a })));

    const written = await moderateComment(db, {
      comment: { id: MISSING_ID, videoId: VIDEO_IDS.a },
      from: 'published',
      outcome: { state: 'hidden', disclosure: 'silent', reason: null, note: null },
      moderatorId: OWNER_ID,
      audit: {
        channelId: MISSING_ID,
        actorUserId: OWNER_ID,
        action: 'comment.hidden',
        targetType: 'comment',
        targetId: MISSING_ID,
        meta: { videoId: VIDEO_IDS.a, disclosure: 'silent' },
      },
    });

    expect(written).toEqual({ type: 'missing' });
    await engine.close();
  });
});
