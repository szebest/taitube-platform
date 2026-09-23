import type { VideoReactionRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { reactionDelta } from '@vp/domain';
import type {
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';

export class PostgresVideoReactionRepository implements VideoReactionRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  private unavailable(operation: string) {
    return (cause: unknown): DatabaseUnavailable => databaseUnavailable(operation, cause);
  }

  async getUserReaction(
    videoId: string,
    userId: string
  ): Promise<Result<ReactionType | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ type: schema.videoReactions.type })
          .from(schema.videoReactions)
          .where(
            and(
              eq(schema.videoReactions.videoId, videoId),
              eq(schema.videoReactions.userId, userId)
            )
          ),
      this.unavailable('getUserReaction')
    );

    return map(rows, ([row]) => (row?.type as ReactionType) ?? null);
  }

  async getReactionCounts(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            likesCount: schema.videos.likesCount,
            dislikesCount: schema.videos.dislikesCount,
          })
          .from(schema.videos)
          .where(eq(schema.videos.id, videoId)),
      this.unavailable('getReactionCounts')
    );

    return map(rows, ([video]) => ({
      likesCount: video?.likesCount ?? 0,
      dislikesCount: video?.dislikesCount ?? 0,
    }));
  }

  async setReaction(
    videoId: string,
    userId: string,
    type: ReactionInputType
  ): Promise<Result<SetReactionResult, DatabaseUnavailable>> {
    const newType: ReactionType | null = type === 'NONE' ? null : type;

    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          let previousType: ReactionType | null = null;

          if (newType === null) {
            const [deleted] = await tx
              .delete(schema.videoReactions)
              .where(
                and(
                  eq(schema.videoReactions.videoId, videoId),
                  eq(schema.videoReactions.userId, userId)
                )
              )
              .returning({ type: schema.videoReactions.type });

            previousType = (deleted?.type as ReactionType) ?? null;
          } else {
            const [prev] = await tx
              .select({ type: schema.videoReactions.type })
              .from(schema.videoReactions)
              .where(
                and(
                  eq(schema.videoReactions.videoId, videoId),
                  eq(schema.videoReactions.userId, userId)
                )
              );

            previousType = (prev?.type as ReactionType) ?? null;

            await tx
              .insert(schema.videoReactions)
              .values({
                id: uuidv7(),
                videoId,
                userId,
                type: newType,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [schema.videoReactions.userId, schema.videoReactions.videoId],
                set: {
                  type: newType,
                  updatedAt: sql`now()`,
                },
              });
          }

          const { likes: deltaLikes, dislikes: deltaDislikes } = reactionDelta(
            previousType,
            newType
          );

          let likesCount = 0;
          let dislikesCount = 0;

          if (deltaLikes !== 0 || deltaDislikes !== 0) {
            const [updatedVideo] = await tx
              .update(schema.videos)
              .set({
                likesCount: sql`GREATEST(0, ${schema.videos.likesCount} + ${deltaLikes})`,
                dislikesCount: sql`GREATEST(0, ${schema.videos.dislikesCount} + ${deltaDislikes})`,
                updatedAt: new Date(),
              })
              .where(eq(schema.videos.id, videoId))
              .returning({
                likesCount: schema.videos.likesCount,
                dislikesCount: schema.videos.dislikesCount,
              });

            if (updatedVideo) {
              likesCount = updatedVideo.likesCount;
              dislikesCount = updatedVideo.dislikesCount;
            }
          } else {
            const [currVideo] = await tx
              .select({
                likesCount: schema.videos.likesCount,
                dislikesCount: schema.videos.dislikesCount,
              })
              .from(schema.videos)
              .where(eq(schema.videos.id, videoId));
            if (currVideo) {
              likesCount = currVideo.likesCount;
              dislikesCount = currVideo.dislikesCount;
            }
          }

          return {
            previousType,
            newType,
            likesCount,
            dislikesCount,
          };
        }),
      this.unavailable('setReaction')
    );
  }

  async countGroundTruth(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            likesCount: sql<number>`count(*) filter (where ${schema.videoReactions.type} = 'LIKE')`,
            dislikesCount: sql<number>`count(*) filter (where ${schema.videoReactions.type} = 'DISLIKE')`,
          })
          .from(schema.videoReactions)
          .where(eq(schema.videoReactions.videoId, videoId)),
      this.unavailable('countGroundTruth')
    );

    return map(rows, ([row]) => ({
      likesCount: Number(row?.likesCount ?? 0),
      dislikesCount: Number(row?.dislikesCount ?? 0),
    }));
  }

  async updateVideoCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<Result<void, DatabaseUnavailable>> {
    const done = await fromPromise(
      () =>
        this.db
          .update(schema.videos)
          .set({ likesCount, dislikesCount, updatedAt: new Date() })
          .where(eq(schema.videos.id, videoId)),
      this.unavailable('updateVideoCounters')
    );

    return map(done, () => undefined);
  }

  async listVideoIdsWithReactions(
    limit: number,
    offset = 0
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .selectDistinct({ videoId: schema.videoReactions.videoId })
          .from(schema.videoReactions)
          .limit(limit)
          .offset(offset),
      this.unavailable('listVideoIdsWithReactions')
    );

    return map(rows, (found) => found.map((r) => r.videoId));
  }
}
