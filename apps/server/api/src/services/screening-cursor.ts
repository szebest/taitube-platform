import type { ScreeningCaseCursor } from '@vp/core/repositories';
import { type VideoScreening, isScreeningCaseOpen } from '@vp/domain';
import type { CursorPayload, InvalidCursor, Paginator } from '@vp/pagination';
import { type Result, andThen, ok } from '@vp/result';
import { asDate, asId, asPinnedFlag, decodeWith, isoOf } from './cursor';

export function screeningCaseCursorPayload(row: VideoScreening): CursorPayload {
  const open = isScreeningCaseOpen(row);
  return { open: open ? 1 : 0, createdAt: isoOf(row.createdAt), id: row.id };
}

export function decodeScreeningCaseCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<ScreeningCaseCursor | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asPinnedFlag(payload['open']), (open) =>
      andThen(asDate(payload['createdAt']), (createdAt) =>
        andThen(asId(payload['id']), (id) => ok({ open, createdAt, id }))
      )
    )
  );
}
