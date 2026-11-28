import type { DiscoverableRoom } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  WATCH_PARTY_SIZE_LIMITS,
  type WatchPartyDiscoveryFilters,
  type WatchPartyDiscoveryPosition,
  type WatchPartyDiscoveryQuery,
} from '@vp/domain';
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { aliasedTable, drizzleWhere, watchPartyListScope } from '../scopes/index';
import { textMatch } from './search-query';
import type { PostgresDatabase } from './types';

const {
  watchPartyRooms: rooms,
  watchPartyMembers,
  channels,
  channelSubscriptions,
  videos,
} = schema;

const subscription = aliasedTable(channelSubscriptions, 'followed_subscription');
const followedChannel = aliasedTable(channels, 'followed_channel');
const seat = aliasedTable(watchPartyMembers, 'followed_seat');

const SEARCH_VECTOR = sql.raw('"watch_party_rooms"."search_vector"');

/** The viewer subscribes to the owner's channel, the channel it is hosted as, or a seated member's. */
function followedBy(viewerId: string): SQL {
  const { table: sub } = subscription;
  const { table: channel } = followedChannel;
  const { table: member } = seat;
  return sql`exists (
    select 1 from ${subscription.from}
    join ${followedChannel.from} on ${channel.id} = ${sub.channelId}
    where ${sub.subscriberId} = ${viewerId}
      and (
        ${channel.id} = ${rooms.asChannelId}
        or ${rooms.ownerKey} = ('user:' || ${channel.userId}::text)
        or exists (
          select 1 from ${seat.from}
          where ${member.roomId} = ${rooms.id}
            and ${member.leftAt} is null
            and ${member.userId} = ${channel.userId}
        )
      )
  )`;
}

function statusFilter(status: WatchPartyDiscoveryFilters['status'], now: Date): SQL | undefined {
  switch (status) {
    case 'all':
      return undefined;
    case 'now':
      return inArray(rooms.phase, ['playing', 'paused']);
    case 'lobby':
      return and(
        eq(rooms.phase, 'lobby'),
        or(isNull(rooms.scheduledFor), lte(rooms.scheduledFor, now))
      );
    case 'scheduled':
      return and(eq(rooms.phase, 'lobby'), gt(rooms.scheduledFor, now));
  }
}

function sizeFilter(size: WatchPartyDiscoveryFilters['size']): SQL | undefined {
  const { small, medium } = WATCH_PARTY_SIZE_LIMITS;
  switch (size) {
    case 'any':
      return undefined;
    case 'small':
      return lte(rooms.presentCount, small);
    case 'medium':
      return and(gt(rooms.presentCount, small), lte(rooms.presentCount, medium));
    case 'large':
      return gt(rooms.presentCount, medium);
  }
}

function kindFilter(kind: WatchPartyDiscoveryFilters['kind']): SQL | undefined {
  switch (kind) {
    case 'any':
      return undefined;
    case 'single':
      return eq(rooms.queueLength, 1);
    case 'playlist':
      return gt(rooms.queueLength, 1);
  }
}

function accessFilter(access: WatchPartyDiscoveryFilters['access']): SQL | undefined {
  switch (access) {
    case 'any':
      return undefined;
    case 'open':
      return isNull(rooms.passwordHash);
    case 'password':
      return isNotNull(rooms.passwordHash);
  }
}

function filtersOf(query: WatchPartyDiscoveryQuery): SQL | undefined {
  const { filters, viewerId, ceiling, now, mode } = query;
  return drizzleWhere(
    statusFilter(filters.status, now),
    filters.categoryId === null ? undefined : eq(videos.categoryId, filters.categoryId),
    filters.language === null ? undefined : eq(rooms.language, filters.language),
    accessFilter(filters.access),
    sizeFilter(filters.size),
    filters.space
      ? sql`${rooms.presentCount} < least(coalesce(${rooms.capacity}, ${ceiling}), ${ceiling})`
      : undefined,
    filters.followed && viewerId !== null ? followedBy(viewerId) : undefined,
    filters.creator ? isNotNull(rooms.asChannelId) : undefined,
    kindFilter(filters.kind),
    filters.text === null
      ? undefined
      : textMatch(mode, filters.text, SEARCH_VECTOR, [rooms.searchText]).where
  );
}

/** Descending on the sort key, ascending on the id: the order each keyset index holds. */
function pastDescending(key: AnyPgColumn, bound: number | Date, id: string): SQL | undefined {
  return or(lt(key, bound), and(eq(key, bound), gt(rooms.id, id)));
}

function afterPosition(after: WatchPartyDiscoveryPosition | null): SQL | undefined {
  if (after === null) return undefined;
  switch (after.sort) {
    case 'members':
      return pastDescending(rooms.presentCount, after.key, after.id);
    case 'newest':
      return pastDescending(rooms.createdAt, after.key, after.id);
    case 'trending':
      return pastDescending(rooms.trendScore, after.key, after.id);
    case 'starting_soon':
      return or(
        gt(rooms.scheduledFor, after.key),
        and(eq(rooms.scheduledFor, after.key), gt(rooms.id, after.id))
      );
  }
}

function orderOf(sort: WatchPartyDiscoveryQuery['sort']): SQL[] {
  switch (sort) {
    case 'members':
      return [desc(rooms.presentCount), asc(rooms.id)];
    case 'newest':
      return [desc(rooms.createdAt), asc(rooms.id)];
    case 'trending':
      return [desc(rooms.trendScore), asc(rooms.id)];
    case 'starting_soon':
      return [asc(rooms.scheduledFor), asc(rooms.id)];
  }
}

export async function discoverableRooms(
  db: PostgresDatabase,
  query: WatchPartyDiscoveryQuery
): Promise<DiscoverableRoom[]> {
  const rows = await db
    .select({
      room: getTableColumns(rooms),
      video: {
        id: videos.id,
        title: videos.title,
        durationMs: videos.durationMs,
        customThumbnailKey: videos.customThumbnailKey,
        posterKey: videos.posterKey,
        categoryId: videos.categoryId,
      },
    })
    .from(rooms)
    .leftJoin(videos, eq(videos.id, rooms.currentVideoId))
    .where(
      drizzleWhere(
        watchPartyListScope(query.viewerId),
        query.sort === 'starting_soon' ? isNotNull(rooms.scheduledFor) : undefined,
        filtersOf(query),
        afterPosition(query.after)
      )
    )
    .orderBy(...orderOf(query.sort))
    .limit(query.limit + 1);
  return rows.map(({ room, video }) => {
    const { trendScore, searchText: _searchText, ...rest } = room;
    return { room: rest, video, trendScore };
  });
}
