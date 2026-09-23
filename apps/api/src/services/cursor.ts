import type { PublicFeedCursor, PublicFeedSort } from '@vp/domain';
import {
  type CursorPayload,
  type InvalidCursor,
  type Paginator,
  defaultPaginator,
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
  cursor?: string,
  paginator: Paginator = defaultPaginator
): Result<{ createdAt: Date; id: string } | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asDate(payload['createdAt']), (createdAt) =>
      andThen(asId(payload['id']), (id) => ok({ createdAt, id }))
    )
  );
}

export function decodeSubscriptionCursor(
  cursor?: string,
  paginator: Paginator = defaultPaginator
): Result<{ createdAt: Date; channelId: string } | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asDate(payload['createdAt']), (createdAt) =>
      andThen(asId(payload['channelId']), (channelId) => ok({ createdAt, channelId }))
    )
  );
}

export function encodeFeedCursor(
  v: FeedCursorRow,
  instant: number,
  paginator: Paginator = defaultPaginator
): string {
  return paginator.encodeCursor(feedCursorPayload(v, instant));
}

export function decodeFeedCursor(
  cursor?: string,
  paginator: Paginator = defaultPaginator
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
