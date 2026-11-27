import { assertNever } from '@kit/result';
import type { PageItemKind, PageItemRef, PageItemRow } from '@vp/core/repositories';
import {
  channelPosts as p,
  channels as ch,
  liveStreams as ls,
  playlistItems as pi,
  playlists as pl,
  videos as v,
} from '@vp/db';
import { type SQL, inArray, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { publicFeedScope } from './public-feed-query';
import type { PostgresDatabase } from './types';

const idsOf = (refs: readonly PageItemRef[], kind: PageItemKind): string[] =>
  refs.filter((ref) => ref.kind === kind).map(({ id }) => id);

const among = (column: Parameters<typeof inArray>[0], ids: string[]): SQL =>
  ids.length > 0 ? inArray(column, ids) : sql`false`;

const NO_NUMBER = sql<number | null>`null::bigint`;
const NO_TEXT = sql<string | null>`null::text`;
const NO_UUID = sql<string | null>`null::uuid`;

function cardOf(kind: PageItemKind): SQL<PageItemKind> {
  return sql<PageItemKind>`${kind}::text`;
}

/** Every kind selected into one shape, so the answer is one statement however the ids mix. */
export async function hydrateRefs(
  db: PostgresDatabase,
  refs: readonly PageItemRef[]
): Promise<PageItemRow[]> {
  const rows = await unionAll(
    db
      .select({
        kind: cardOf('video'),
        id: v.id,
        title: sql<string>`coalesce(${v.title}, '')`,
        thumb: sql<string | null>`coalesce(${v.customThumbnailKey}, ${v.posterKey})`,
        createdAt: v.createdAt,
        channelId: sql<string | null>`${v.channelId}`,
        ownerId: sql<string | null>`${v.ownerId}`,
        n1: sql<number | null>`${v.durationMs}::bigint`,
        n2: sql<number | null>`${v.viewsCount}::bigint`,
        n3: sql<number | null>`${v.likesCount}::bigint`,
        t1: sql<string | null>`${v.format}`,
        t2: NO_TEXT,
      })
      .from(v)
      .where(sql`${among(v.id, idsOf(refs, 'video'))} and ${publicFeedScope()}`),
    db
      .select({
        kind: cardOf('post'),
        id: p.id,
        title: sql<string>`coalesce(${p.payload} ->> 'text', ${p.payload} ->> 'question', ${p.payload} ->> 'caption', ${p.payload} ->> 'comment', '')`,
        thumb: NO_TEXT,
        createdAt: sql<Date>`coalesce(${p.publishedAt}, ${p.createdAt})`,
        channelId: sql<string | null>`${p.channelId}`,
        ownerId: NO_UUID,
        n1: NO_NUMBER,
        n2: sql<number | null>`${p.likeCount}::bigint`,
        n3: sql<number | null>`${p.commentsCount}::bigint`,
        t1: NO_TEXT,
        t2: NO_TEXT,
      })
      .from(p)
      .where(sql`${among(p.id, idsOf(refs, 'post'))} and ${p.status} = 'published'`),
    db
      .select({
        kind: cardOf('playlist'),
        id: pl.id,
        title: sql<string>`${pl.title}`,
        thumb: sql<string | null>`${pl.customThumbnailKey}`,
        createdAt: pl.updatedAt,
        channelId: NO_UUID,
        ownerId: sql<string | null>`${pl.ownerId}`,
        n1: sql<
          number | null
        >`(select count(*) from ${pi} where ${pi.playlistId} = ${sql.raw('"playlists"."id"')} and ${pi.kind} = 'video')`,
        n2: NO_NUMBER,
        n3: NO_NUMBER,
        t1: NO_TEXT,
        t2: NO_TEXT,
      })
      .from(pl)
      .where(
        sql`${among(pl.id, idsOf(refs, 'playlist'))} and ${pl.visibility} = 'public' and not ${pl.isSystem}`
      ),
    db
      .select({
        kind: cardOf('live'),
        id: ls.id,
        title: sql<string>`${ls.title}`,
        thumb: NO_TEXT,
        createdAt: sql<Date>`coalesce(${ls.startedAt}, ${ls.createdAt})`,
        channelId: sql<string | null>`${ls.channelId}`,
        ownerId: NO_UUID,
        n1: sql<number | null>`${ls.currentViewers}::bigint`,
        n2: NO_NUMBER,
        n3: NO_NUMBER,
        t1: sql<string | null>`${ls.status}::text`,
        t2: sql<string | null>`${ls.videoId}::text`,
      })
      .from(ls)
      .where(
        sql`${among(ls.id, idsOf(refs, 'live'))} and ${ls.visibility} = 'public' and (${ls.status} = 'LIVE' or (${ls.status} = 'ENDED' and ${ls.archiveVisibility} = 'public'))`
      ),
    db
      .select({
        kind: cardOf('channel'),
        id: ch.id,
        title: sql<string>`${ch.displayName}`,
        thumb: sql<string | null>`${ch.avatarUrl}`,
        createdAt: ch.createdAt,
        channelId: sql<string | null>`${ch.id}`,
        ownerId: sql<string | null>`${ch.userId}`,
        n1: NO_NUMBER,
        n2: NO_NUMBER,
        n3: NO_NUMBER,
        t1: sql<string | null>`${ch.handle}`,
        t2: NO_TEXT,
      })
      .from(ch)
      .where(among(ch.id, idsOf(refs, 'channel')))
  );
  return rows.map(toRow);
}

interface HydratedRow {
  kind: PageItemKind;
  id: string;
  title: string;
  thumb: string | null;
  createdAt: Date | string;
  channelId: string | null;
  ownerId: string | null;
  n1: number | string | null;
  n2: number | string | null;
  n3: number | string | null;
  t1: string | null;
  t2: string | null;
}

const count = (value: number | string | null): number => Number(value ?? 0);

function toRow(row: HydratedRow): PageItemRow {
  const base = {
    id: row.id,
    title: row.title,
    thumbnailKey: row.thumb,
    createdAt: new Date(row.createdAt),
    channelId: row.channelId,
    ownerUserId: row.ownerId,
  };
  switch (row.kind) {
    case 'video':
      return {
        ...base,
        kind: 'video',
        format: row.t1 === 'short' ? 'short' : 'standard',
        durationMs: row.n1 === null ? null : Number(row.n1),
        viewsCount: count(row.n2),
        likesCount: count(row.n3),
      };
    case 'post':
      return { ...base, kind: 'post', likesCount: count(row.n2), commentsCount: count(row.n3) };
    case 'playlist':
      return { ...base, kind: 'playlist', itemCount: count(row.n1) };
    case 'live':
      return {
        ...base,
        kind: 'live',
        status: row.t1 === 'LIVE' ? 'LIVE' : row.t1 === 'IDLE' ? 'IDLE' : 'ENDED',
        viewers: count(row.n1),
        videoId: row.t2,
      };
    case 'channel':
      return { ...base, kind: 'channel', handle: row.t1 ?? '', avatarUrl: row.thumb };
    default:
      return assertNever(row.kind, 'PageItemKind');
  }
}
