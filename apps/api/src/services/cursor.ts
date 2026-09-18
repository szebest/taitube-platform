import { ErrorCodes, PermanentError } from '@vp/errors';

export type FeedSort = 'recent' | 'popular' | 'trending';

export type DecodedFeedCursor =
  | { sort: 'recent'; createdAt: Date; id: string }
  | { sort: 'popular'; viewsCount: number; id: string }
  | { sort: 'trending'; score: number; id: string };

export function encodeVideoCursor(v: { createdAt: Date | string; id: string }): string {
  const d =
    v.createdAt instanceof Date ? v.createdAt.toISOString() : new Date(v.createdAt).toISOString();
  return Buffer.from(JSON.stringify({ createdAt: d, id: v.id })).toString('base64url');
}

export function decodeVideoCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed.createdAt === 'string' && typeof parsed.id === 'string') {
      const date = new Date(parsed.createdAt);
      if (!Number.isNaN(date.getTime())) return { createdAt: date, id: parsed.id };
    }
  } catch {
    throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
  }
  throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
}

export function encodeFeedCursor(
  v: { createdAt: Date | string; id: string; viewsCount?: number },
  sort: FeedSort,
  score?: number
): string {
  if (sort === 'popular') {
    return Buffer.from(
      JSON.stringify({ sort: 'popular', viewsCount: v.viewsCount ?? 0, id: v.id })
    ).toString('base64url');
  }
  if (sort === 'trending') {
    return Buffer.from(JSON.stringify({ sort: 'trending', score: score ?? 0, id: v.id })).toString(
      'base64url'
    );
  }
  const d =
    v.createdAt instanceof Date ? v.createdAt.toISOString() : new Date(v.createdAt).toISOString();
  return Buffer.from(JSON.stringify({ sort: 'recent', createdAt: d, id: v.id })).toString(
    'base64url'
  );
}

export function decodeFeedCursor(cursor?: string): DecodedFeedCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
      throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
    }

    if (parsed.sort === 'popular') {
      if (typeof parsed.viewsCount === 'number') {
        return { sort: 'popular', viewsCount: parsed.viewsCount, id: parsed.id };
      }
    } else if (parsed.sort === 'trending') {
      if (typeof parsed.score === 'number') {
        return { sort: 'trending', score: parsed.score, id: parsed.id };
      }
    } else if (parsed.sort === 'recent' || typeof parsed.createdAt === 'string') {
      const date = new Date(parsed.createdAt);
      if (!Number.isNaN(date.getTime())) {
        return { sort: 'recent', createdAt: date, id: parsed.id };
      }
    }
  } catch (err) {
    if (err instanceof PermanentError) throw err;
    throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
  }
  throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
}

export function encodeSubscriptionCursor(item: {
  createdAt: Date | string;
  channelId: string;
}): string {
  const d =
    item.createdAt instanceof Date
      ? item.createdAt.toISOString()
      : new Date(item.createdAt).toISOString();
  return Buffer.from(JSON.stringify({ createdAt: d, channelId: item.channelId })).toString(
    'base64url'
  );
}

export function decodeSubscriptionCursor(
  cursor?: string
): { createdAt: Date; channelId: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed.createdAt === 'string' && typeof parsed.channelId === 'string') {
      const date = new Date(parsed.createdAt);
      if (!Number.isNaN(date.getTime())) {
        return { createdAt: date, channelId: parsed.channelId };
      }
    }
  } catch {
    throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
  }
  throw new PermanentError(ErrorCodes.VALIDATION_FAILED, 'Invalid pagination cursor');
}

