import {
  type CursorPayload,
  type InvalidCursor,
  type Paginator,
  invalidCursor,
} from '@kit/pagination';
import { type Result, err, ok } from '@kit/result';
import { decodeWith } from './cursor';

export function revisionCursorPayload(revision: { version: number }): CursorPayload {
  return { version: revision.version };
}

/** The version the next page starts below; an absent cursor is the first page. */
export function decodeRevisionCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<number | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) => {
    const version = payload['version'];
    return typeof version === 'number' && Number.isInteger(version) && version >= 0
      ? ok(version)
      : err(invalidCursor());
  });
}
