import type {
  RelatedVideo,
  RelatedVideosOptions,
  RelatedVideosRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { type SQL, and, count, desc, eq, getTableColumns, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { drizzleWhere } from '../scopes/index';
import { publicFeedScope } from './public-feed-query';
import type { PostgresDatabase } from './types';

const { videos: v, watchHistory: wh } = schema;

function sharedTagsOf(tags: readonly string[]): SQL<number> {
  if (tags.length === 0) return sql<number>`0`;
  const wanted = sql.join(
    tags.map((tag) => sql`${tag}`),
    sql`, `
  );
  return sql<number>`(select count(*)::int from unnest(${v.tags}) as t(tag) where t.tag in (${wanted}))`;
}

export class PostgresRelatedVideosRepository implements RelatedVideosRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async find(options: RelatedVideosOptions): Promise<Result<RelatedVideo[], DatabaseUnavailable>> {
    const { videoId, ownerId, categoryId, tags, excludeOwnerId, limit } = options;

    const anchor = alias(wh, 'anchor_watch');
    const coWatch = this.db
      .select({ videoId: wh.videoId, watchers: count().as('watchers') })
      .from(anchor)
      .innerJoin(wh, and(eq(wh.userId, anchor.userId), ne(wh.videoId, anchor.videoId)))
      .where(eq(anchor.videoId, videoId))
      .groupBy(wh.videoId)
      .as('co_watch');

    const coWatchers = sql<number>`coalesce(${coWatch.watchers}, 0)::int`;
    const sharedTags = sharedTagsOf(tags);
    const sameChannel = sql<boolean>`${v.ownerId} = ${ownerId}`;
    const sameCategory = categoryId
      ? sql<boolean>`coalesce(${v.categoryId} = ${categoryId}, false)`
      : sql<boolean>`false`;

    const rows = await fromPromise(
      () =>
        this.db
          .select({
            video: getTableColumns(v),
            coWatchers,
            sharedTags,
            sameChannel,
            sameCategory,
          })
          .from(v)
          .leftJoin(coWatch, eq(coWatch.videoId, v.id))
          .where(
            drizzleWhere(
              publicFeedScope(),
              ne(v.id, videoId),
              excludeOwnerId ? sql`${v.ownerId} <> ${excludeOwnerId}` : undefined,
              sql`(${coWatchers} > 0 or ${sharedTags} > 0 or ${sameChannel} or ${sameCategory})`
            )
          )
          .orderBy(
            desc(coWatchers),
            desc(sharedTags),
            desc(sameChannel),
            desc(sameCategory),
            desc(v.viewsCount),
            desc(v.id)
          )
          .limit(limit),
      databaseUnavailable.during('findRelatedVideos')
    );

    return map(rows, (found) => found.map(({ video, ...signals }) => ({ video, signals })));
  }
}
