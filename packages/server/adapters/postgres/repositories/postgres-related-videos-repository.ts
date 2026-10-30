import type {
  RelatedVideo,
  RelatedVideosOptions,
  RelatedVideosRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { compareRelated, RELATED_CANDIDATES } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, ok, type Result } from '@vp/result';
import { arrayOverlaps, count, desc, eq, inArray, ne, type SQL, sql } from 'drizzle-orm';
import { union } from 'drizzle-orm/pg-core';
import { drizzleWhere } from '../scopes/index';
import { publicFeedScope } from './public-feed-query';
import type { PostgresDatabase } from './types';

const { videos: v, watchHistory: wh } = schema;

/**
 * Candidates come from sources an index serves, each capped: tag sharers (GIN), the owner's videos,
 * the category's (`videos_category_id_idx`) and what recent viewers of the anchor watched next
 * (`watch_history_video_idx`, `watch_history_user_watched_idx`). Only that set is scored and ranked.
 */
export class PostgresRelatedVideosRepository implements RelatedVideosRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async find(options: RelatedVideosOptions): Promise<Result<RelatedVideo[], DatabaseUnavailable>> {
    const { videoId, ownerId, categoryId, tags, excludeOwnerId, limit } = options;

    const eligible = drizzleWhere(
      publicFeedScope(),
      ne(v.id, videoId),
      excludeOwnerId ? ne(v.ownerId, excludeOwnerId) : undefined
    );
    const sourceOf = (match: SQL, rank: SQL[]) =>
      this.db
        .select({ id: v.id })
        .from(v)
        .where(drizzleWhere(eligible, match))
        .orderBy(...rank)
        .limit(RELATED_CANDIDATES.perSource);

    const viewers = this.db
      .select({ userId: wh.userId })
      .from(wh)
      .where(eq(wh.videoId, videoId))
      .orderBy(desc(wh.watchedAt))
      .limit(RELATED_CANDIDATES.perSource)
      .as('viewers');
    const next = this.db
      .select({ videoId: wh.videoId })
      .from(wh)
      .where(drizzleWhere(eq(wh.userId, viewers.userId), ne(wh.videoId, videoId)))
      .orderBy(desc(wh.watchedAt))
      .limit(RELATED_CANDIDATES.perViewer)
      .as('next');
    const coWatch = this.db.$with('co_watch').as(
      this.db
        .select({ videoId: next.videoId, watchers: count().as('watchers') })
        .from(viewers)
        .innerJoinLateral(next, sql`true`)
        .groupBy(next.videoId)
        .orderBy(desc(sql`watchers`), desc(next.videoId))
        .limit(RELATED_CANDIDATES.perSource)
    );

    const byViews = [desc(v.viewsCount), desc(v.id)];
    const optional = [
      tags.length > 0 ? sourceOf(arrayOverlaps(v.tags, [...tags]), byViews) : undefined,
      categoryId ? sourceOf(eq(v.categoryId, categoryId), byViews) : undefined,
    ].flatMap((source) => (source ? [source] : []));
    const candidates = union(
      this.db.select({ id: coWatch.videoId }).from(coWatch),
      sourceOf(eq(v.ownerId, ownerId), [desc(v.createdAt), desc(v.id)]),
      ...optional
    ).as('candidates');

    const slim = await fromPromise(
      () =>
        this.db
          .with(coWatch)
          .select({
            id: v.id,
            ownerId: v.ownerId,
            categoryId: v.categoryId,
            tags: v.tags,
            viewsCount: v.viewsCount,
            watchers: coWatch.watchers,
          })
          .from(candidates)
          .innerJoin(v, eq(v.id, candidates.id))
          .leftJoin(coWatch, eq(coWatch.videoId, candidates.id))
          .where(eligible),
      databaseUnavailable.during('findRelatedCandidates')
    );
    if (!slim.ok) return slim;
    if (slim.value.length === 0) return ok([]);

    const wanted = new Set(tags);
    const winners = slim.value
      .map((row) => ({
        id: row.id,
        viewsCount: row.viewsCount,
        signals: {
          coWatchers: Number(row.watchers ?? 0),
          sharedTags: row.tags.filter((tag) => wanted.has(tag)).length,
          sameChannel: row.ownerId === ownerId,
          sameCategory: categoryId !== null && row.categoryId === categoryId,
        },
      }))
      .sort(compareRelated)
      .slice(0, limit);

    const found = await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(
            drizzleWhere(
              eligible,
              inArray(
                v.id,
                winners.map(({ id }) => id)
              )
            )
          ),
      databaseUnavailable.during('findRelatedVideos')
    );

    return map(found, (videos) => {
      const byId = new Map(videos.map((video) => [video.id, video]));
      return winners.flatMap(({ id, signals }) => {
        const video = byId.get(id);
        return video ? [{ video, signals }] : [];
      });
    });
  }
}
