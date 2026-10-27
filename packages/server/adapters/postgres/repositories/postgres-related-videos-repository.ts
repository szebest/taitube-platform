import type {
  RelatedVideo,
  RelatedVideosOptions,
  RelatedVideosRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { compareRelated, RELATED_CANDIDATES } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
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

    const ranked = await fromPromise(
      () =>
        this.db
          .with(coWatch)
          .select({ id: candidates.id, watchers: coWatch.watchers })
          .from(candidates)
          .leftJoin(coWatch, eq(coWatch.videoId, candidates.id)),
      databaseUnavailable.during('findRelatedCandidates')
    );
    if (!ranked.ok) return ranked;

    const watchers = new Map(ranked.value.map(({ id, watchers }) => [id, watchers ?? 0]));
    const found = await fromPromise(
      () =>
        this.db
          .select()
          .from(v)
          .where(drizzleWhere(eligible, inArray(v.id, [...watchers.keys()]))),
      databaseUnavailable.during('findRelatedVideos')
    );

    const wanted = new Set(tags);
    return map(found, (videos) =>
      videos
        .map((video) => ({
          video,
          signals: {
            coWatchers: Number(watchers.get(video.id) ?? 0),
            sharedTags: video.tags.filter((tag) => wanted.has(tag)).length,
            sameChannel: video.ownerId === ownerId,
            sameCategory: categoryId !== null && video.categoryId === categoryId,
          },
        }))
        .sort((a, b) =>
          compareRelated(
            { id: a.video.id, viewsCount: a.video.viewsCount ?? 0, signals: a.signals },
            { id: b.video.id, viewsCount: b.video.viewsCount ?? 0, signals: b.signals }
          )
        )
        .slice(0, limit)
    );
  }
}
