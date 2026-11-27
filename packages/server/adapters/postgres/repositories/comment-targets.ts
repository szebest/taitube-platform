import { assertNever } from '@kit/result';
import * as schema from '@vp/db';
import type { CommentTarget } from '@vp/domain';
import { type SQL, eq, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { PostgresDatabase } from './types';

const { comments: c, videos: v, channelPosts: p, channels: ch } = schema;

/** The target row a comment write locked, with what telling its owner needs. */
export type LockedTarget =
  | { type: 'video'; ownerId: string; title: string }
  | { type: 'post'; ownerId: string };

interface TargetColumns {
  targetType: AnyPgColumn;
  targetId: AnyPgColumn;
}

export function targetOf(row: {
  targetType: CommentTarget['type'];
  targetId: string;
}): CommentTarget {
  return { type: row.targetType, id: row.targetId };
}

export function onTarget(target: CommentTarget, table: TargetColumns = c): SQL {
  return sql`(${table.targetType} = ${target.type} and ${table.targetId} = ${target.id})`;
}

/** The same target as another comment row: a reply and its root, a comment and its thread. */
export function sameTarget(left: TargetColumns, right: TargetColumns): SQL {
  return sql`${left.targetType} = ${right.targetType} and ${left.targetId} = ${right.targetId}`;
}

/**
 * Every write that adds, removes or pins a comment takes the target row first, so a reply cannot
 * commit under a root whose removal is already running, and two pins cannot interleave.
 */
export async function lockTarget(
  tx: PostgresDatabase,
  target: CommentTarget
): Promise<LockedTarget | undefined> {
  switch (target.type) {
    case 'video': {
      const [video] = await tx
        .select({ ownerId: v.ownerId, title: v.title })
        .from(v)
        .where(eq(v.id, target.id))
        .for('update');
      return video && { type: 'video', ...video };
    }
    case 'post': {
      const [post] = await tx
        .select({ ownerId: ch.userId })
        .from(p)
        .innerJoin(ch, eq(ch.id, p.channelId))
        .where(eq(p.id, target.id))
        .for('update', { of: p });
      return post && { type: 'post', ...post };
    }
    default:
      return assertNever(target, 'CommentTarget');
  }
}

/** Moves the target's public `comments_count` by `delta`. */
export async function moveCommentsCount(
  tx: PostgresDatabase,
  target: CommentTarget,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  switch (target.type) {
    case 'video':
      await tx
        .update(v)
        .set({ commentsCount: sql`${v.commentsCount} + ${delta}` })
        .where(eq(v.id, target.id));
      return;
    case 'post':
      await tx
        .update(p)
        .set({ commentsCount: sql`${p.commentsCount} + ${delta}` })
        .where(eq(p.id, target.id));
      return;
    default:
      return assertNever(target, 'CommentTarget');
  }
}

/** Sets the target's public `comments_count` to what a recount found. */
export async function setCommentsCount(
  tx: PostgresDatabase,
  target: CommentTarget,
  commentsCount: number
): Promise<void> {
  switch (target.type) {
    case 'video':
      await tx.update(v).set({ commentsCount }).where(eq(v.id, target.id));
      return;
    case 'post':
      await tx.update(p).set({ commentsCount }).where(eq(p.id, target.id));
      return;
    default:
      return assertNever(target, 'CommentTarget');
  }
}
