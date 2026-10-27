import type { CommentThreadCursor } from '@vp/core/repositories';
import type { CommentSort } from '@vp/domain';
import { assertNever } from '@vp/result';

export type SortKey = readonly (number | string)[];

export function commentSortKey(sort: CommentSort, row: CommentThreadCursor): SortKey {
  const pinned = row.isPinned ? 1 : 0;
  switch (sort) {
    case 'top':
      return [pinned, row.likeCount, row.createdAt.getTime(), row.id];
    case 'newest':
      return [pinned, row.createdAt.getTime(), row.id];
    default:
      return assertNever(sort, 'CommentSort');
  }
}

export function compareKeys(a: SortKey, b: SortKey): number {
  for (let i = 0; i < a.length; i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}
