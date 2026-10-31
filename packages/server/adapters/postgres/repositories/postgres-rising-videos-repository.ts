import type {
  RisingVideosOptions,
  RisingVideosRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { RISING, rankRising } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, desc, eq, gte, lte, notInArray, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { drizzleWhere } from '../scopes/index';
import { publicFeedScope } from './public-feed-query';
import type { PostgresDatabase } from './types';

const { videos: v, channels: ch, videoRetentionMilestones: milestone } = schema;

const started = alias(milestone, 'started');
const completed = alias(milestone, 'completed');

export class PostgresRisingVideosRepository implements RisingVideosRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async find({
    since,
    excludeOwnerId,
    excludeVideoIds,
    limit,
  }: RisingVideosOptions): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            video: v,
            subscriberCount: ch.subscriberCount,
            sessions: started.viewers,
            completed: completed.viewers,
          })
          .from(v)
          .innerJoin(ch, eq(ch.userId, v.ownerId))
          .innerJoin(
            started,
            and(eq(started.videoId, v.id), eq(started.percent, RISING.startPercent))
          )
          .leftJoin(
            completed,
            and(eq(completed.videoId, v.id), eq(completed.percent, RISING.completedPercent))
          )
          .where(
            drizzleWhere(
              publicFeedScope(),
              gte(v.createdAt, since),
              lte(ch.subscriberCount, RISING.maxSubscribers),
              gte(started.viewers, RISING.minSessions),
              excludeOwnerId ? ne(v.ownerId, excludeOwnerId) : undefined,
              excludeVideoIds.length > 0 ? notInArray(v.id, [...excludeVideoIds]) : undefined
            )
          )
          .orderBy(desc(v.createdAt), desc(v.id))
          .limit(RISING.candidates),
      databaseUnavailable.during('findRisingVideos')
    );
    return map(rows, (found) =>
      rankRising(
        found.map(({ video, completed: done, ...counts }) => ({
          video,
          id: video.id,
          ownerId: video.ownerId,
          createdAt: video.createdAt,
          completed: done ?? 0,
          ...counts,
        })),
        limit
      ).map(({ video }) => video)
    );
  }
}
