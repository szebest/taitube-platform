import { DatabaseError } from '@vp/core/ports';
import type {
  ListSubscriptionsOptions,
  SubscribedChannelItem,
  SubscribeResult,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  UnsubscribeResult,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';

const { channelSubscriptions: cs, channels: ch, videos: v } = schema;
const toCursor = (d: unknown) => Buffer.from(JSON.stringify(d)).toString('base64url');
const dbErr = (msg: string, err: unknown) =>
  new DatabaseError(`${msg}: ${(err as Error).message}`, { cause: err });

export class PostgresSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async subscribe(subscriberId: string, channelId: string): Promise<SubscribeResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [channel] = await tx
          .select({ id: ch.id, userId: ch.userId, subscriberCount: ch.subscriberCount })
          .from(ch)
          .where(eq(ch.id, channelId));

        if (!channel) throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');
        if (channel.userId === subscriberId) {
          throw new PermanentError(
            ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
            'Cannot subscribe to your own channel'
          );
        }

        const [inserted] = await tx
          .insert(cs)
          .values({ id: uuidv7(), subscriberId, channelId, createdAt: new Date() })
          .onConflictDoNothing()
          .returning();

        let subscriberCount = channel.subscriberCount;
        if (inserted) {
          const [updated] = await tx
            .update(ch)
            .set({ subscriberCount: sql`${ch.subscriberCount} + 1`, updatedAt: new Date() })
            .where(eq(ch.id, channelId))
            .returning({ subscriberCount: ch.subscriberCount });
          if (updated) subscriberCount = updated.subscriberCount;
        }

        return { subscribed: true, subscriberCount, isNew: Boolean(inserted) };
      });
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      throw dbErr('Failed to subscribe', err);
    }
  }

  async unsubscribe(subscriberId: string, channelId: string): Promise<UnsubscribeResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [channel] = await tx
          .select({ id: ch.id, subscriberCount: ch.subscriberCount })
          .from(ch)
          .where(eq(ch.id, channelId));

        if (!channel) throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');

        const [deleted] = await tx
          .delete(cs)
          .where(and(eq(cs.subscriberId, subscriberId), eq(cs.channelId, channelId)))
          .returning();

        let subscriberCount = channel.subscriberCount;
        if (deleted) {
          const [updated] = await tx
            .update(ch)
            .set({
              subscriberCount: sql`GREATEST(0, ${ch.subscriberCount} - 1)`,
              updatedAt: new Date(),
            })
            .where(eq(ch.id, channelId))
            .returning({ subscriberCount: ch.subscriberCount });
          if (updated) subscriberCount = updated.subscriberCount;
        }

        return { subscribed: false, subscriberCount, wasSubscribed: Boolean(deleted) };
      });
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      throw dbErr('Failed to unsubscribe', err);
    }
  }

  async isSubscribed(subscriberId: string, channelId: string): Promise<boolean> {
    try {
      const [row] = await this.db
        .select({ id: cs.id })
        .from(cs)
        .where(and(eq(cs.subscriberId, subscriberId), eq(cs.channelId, channelId)))
        .limit(1);
      return Boolean(row);
    } catch (err) {
      throw dbErr('Failed to check subscription', err);
    }
  }

  async getUserSubscriptionChannelIds(subscriberId: string): Promise<string[]> {
    try {
      const rows = await this.db
        .select({ channelId: cs.channelId })
        .from(cs)
        .where(eq(cs.subscriberId, subscriberId));
      return rows.map((r) => r.channelId);
    } catch (err) {
      throw dbErr('Failed to get user subscriptions', err);
    }
  }

  async getSubscriberCount(channelId: string): Promise<number> {
    try {
      const [channel] = await this.db
        .select({ subscriberCount: ch.subscriberCount })
        .from(ch)
        .where(eq(ch.id, channelId));
      return channel?.subscriberCount ?? 0;
    } catch (err) {
      throw dbErr('Failed to get subscriber count', err);
    }
  }

  async listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<{ items: SubscribedChannelItem[]; nextCursor: string | null }> {
    try {
      const cursorCond = options.cursor
        ? or(
            lt(cs.createdAt, options.cursor.createdAt),
            and(eq(cs.createdAt, options.cursor.createdAt), lt(cs.channelId, options.cursor.channelId))
          )
        : undefined;

      const whereClause = cursorCond
        ? and(eq(cs.subscriberId, subscriberId), cursorCond)
        : eq(cs.subscriberId, subscriberId);

      const rows = await this.db
        .select({
          id: ch.id,
          userId: ch.userId,
          handle: ch.handle,
          displayName: ch.displayName,
          avatarUrl: ch.avatarUrl,
          bannerUrl: ch.bannerUrl,
          bio: ch.bio,
          subscriberCount: ch.subscriberCount,
          subscribedAt: cs.createdAt,
        })
        .from(cs)
        .innerJoin(ch, eq(cs.channelId, ch.id))
        .where(whereClause)
        .orderBy(desc(cs.createdAt), desc(cs.channelId))
        .limit(options.limit + 1);

      const hasMore = rows.length > options.limit;
      const items = hasMore ? rows.slice(0, options.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? toCursor({
              createdAt: last.subscribedAt.toISOString(),
              channelId: last.id,
            })
          : null;

      return { items, nextCursor };
    } catch (err) {
      throw dbErr('Failed to list user subscriptions', err);
    }
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<{ items: VideoRecord[]; nextCursor: string | null; total: number }> {
    try {
      const baseConditions = [
        eq(cs.subscriberId, subscriberId),
        eq(v.visibility, 'public'),
        eq(v.status, 'READY'),
        sql`${v.deletedAt} IS NULL`,
      ];

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .innerJoin(ch, eq(v.ownerId, ch.userId))
        .innerJoin(cs, eq(cs.channelId, ch.id))
        .where(and(...baseConditions));

      const total = countResult?.count ?? 0;

      const cursorCond = options.cursor
        ? or(
            lt(v.createdAt, options.cursor.createdAt),
            and(eq(v.createdAt, options.cursor.createdAt), lt(v.id, options.cursor.id))
          )
        : undefined;

      const queryConditions = cursorCond ? [...baseConditions, cursorCond] : baseConditions;

      const rows = await this.db
        .select({ video: v })
        .from(v)
        .innerJoin(ch, eq(v.ownerId, ch.userId))
        .innerJoin(cs, eq(cs.channelId, ch.id))
        .where(and(...queryConditions))
        .orderBy(desc(v.createdAt), desc(v.id))
        .limit(options.limit + 1);

      const hasMore = rows.length > options.limit;
      const items = (hasMore ? rows.slice(0, options.limit) : rows).map((r) => r.video as VideoRecord);
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? toCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null;

      return { items, nextCursor, total };
    } catch (err) {
      throw dbErr('Failed to get subscription feed', err);
    }
  }
}
