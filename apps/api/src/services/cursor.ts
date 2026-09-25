import type { PublicFeedCursor, PublicFeedSort } from '@vp/domain';
import {
  type CursorPayload,
  type InvalidCursor,
  type Paginator,
  invalidCursor,
} from '@vp/pagination';
import { type Result, andThen, err, ok } from '@vp/result';

export type FeedSort = PublicFeedSort;

/** The row a feed page resumes after, plus the instant the walk ranks everything against. */
export type FeedCursor = PublicFeedCursor;

export interface FeedCursorRow {
  createdAt: Date | string;
  id: string;
  viewsCount?: number | null;
}

function isoOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asDate(value: unknown): Result<Date, InvalidCursor> {
  if (typeof value !== 'string') return err(invalidCursor());
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? err(invalidCursor()) : ok(date);
}

function asId(value: unknown): Result<string, InvalidCursor> {
  return typeof value === 'string' ? ok(value) : err(invalidCursor());
}

function asNumber(value: unknown): Result<number, InvalidCursor> {
  return typeof value === 'number' && Number.isFinite(value) ? ok(value) : err(invalidCursor());
}

export function createdAtCursorPayload(v: {
  createdAt: Date | string;
  id: string;
}): CursorPayload {
  return { createdAt: isoOf(v.createdAt), id: v.id };
}

export function subscriptionCursorPayload(item: {
  createdAt: Date | string;
  channelId: string;
}): CursorPayload {
  return { createdAt: isoOf(item.createdAt), channelId: item.channelId };
}

export interface CommentThreadCursorRow {
  isPinned: boolean;
  likeCount: number;
  createdAt: Date;
  id: string;
}

/** Both comment sorts read from one payload, so a cursor survives a switch of sort. */
export function commentThreadCursorPayload(row: CommentThreadCursorRow): CursorPayload {
  return {
    isPinned: row.isPinned ? 1 : 0,
    likeCount: row.likeCount,
    createdAt: isoOf(row.createdAt),
    id: row.id,
  };
}

function asPinnedFlag(value: unknown): Result<boolean, InvalidCursor> {
  return value === 0 || value === 1 ? ok(value === 1) : err(invalidCursor());
}

/**
 * One payload for every sort: the rank inputs, not a rank. Which sort reads which of them is
 * the repository's business, so replaying a cursor under a different sort stays meaningful.
 */
export function feedCursorPayload(v: FeedCursorRow, instant: number): CursorPayload {
  return { createdAt: isoOf(v.createdAt), viewsCount: v.viewsCount ?? 0, instant, id: v.id };
}

/** An absent cursor is the first page, so it stays `ok(null)` rather than becoming a failure. */
function decodeWith<T>(
  cursor: string | undefined,
  paginator: Paginator,
  read: (payload: CursorPayload) => Result<T, InvalidCursor>
): Result<T | null, InvalidCursor> {
  return andThen(paginator.decodeCursor(cursor), (payload) =>
    payload === null ? ok(null) : read(payload)
  );
}

export function decodeCreatedAtCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<{ createdAt: Date; id: string } | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asDate(payload['createdAt']), (createdAt) =>
      andThen(asId(payload['id']), (id) => ok({ createdAt, id }))
    )
  );
}

export function decodeSubscriptionCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<{ createdAt: Date; channelId: string } | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asDate(payload['createdAt']), (createdAt) =>
      andThen(asId(payload['channelId']), (channelId) => ok({ createdAt, channelId }))
    )
  );
}

export function decodeCommentThreadCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<CommentThreadCursorRow | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asPinnedFlag(payload['isPinned']), (isPinned) =>
      andThen(asNumber(payload['likeCount']), (likeCount) =>
        andThen(asDate(payload['createdAt']), (createdAt) =>
          andThen(asId(payload['id']), (id) => ok({ isPinned, likeCount, createdAt, id }))
        )
      )
    )
  );
}

export function decodeFeedCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<FeedCursor | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asDate(payload['createdAt']), (createdAt) =>
      andThen(asNumber(payload['viewsCount']), (viewsCount) =>
        andThen(asNumber(payload['instant']), (instant) =>
          andThen(asId(payload['id']), (id) => ok({ createdAt, viewsCount, instant, id }))
        )
      )
    )
  );
}
