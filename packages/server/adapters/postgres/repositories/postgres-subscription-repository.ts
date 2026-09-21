import type { SubscribedChannelItem, SubscriptionChangeResult } from '@vp/core/domain';
import { DatabaseError } from '@vp/core/ports';
import type {
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { uuidv7 } from 'uuidv7';
import {
  drizzleWhere,
  keysetBefore,
  notDeletedScope,
  publicVisibilityScope,
} from '../scopes/index';

const { channelSubscriptions: cs, channels: ch, videos: v } = schema;

const dbErr = (msg: string, err: unknown) =>
  new DatabaseError(`${msg}: ${(err as Error).message}`, { cause: err });

export class PostgresSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async subscribe(subscriberId: string, channelId: string): Promise<SubscriptionChangeResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [channel] = await tx
          .select({ userId: ch.userId, subscriberCount: ch.subscriberCount })
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
          .returning({ id: cs.id });

        if (!inserted) {
          return { subscriberCount: channel.subscriberCount, changed: false };
        }

        const [updated] = await tx
          .update(ch)
          .set({ subscriberCount: sql`${ch.subscriberCount} + 1`, updatedAt: new Date() })
          .where(eq(ch.id, channelId))
          .returning({ subscriberCount: ch.subscriberCount });

        return {
          subscriberCount: updated?.subscriberCount ?? channel.subscriberCount + 1,
          changed: true,
        };
      });
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      throw dbErr('Failed to subscribe', err);
    }
  }

  async unsubscribe(subscriberId: string, channelId: string): Promise<SubscriptionChangeResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [channel] = await tx
          .select({ subscriberCount: ch.subscriberCount })
          .from(ch)
          .where(eq(ch.id, channelId));

        if (!channel) throw new PermanentError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel not found');

        const [deleted] = await tx
          .delete(cs)
          .where(and(eq(cs.subscriberId, subscriberId), eq(cs.channelId, channelId)))
          .returning({ id: cs.id });

        if (!deleted) {
          return { subscriberCount: channel.subscriberCount, changed: false };
        }

        const [updated] = await tx
          .update(ch)
          .set({
            subscriberCount: sql`GREATEST(0, ${ch.subscriberCount} - 1)`,
            updatedAt: new Date(),
          })
          .where(eq(ch.id, channelId))
          .returning({ subscriberCount: ch.subscriberCount });

        return {
          subscriberCount: updated?.subscriberCount ?? Math.max(0, channel.subscriberCount - 1),
          changed: true,
        };
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
  ): Promise<SubscribedChannelItem[]> {
    try {
      return await this.db
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
        .where(
          drizzleWhere(
            eq(cs.subscriberId, subscriberId),
            keysetBefore(
              cs.createdAt,
              cs.channelId,
              options.cursor && {
                sort: options.cursor.createdAt,
                tie: options.cursor.channelId,
              }
            )
          )
        )
        .orderBy(desc(cs.createdAt), desc(cs.channelId))
        .limit(options.limit + 1);
    } catch (err) {
      throw dbErr('Failed to list user subscriptions', err);
    }
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<{ items: VideoRecord[]; total: number }> {
    try {
      const baseWhere = drizzleWhere(
        eq(cs.subscriberId, subscriberId),
        publicVisibilityScope(v),
        eq(v.status, 'READY'),
        notDeletedScope(v)
      );

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .innerJoin(ch, eq(v.ownerId, ch.userId))
        .innerJoin(cs, eq(cs.channelId, ch.id))
        .where(baseWhere);

      const rows = await this.db
        .select({ video: v })
        .from(v)
        .innerJoin(ch, eq(v.ownerId, ch.userId))
        .innerJoin(cs, eq(cs.channelId, ch.id))
        .where(
          drizzleWhere(
            baseWhere,
            keysetBefore(
              v.createdAt,
              v.id,
              options.cursor && { sort: options.cursor.createdAt, tie: options.cursor.id }
            )
          )
        )
        .orderBy(desc(v.createdAt), desc(v.id))
        .limit(options.limit + 1);

      return { items: rows.map((r) => r.video), total: countResult?.count ?? 0 };
    } catch (err) {
      throw dbErr('Failed to get subscription feed', err);
    }
  }
}
