import * as schema from '@vp/db';
import type { CommentTarget } from '@vp/domain';
import { and, eq } from 'drizzle-orm';
import { notDeletedScope } from '../scopes/index';
import { lockTarget, onTarget, setCommentsCount, targetOf } from './comment-targets';
import { countedAmong } from './comment-writes';
import type { PostgresDatabase } from './types';

const { comments: c } = schema;

/**
 * A shadow ban moves what is public across everything of the channel the user commented on, so
 * each target they appear on is counted again, exactly, under its own lock.
 */
export async function recountAuthored(
  tx: PostgresDatabase,
  channelId: string,
  userId: string
): Promise<CommentTarget[]> {
  const rows = await tx
    .selectDistinct({ targetType: c.targetType, targetId: c.targetId })
    .from(c)
    .where(and(eq(c.channelId, channelId), eq(c.authorId, userId), notDeletedScope(c)))
    .orderBy(c.targetType, c.targetId);

  const targets = rows.map(targetOf);
  for (const target of targets) {
    await lockTarget(tx, target);
    await setCommentsCount(tx, target, await countedAmong(tx, onTarget(target)));
  }
  return targets;
}
