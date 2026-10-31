import type {
  ListRecommendationFeedbackOptions,
  RecommendationFeedbackRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type ChannelCard,
  type HiddenFeedback,
  type NewRecommendationFeedback,
  RECOMMENDATION_FEEDBACK_LIMIT,
  type RecommendationFeedback,
  type RecommendationFeedbackEntry,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, fromPromise, isErr, map } from '@vp/result';
import { and, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { toFeedback } from '../mappers/index';
import { drizzleWhere, keysetBefore, watchableVideoScope } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { recommendationFeedback: rf, videos: v, channels: ch } = schema;

const ownerChannel = alias(ch, 'owner_channel');
const targetChannel = alias(ch, 'target_channel');

function withoutOwner({
  userId: _userId,
  ...feedback
}: NewRecommendationFeedback): RecommendationFeedback {
  return feedback;
}

const cardOf = (channel: typeof ch.$inferSelect | null): ChannelCard | null =>
  channel && {
    id: channel.id,
    handle: channel.handle,
    displayName: channel.displayName,
    avatarUrl: channel.avatarUrl,
  };

export class PostgresRecommendationFeedbackRepository
  implements RecommendationFeedbackRepositoryPort
{
  constructor(private readonly db: PostgresDatabase) {}

  async put(
    entry: NewRecommendationFeedback
  ): Promise<Result<RecommendationFeedback, DatabaseUnavailable>> {
    const { id, userId, kind, createdAt } = entry;
    const videoId = entry.kind === 'not_interested' ? entry.videoId : null;
    const channelId = entry.kind === 'hide_channel' ? entry.channelId : null;

    const written = await fromPromise(
      () =>
        this.db.execute(sql`
          with inserted as (
            insert into recommendation_feedback (id, user_id, kind, video_id, channel_id, created_at)
            values (${id}, ${userId}, ${kind}, ${videoId}::uuid, ${channelId}::uuid, ${createdAt.toISOString()}::timestamptz)
            on conflict do nothing
          )
          delete from recommendation_feedback
          where id in (
            select id from recommendation_feedback
            where user_id = ${userId}
              and (video_id is distinct from ${videoId}::uuid or channel_id is distinct from ${channelId}::uuid)
            order by created_at desc, id desc
            offset ${RECOMMENDATION_FEEDBACK_LIMIT - 1}
          )
        `),
      databaseUnavailable.during('putRecommendationFeedback')
    );
    if (isErr(written)) return written;

    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(rf)
          .where(
            and(
              eq(rf.userId, userId),
              entry.kind === 'not_interested'
                ? eq(rf.videoId, entry.videoId)
                : eq(rf.channelId, entry.channelId)
            )
          ),
      databaseUnavailable.during('findRecommendationFeedback')
    );
    return map(rows, ([row]) => (row ? toFeedback(row) : withoutOwner(entry)));
  }

  async list(
    viewer: UserContext,
    { kind, cursor, limit }: ListRecommendationFeedbackOptions
  ): Promise<Result<RecommendationFeedbackEntry[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ feedback: rf, video: v, owner: ownerChannel, target: targetChannel })
          .from(rf)
          .leftJoin(v, and(eq(v.id, rf.videoId), watchableVideoScope(viewer)))
          .leftJoin(ownerChannel, eq(ownerChannel.userId, v.ownerId))
          .leftJoin(targetChannel, eq(targetChannel.id, rf.channelId))
          .where(
            drizzleWhere(
              eq(rf.userId, viewer.id),
              kind ? eq(rf.kind, kind) : undefined,
              keysetBefore(
                rf.createdAt,
                rf.id,
                cursor && { sort: cursor.createdAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(rf.createdAt), desc(rf.id))
          .limit(limit + 1),
      databaseUnavailable.during('listRecommendationFeedback')
    );
    return map(rows, (found) =>
      found.map(({ feedback, video, owner, target }) => ({
        ...toFeedback(feedback),
        video,
        channel: cardOf(feedback.kind === 'hide_channel' ? target : owner),
      }))
    );
  }

  async hiddenOf(userId: string): Promise<Result<HiddenFeedback, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ videoId: rf.videoId, channelId: rf.channelId })
          .from(rf)
          .where(eq(rf.userId, userId)),
      databaseUnavailable.during('hiddenRecommendationFeedback')
    );
    return map(rows, (found) => ({
      videoIds: new Set(found.flatMap(({ videoId }) => (videoId ? [videoId] : []))),
      channelIds: new Set(found.flatMap(({ channelId }) => (channelId ? [channelId] : []))),
    }));
  }

  async remove(userId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(rf)
          .where(and(eq(rf.userId, userId), eq(rf.id, id)))
          .returning({ id: rf.id }),
      databaseUnavailable.during('removeRecommendationFeedback')
    );
    return map(rows, (removed) => removed.length > 0);
  }
}
