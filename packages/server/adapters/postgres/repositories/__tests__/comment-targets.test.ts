import { assertNever } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import * as schema from '@vp/db';
import type { CommentTarget } from '@vp/domain';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import {
  OWNER_CHANNEL_ID,
  OWNER_ID,
  publicVideo,
  seedOwners,
  VIDEO_IDS,
  videoTarget,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import {
  lockTarget,
  moveCommentsCount,
  onTarget,
  setCommentsCount,
  targetOf,
} from '../comment-targets';
import { PostgresRepositories } from '../postgres-repositories';

const POST_ID = '00000000-0000-7000-8000-0000000007a1';
const MISSING_ID = '00000000-0000-7000-8000-0000000007a2';
const THREAD_ID = '00000000-0000-7000-8000-0000000007a3';

async function seeded() {
  const engine = await migratedPglite();
  const db = drizzle(engine, { schema });
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  await seedOwners(repositories);
  expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a, title: 'Clip' })));
  await db.insert(schema.channelPosts).values({
    id: POST_ID,
    channelId: OWNER_CHANNEL_ID,
    authorUserId: OWNER_ID,
    kind: 'text',
    payload: { kind: 'text', text: 'hello' },
    status: 'published',
    publishedAt: new Date(),
  });
  await db.insert(schema.videoThreads).values({
    id: THREAD_ID,
    videoId: VIDEO_IDS.a,
    channelId: OWNER_CHANNEL_ID,
    authorId: OWNER_ID,
    authorChannelId: OWNER_CHANNEL_ID,
    anchorMs: 0,
    title: 'Intro',
    body: '',
  });
  const countOf = async (target: CommentTarget) => {
    switch (target.type) {
      case 'video': {
        const [row] = await db.select().from(schema.videos).where(eq(schema.videos.id, target.id));
        return row?.commentsCount;
      }
      case 'post': {
        const [row] = await db
          .select()
          .from(schema.channelPosts)
          .where(eq(schema.channelPosts.id, target.id));
        return row?.commentsCount;
      }
      case 'thread': {
        const [row] = await db
          .select()
          .from(schema.videoThreads)
          .where(eq(schema.videoThreads.id, target.id));
        return row?.commentsCount;
      }
      default:
        return assertNever(target, 'CommentTarget');
    }
  };
  return { db, engine, countOf };
}

const POST = { type: 'post', id: POST_ID } as const;
const THREAD = { type: 'thread', id: THREAD_ID } as const;

describe('adapters/postgres: comment targets', () => {
  it.each([
    {
      scenario: 'a video, with its owner and title',
      target: videoTarget(VIDEO_IDS.a),
      expected: { type: 'video', ownerId: OWNER_ID, title: 'Clip' },
    },
    {
      scenario: 'a post, with the owner of its channel',
      target: POST,
      expected: { type: 'post', ownerId: OWNER_ID },
    },
    {
      scenario: 'a thread, with the owner of its video',
      target: THREAD,
      expected: { type: 'thread', ownerId: OWNER_ID, videoId: VIDEO_IDS.a },
    },
    { scenario: 'a missing video', target: videoTarget(MISSING_ID), expected: undefined },
    { scenario: 'a missing post', target: { type: 'post', id: MISSING_ID }, expected: undefined },
  ] as const)('locks $scenario', async ({ target, expected }) => {
    const { db, engine } = await seeded();

    expect(await lockTarget(db, target)).toEqual(expected);
    await engine.close();
  });

  it.each([
    { scenario: 'a video', target: videoTarget(VIDEO_IDS.a) },
    { scenario: 'a post', target: POST },
    { scenario: 'a thread', target: THREAD },
  ] as const)('moves and sets the count of $scenario', async ({ target }) => {
    const { db, engine, countOf } = await seeded();

    await moveCommentsCount(db, target, 3);
    await moveCommentsCount(db, target, -1);
    const moved = await countOf(target);
    await moveCommentsCount(db, target, 0);
    await setCommentsCount(db, target, 9);

    expect([moved, await countOf(target)]).toEqual([2, 9]);
    await engine.close();
  });

  it('round-trips a target through its columns', () => {
    expect(targetOf({ targetType: 'post', targetId: POST_ID })).toEqual(POST);
    expect(onTarget(POST)).toBeDefined();
  });
});
