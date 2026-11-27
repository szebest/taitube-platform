import { type Result, assertNever, fromPromise, map, ok } from '@kit/result';
import type {
  ChannelPageSourceRepositoryPort,
  PageItemRef,
  PageItemRow,
  PlaylistItemsRequest,
  PoolRequest,
  PoolSourceType,
  RefsByKey,
  SmartRequest,
} from '@vp/core/repositories';
import { channelFeaturedVideos as fv, videos as v } from '@vp/db';
import { PUBLIC_FEED_STATUS, PUBLIC_FEED_VISIBILITY } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, desc, eq, notExists, sql } from 'drizzle-orm';
import { type PgSelect, unionAll } from 'drizzle-orm/pg-core';
import { hydrateRefs } from './channel-page-hydration';
import {
  livePool,
  playlistItemsQuery,
  playlistPool,
  postPool,
  smartQuery,
  videoPool,
} from './channel-page-source-queries';
import { publicFeedScope } from './public-feed-query';
import type { PostgresDatabase } from './types';

interface KeyedRef {
  key: string;
  id: string;
}

/** A select of `key` and `id`: any table, which is why the set operation is typed here once. */
interface KeyedMember extends PromiseLike<KeyedRef[]> {
  getSQL(): unknown;
}

async function runUnion(members: readonly KeyedMember[]): Promise<KeyedRef[]> {
  const [first, second, ...rest] = members as unknown as [PgSelect, PgSelect, ...PgSelect[]];
  const rows = await (second ? unionAll(first, second, ...rest) : first);
  return rows.map(({ key, id }) => ({ key: String(key), id: String(id) }));
}

function kindOfSource(type: PoolSourceType): PageItemRef['kind'] {
  switch (type) {
    case 'videos':
    case 'shorts':
      return 'video';
    case 'posts':
      return 'post';
    case 'live':
      return 'live';
    case 'playlists':
      return 'playlist';
    default:
      return assertNever(type, 'PoolSourceType');
  }
}

function poolMember(
  db: PostgresDatabase,
  channelId: string,
  ownerUserId: string,
  type: PoolSourceType
): (request: PoolRequest) => KeyedMember {
  switch (type) {
    case 'videos':
      return videoPool(db, channelId, 'standard');
    case 'shorts':
      return videoPool(db, channelId, 'short');
    case 'posts':
      return postPool(db, channelId);
    case 'live':
      return livePool(db, channelId);
    case 'playlists':
      return playlistPool(db, ownerUserId);
    default:
      return assertNever(type, 'PoolSourceType');
  }
}

function groupByKey(
  keys: readonly string[],
  rows: readonly KeyedRef[],
  kind: PageItemRef['kind']
): RefsByKey {
  const found: RefsByKey = Object.fromEntries(keys.map((key) => [key, []]));
  for (const { key, id } of rows) found[key]?.push({ kind, id });
  return found;
}

export class PostgresChannelPageSourceRepository implements ChannelPageSourceRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async pool(
    channelId: string,
    ownerUserId: string,
    type: PoolSourceType,
    requests: readonly PoolRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    return this.keyed(
      requests.map(({ key }) => key),
      requests.map(poolMember(this.db, channelId, ownerUserId, type)),
      kindOfSource(type),
      `poolChannelPage.${type}`
    );
  }

  async playlistItems(
    requests: readonly PlaylistItemsRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    return this.keyed(
      requests.map(({ key }) => key),
      requests.map((request) => playlistItemsQuery(this.db, request)),
      'video',
      'playlistItemsChannelPage'
    );
  }

  async smart(
    channelId: string,
    requests: readonly SmartRequest[],
    now: Date
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    return this.keyed(
      requests.map(({ key }) => key),
      requests.map(smartQuery(this.db, channelId, now)),
      'video',
      'smartChannelPage'
    );
  }

  async startHere(
    channelId: string,
    limit: number
  ): Promise<Result<PageItemRef[], DatabaseUnavailable>> {
    const pins = this.db
      .select({ id: v.id, rank: sql<number>`${fv.position}`.as('rank') })
      .from(fv)
      .innerJoin(v, eq(v.id, fv.videoId))
      .where(and(eq(fv.channelId, channelId), publicFeedScope({ channelId })))
      .orderBy(asc(fv.position))
      .limit(limit);
    const popular = this.db
      .select({ id: v.id, rank: sql<number>`0`.as('rank') })
      .from(v)
      .where(
        and(
          publicFeedScope({ channelId }),
          notExists(sql`(
            select 1 from ${fv} as pin join ${v} as pinned on pinned.id = pin.video_id
            where pin.channel_id = ${channelId}
              and pinned.visibility = ${PUBLIC_FEED_VISIBILITY}
              and pinned.status = ${PUBLIC_FEED_STATUS}
              and pinned.deleted_at is null
          )`)
        )
      )
      .orderBy(desc(v.viewsCount), desc(v.id))
      .limit(limit);
    const rows = await fromPromise(
      () => unionAll(pins, popular),
      databaseUnavailable.during('startHereChannelPage')
    );
    return map(rows, (found) =>
      found
        .toSorted((a, b) => Number(a.rank) - Number(b.rank))
        .map(({ id }) => ({ kind: 'video' as const, id }))
    );
  }

  async hydrate(refs: readonly PageItemRef[]): Promise<Result<PageItemRow[], DatabaseUnavailable>> {
    return fromPromise(
      () => hydrateRefs(this.db, refs),
      databaseUnavailable.during('hydrateChannelPage')
    );
  }

  private async keyed(
    keys: readonly string[],
    members: readonly KeyedMember[],
    kind: PageItemRef['kind'],
    operation: string
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    if (members.length === 0) return ok({});
    const rows = await fromPromise(() => runUnion(members), databaseUnavailable.during(operation));
    return map(rows, (found) => groupByKey(keys, found, kind));
  }
}
