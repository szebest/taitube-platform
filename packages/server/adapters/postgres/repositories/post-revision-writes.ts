import type { ChannelPostRevisionAuthor } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { and, eq } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { appendEntityRevision } from './video-revision-writes';

const { entityRevisions: er, channelPosts: p } = schema;

type PostRow = typeof p.$inferSelect;

/**
 * The state after an edit of a published post, preceded by the state before it when the post has no
 * history yet, so the first edit can be undone too.
 */
export async function appendPostRevisions(
  tx: PostgresDatabase,
  edit: { before: PostRow; after: PostRow; author: ChannelPostRevisionAuthor }
): Promise<void> {
  const { before, after, author } = edit;
  const [recorded] = await tx
    .select({ id: er.id })
    .from(er)
    .where(and(eq(er.entityType, 'channel_post'), eq(er.entityId, after.id)))
    .limit(1);
  if (!recorded) {
    await appendEntityRevision(tx, {
      entityType: 'channel_post',
      entityId: before.id,
      version: before.version,
      snapshot: { payload: before.payload },
      authorUserId: null,
      restoredFromVersion: null,
    });
  }
  await appendEntityRevision(tx, {
    entityType: 'channel_post',
    entityId: after.id,
    version: after.version,
    snapshot: { payload: after.payload },
    authorUserId: author.authorUserId,
    restoredFromVersion: author.restoredFromVersion,
  });
}
