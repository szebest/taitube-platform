import type { HotComments } from '@vp/core/ports';
import { type CommentSort, type CommentThread, compareThreads } from '@vp/domain';

/**
 * The author's own non-public comments on a video, added to what a page shows so their count
 * matches their list. A shared page holds public comments only, so the author's roots are merged
 * into it and their replies counted on the public roots they answer; a page read as the author
 * already lists them, and only its total moves.
 */
export function withOwnComments(
  page: HotComments,
  own: readonly CommentThread[],
  sort: CommentSort,
  shared: boolean
): HotComments {
  const total = page.total + own.length;
  if (!shared) return { ...page, total };

  const repliesTo = new Map<string, number>();
  for (const { parentId } of own) {
    if (parentId !== null) repliesTo.set(parentId, (repliesTo.get(parentId) ?? 0) + 1);
  }
  const threads = page.threads.map((thread) => ({
    ...thread,
    replyCount: thread.replyCount + (repliesTo.get(thread.id) ?? 0),
  }));
  const ownRoots = own.filter((comment) => comment.parentId === null);
  return { threads: [...threads, ...ownRoots].sort(compareThreads(sort)), total };
}
