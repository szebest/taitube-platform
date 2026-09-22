import type { PublicFeedCursor, PublicFeedSort } from '@vp/domain';
import {
  type CursorPayload,
  InvalidCursorError,
  type Paginator,
  defaultPaginator,
} from '@vp/pagination';
import { ErrorCodes, PermanentError } from '@vp/errors';

export type FeedSort = PublicFeedSort;

/** The row a feed page resumes after, plus the instant the walk ranks everything against. */
export type FeedCursor = PublicFeedCursor;

export interface FeedCursorRow {
  createdAt: Date | string;
  id: string;
  viewsCount?: number | null;
}

function invalidCursor(): never {
  throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
}

/** Translates the codec's failure into the transport error the API reports. */
function payloadOf(cursor: string | undefined, paginator: Paginator): CursorPayload | null {
  try {
    return paginator.decodeCursor(cursor);
  } catch (err) {
    if (err instanceof InvalidCursorError) invalidCursor();
    throw err;
  }
}

function isoOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseDate(value: unknown): Date {
  if (typeof value !== 'string') invalidCursor();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalidCursor();
  return date;
}

function parseId(value: unknown): string {
  if (typeof value !== 'string') invalidCursor();
  return value;
}

function parseNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidCursor();
  return value;
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

export function decodeCreatedAtCursor(
  cursor?: string,
  paginator: Paginator = defaultPaginator
): { createdAt: Date; id: string } | null {
  const parsed = payloadOf(cursor, paginator);
  if (!parsed) return null;
  return { createdAt: parseDate(parsed.createdAt), id: parseId(parsed.id) };
}

export function decodeSubscriptionCursor(
  cursor?: string,
  paginator: Paginator = defaultPaginator
): { createdAt: Date; channelId: string } | null {
  const parsed = payloadOf(cursor, paginator);
  if (!parsed) return null;
  return { createdAt: parseDate(parsed.createdAt), channelId: parseId(parsed.channelId) };
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
): FeedCursor | null {
  const parsed = payloadOf(cursor, paginator);
  if (!parsed) return null;

  return {
    createdAt: parseDate(parsed.createdAt),
    viewsCount: parseNumber(parsed.viewsCount),
    instant: parseNumber(parsed.instant),
    id: parseId(parsed.id),
  };
}
