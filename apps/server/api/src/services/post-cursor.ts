import type { CursorPayload, InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, andThen, map, ok } from '@kit/result';
import type { ChannelPostCursor, ChannelPostEntry } from '@vp/domain';
import { asDate, asId, decodeWith, isoOf } from './cursor';

function publishedAtOf({ post }: ChannelPostEntry): Date {
  return post.publishedAt ?? post.createdAt;
}

/** A pinned post carries its pin time; an unpinned one has no such key, as it has no such position. */
export function channelPostCursorPayload(entry: ChannelPostEntry): CursorPayload {
  const { post } = entry;
  return {
    ...(post.pinnedAt && { pinnedAt: isoOf(post.pinnedAt) }),
    publishedAt: isoOf(publishedAtOf(entry)),
    id: post.id,
  };
}

/** The feed is newest first whatever a channel pinned, so its cursor leaves the pin out. */
export function feedPostCursorPayload(entry: ChannelPostEntry): CursorPayload {
  return { publishedAt: isoOf(publishedAtOf(entry)), id: entry.post.id };
}

function pinnedAtOf(payload: CursorPayload): Result<Date | null, InvalidCursor> {
  return payload['pinnedAt'] === undefined ? ok(null) : asDate(payload['pinnedAt']);
}

export function decodeChannelPostCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<ChannelPostCursor | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(pinnedAtOf(payload), (pinnedAt) =>
      andThen(asDate(payload['publishedAt']), (publishedAt) =>
        map(asId(payload['id']), (id) => ({ pinnedAt, publishedAt, id }))
      )
    )
  );
}

export function decodeFeedPostCursor(
  cursor: string | undefined,
  paginator: Paginator
): Result<ChannelPostCursor | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) =>
    andThen(asDate(payload['publishedAt']), (publishedAt) =>
      map(asId(payload['id']), (id) => ({ pinnedAt: null, publishedAt, id }))
    )
  );
}
