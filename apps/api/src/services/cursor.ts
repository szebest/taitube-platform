import {
  type CursorPayload,
  InvalidCursorError,
  defaultPaginator,
  type Paginator,
} from '@vp/core/pagination';
import type { PublicFeedSort } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';

export type FeedSort = PublicFeedSort;

export type DecodedFeedCursor =
  | { sort: 'recent'; createdAt: Date; id: string }
  | { sort: 'popular'; viewsCount: number; id: string }
  | { sort: 'trending'; score: number; id: string };

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

export function videoCursorPayload(v: { createdAt: Date | string; id: string }): CursorPayload {
  return { createdAt: isoOf(v.createdAt), id: v.id };
}

export function subscriptionCursorPayload(item: {
  createdAt: Date | string;
  channelId: string;
}): CursorPayload {
  return { createdAt: isoOf(item.createdAt), channelId: item.channelId };
}

export function feedCursorPayload(
  v: { createdAt: Date | string; id: string; viewsCount?: number },
  sort: FeedSort,
  score?: number
): CursorPayload {
  if (sort === 'popular') return { sort, viewsCount: v.viewsCount ?? 0, id: v.id };
  if (sort === 'trending') return { sort, score: score ?? 0, id: v.id };
  return { sort: 'recent', createdAt: isoOf(v.createdAt), id: v.id };
}

export function encodeVideoCursor(
  v: { createdAt: Date | string; id: string },
  paginator: Paginator = defaultPaginator
): string {
  return paginator.encodeCursor(videoCursorPayload(v));
}

export function decodeVideoCursor(
  cursor?: string,
  paginator: Paginator = defaultPaginator
): { createdAt: Date; id: string } | null {
  const parsed = payloadOf(cursor, paginator);
  if (!parsed) return null;
  return { createdAt: parseDate(parsed.createdAt), id: parseId(parsed.id) };
}

export function encodeSubscriptionCursor(
  item: { createdAt: Date | string; channelId: string },
  paginator: Paginator = defaultPaginator
): string {
  return paginator.encodeCursor(subscriptionCursorPayload(item));
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
  v: { createdAt: Date | string; id: string; viewsCount?: number },
  sort: FeedSort,
  score?: number,
  paginator: Paginator = defaultPaginator
): string {
  return paginator.encodeCursor(feedCursorPayload(v, sort, score));
}

export function decodeFeedCursor(
  cursor?: string,
  paginator: Paginator = defaultPaginator
): DecodedFeedCursor | null {
  const parsed = payloadOf(cursor, paginator);
  if (!parsed) return null;

  const id = parseId(parsed.id);
  if (parsed.sort === 'popular' && typeof parsed.viewsCount === 'number') {
    return { sort: 'popular', viewsCount: parsed.viewsCount, id };
  }
  if (parsed.sort === 'trending' && typeof parsed.score === 'number') {
    return { sort: 'trending', score: parsed.score, id };
  }
  if (parsed.sort === 'recent' || typeof parsed.createdAt === 'string') {
    return { sort: 'recent', createdAt: parseDate(parsed.createdAt), id };
  }
  invalidCursor();
}
