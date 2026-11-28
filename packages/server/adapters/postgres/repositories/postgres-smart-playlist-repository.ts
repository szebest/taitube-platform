import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, fromPromise, map } from '@kit/result';
import type {
  EvaluateRulesOptions,
  SmartPlaylistEntry,
  SmartPlaylistRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { SmartPlaylistRules } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { asc, desc, eq, getTableColumns, lte, sql } from 'drizzle-orm';
import { toVideoRecord } from '../mappers/video.mapper';
import { drizzleWhere, keysetPast } from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import { publicFeedScope } from './public-feed-query';
import { rulesSql, smartSortKey } from './smart-playlist-query';
import type { PostgresDatabase } from './types';

const { videos: v, channels: ch } = schema;

export class PostgresSmartPlaylistRepository implements SmartPlaylistRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  /**
   * The inner select ranks every matching video in the rules' order and the outer one keeps the
   * first `rules.limit` of them, so a keyset page never walks past the playlist's end.
   */
  async evaluate(
    rules: SmartPlaylistRules,
    viewer: UserContext | null,
    { cursor, limit, now }: EvaluateRulesOptions
  ): Promise<Result<SmartPlaylistEntry[], DatabaseUnavailable>> {
    const { key, order } = smartSortKey(rules.sort);
    const direction = order === 'asc' ? asc : desc;
    const ranked = this.db
      .select({
        id: v.id,
        key: key.as('sort_key'),
        rank: sql<number>`row_number() over (order by ${key} ${sql.raw(order)}, ${v.id} ${sql.raw(order)})`.as(
          'rank'
        ),
      })
      .from(v)
      .where(drizzleWhere(publicFeedScope(), rulesSql(rules, viewer, now)))
      .as('smart');

    const rows = await fromPromise(
      () =>
        this.db
          .select({
            video: getTableColumns(v),
            ...channelCardColumns,
            key: ranked.key,
            rank: ranked.rank,
          })
          .from(ranked)
          .innerJoin(v, eq(v.id, ranked.id))
          .leftJoin(ch, eq(ch.id, v.channelId))
          .where(
            drizzleWhere(
              lte(ranked.rank, rules.limit),
              keysetPast(ranked.key, v.id, cursor && { sort: cursor.key, tie: cursor.id }, order)
            )
          )
          .orderBy(direction(ranked.key), direction(v.id))
          .limit(limit + 1),
      databaseUnavailable.during('evaluateSmartPlaylist')
    );
    return map(rows, (found) =>
      found.map(({ video, key: sortKey, rank, ...card }) => ({
        video: toVideoRecord(video),
        channel: toChannelCard(card),
        position: Number(rank) - 1,
        key: Number(sortKey),
      }))
    );
  }
}
