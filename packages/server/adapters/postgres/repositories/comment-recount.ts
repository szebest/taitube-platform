import * as schema from '@vp/db';
import { and, eq } from 'drizzle-orm';
import { notDeletedScope } from '../scopes/index';
import { countedAmong, lockVideo } from './comment-writes';
import type { PostgresDatabase } from './types';

const { videoComments: c, videos: v } = schema;

/**
 * A shadow ban moves what is public across every video the user commented on, so each of the
 * channel's videos they appear on is counted again, exactly, under its own lock.
 */
export async function recountAuthored(
  tx: PostgresDatabase,
  channelId: string,
  userId: string
): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ id: v.id })
    .from(c)
    .innerJoin(v, eq(v.id, c.videoId))
    .where(and(eq(v.channelId, channelId), eq(c.authorId, userId), notDeletedScope(c)))
    .orderBy(v.id);

  for (const { id } of rows) {
    await lockVideo(tx, id);
    const commentsCount = await countedAmong(tx, eq(c.videoId, id));
    await tx.update(v).set({ commentsCount }).where(eq(v.id, id));
  }
  return rows.map(({ id }) => id);
}
