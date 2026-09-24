import type {
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { SubscribedChannelItem, SubscriptionChangeResult } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, isErr, map } from '@vp/result';
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

export class PostgresSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Pure I/O. Whether an absent channel or a self-subscribe is an error is `decideSubscribe`'s
   * call, made before this runs; a channel that vanished in between changed nothing and has no
   * subscribers to report.
   */
  async subscribe(
    subscriberId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [channel] = await tx
            .select({ userId: ch.userId, subscriberCount: ch.subscriberCount })
            .from(ch)
            .where(eq(ch.id, channelId));

          if (!channel) return { subscriberCount: 0, changed: false };

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
        }),
      databaseUnavailable.during('subscribe')
    );
  }

  async unsubscribe(
    subscriberId: string,
    channelId: string
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [channel] = await tx
            .select({ subscriberCount: ch.subscriberCount })
            .from(ch)
            .where(eq(ch.id, channelId));

          if (!channel) return { subscriberCount: 0, changed: false };

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
        }),
      databaseUnavailable.during('unsubscribe')
    );
  }

  async isSubscribed(
    subscriberId: string,
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: cs.id })
          .from(cs)
          .where(and(eq(cs.subscriberId, subscriberId), eq(cs.channelId, channelId)))
          .limit(1),
      databaseUnavailable.during('isSubscribed')
    );

    return map(rows, ([row]) => Boolean(row));
  }

  async getUserSubscriptionChannelIds(
    subscriberId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ channelId: cs.channelId })
          .from(cs)
          .where(eq(cs.subscriberId, subscriberId)),
      databaseUnavailable.during('getUserSubscriptionChannelIds')
    );

    return map(rows, (found) => found.map((r) => r.channelId));
  }

  async getSubscriberCount(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ subscriberCount: ch.subscriberCount })
          .from(ch)
          .where(eq(ch.id, channelId)),
      databaseUnavailable.during('getSubscriberCount')
    );

    return map(rows, ([channel]) => channel?.subscriberCount ?? 0);
  }

  async listUserSubscriptions(
    subscriberId: string,
    options: ListSubscriptionsOptions
  ): Promise<Result<SubscribedChannelItem[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
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
          .limit(options.limit + 1),
      databaseUnavailable.during('listUserSubscriptions')
    );
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>> {
    const baseWhere = drizzleWhere(
      eq(cs.subscriberId, subscriberId),
      publicVisibilityScope(v),
      eq(v.status, 'READY'),
      notDeletedScope(v)
    );

    const counted = await fromPromise(
      () =>
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(v)
          .innerJoin(ch, eq(v.ownerId, ch.userId))
          .innerJoin(cs, eq(cs.channelId, ch.id))
          .where(baseWhere),
      databaseUnavailable.during('getSubscriptionFeed')
    );
    if (isErr(counted)) return counted;

    const rows = await fromPromise(
      () =>
        this.db
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
          .limit(options.limit + 1),
      databaseUnavailable.during('getSubscriptionFeed')
    );

    return map(rows, (found) => ({
      items: found.map((r) => r.video),
      total: counted.value[0]?.count ?? 0,
    }));
  }
}
