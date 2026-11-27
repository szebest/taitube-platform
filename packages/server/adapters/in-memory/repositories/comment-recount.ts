import type { CommentTarget } from '@vp/domain';
import { isVisibleTo, type PublicScopeContext } from './comment-public-scope';
import { sameTarget, setCommentsCount, type CommentTargetStores } from './comment-targets';
import { standing, type StoredComment } from './comment-visibility';

/**
 * The targets of the channel the user commented on, each with `commentsCount` set to what an
 * anonymous reader sees: the in-memory form of the postgres recount a restriction runs.
 */
export async function recountAuthored(
  stores: CommentTargetStores,
  comments: ReadonlyMap<string, StoredComment>,
  channelId: string,
  userId: string,
  scope: PublicScopeContext
): Promise<CommentTarget[]> {
  const live = standing(comments.values()).filter((row) => row.channelId === channelId);
  const touched: CommentTarget[] = [];
  for (const row of live) {
    if (row.authorId === userId && !touched.some((target) => sameTarget(target, row.target))) {
      touched.push(row.target);
    }
  }
  for (const target of touched) {
    const counted = live.filter(
      (row) => sameTarget(row.target, target) && isVisibleTo(null, row, scope)
    ).length;
    await setCommentsCount(stores, target, counted);
  }
  return touched.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}
