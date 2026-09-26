import type {
  SearchCursor,
  SearchMode,
  SearchPosition,
  SearchResultKind,
  SearchSort,
} from '@vp/domain';
import {
  type CursorPayload,
  type InvalidCursor,
  type Paginator,
  invalidCursor,
} from '@vp/pagination';
import { type Result, andThen, err, ok } from '@vp/result';

const MODES: readonly SearchMode[] = ['lexical', 'fuzzy'];
const KINDS: readonly SearchResultKind[] = ['video', 'channel', 'playlist'];

export interface SearchWalk {
  sort: SearchSort;
  mode: SearchMode;
  instant: number;
}

/** The last position of the page plus the walk it belongs to: its sort, its mode and its clock. */
export function searchCursorPayload(last: SearchPosition, walk: SearchWalk): CursorPayload {
  return { ...walk, key: last.key, kind: last.kind, id: last.id };
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return values.some((candidate) => candidate === value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A cursor names its sort and is refused under another, as a relevance score resumes nothing in a
 * walk ordered by date. An absent cursor is the first page, `ok(null)`.
 */
export function decodeSearchCursor(
  cursor: string | undefined,
  sort: SearchSort,
  paginator: Paginator
): Result<SearchCursor | null, InvalidCursor> {
  return andThen(
    paginator.decodeCursor(cursor),
    (payload): Result<SearchCursor | null, InvalidCursor> => {
      if (payload === null) return ok(null);
      const { mode, instant, key, kind, id } = payload;
      if (payload['sort'] !== sort) return err(invalidCursor());
      if (!(oneOf(MODES, mode) && oneOf(KINDS, kind))) return err(invalidCursor());
      if (!(isFiniteNumber(instant) && isFiniteNumber(key) && typeof id === 'string')) {
        return err(invalidCursor());
      }
      return ok({ sort, mode, instant, key, kind, id });
    }
  );
}
