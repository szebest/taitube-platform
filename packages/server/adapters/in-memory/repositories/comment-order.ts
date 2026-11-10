import type { CommentThreadCursor, CommentWindow } from '@vp/core/repositories';
import type { CommentSort } from '@vp/domain';
import { assertNever } from '@vp/result';

export type SortKey = readonly (number | string)[];

/** The order every comment listing shares: when it was written, then its id. */
export const rowKey = (row: { createdAt: Date; id: string }): SortKey => [
  row.createdAt.getTime(),
  row.id,
];

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

/** One page of `roots`, already in descending order, up to one row past the limit. */
export function threadPage<T extends CommentThreadCursor>(
  roots: readonly T[],
  sort: CommentSort,
  window: CommentWindow
): T[] {
  switch (window.type) {
    case 'keyset': {
      const { cursor } = window;
      const after = cursor
        ? roots.filter(
            (row) => compareKeys(commentSortKey(sort, row), commentSortKey(sort, cursor)) < 0
          )
        : roots;
      return after.slice(0, window.limit + 1);
    }
    case 'offset':
      return roots.slice(window.offset, window.offset + window.limit + 1);
    default:
      return assertNever(window, 'CommentWindow');
  }
}

/** The rows after `cursor` in newest-first order, which `rows` already is. */
export function newestAfter<T extends { createdAt: Date; id: string }>(
  rows: readonly T[],
  cursor: { createdAt: Date; id: string } | null
): T[] {
  return cursor ? rows.filter((row) => compareKeys(rowKey(row), rowKey(cursor)) < 0) : [...rows];
}
