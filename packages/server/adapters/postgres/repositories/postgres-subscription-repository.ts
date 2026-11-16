import type {
  ListSubscribersOptions,
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type {
  ChannelSubscriber,
  NotificationLevel,
  SubscribedChannelItem,
  SubscriptionChangeResult,
  ViewDateRange,
} from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, asc, desc, eq, gt, gte, lt, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { drizzleWhere, keysetBefore, msTimestamp } from '../scopes/index';
import { subscriptionFeed } from './subscription-feed-query';
import type { PostgresDatabase } from './types';

const { channelSubscriptions: cs, channels: ch, subscriptionEvents: se } = schema;

export class PostgresSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  /**
   * Pure I/O. Whether an absent channel or a self-subscribe is an error is `decideSubscribe`'s
   * call, made before this runs; a channel that vanished in between changed nothing and has no
   * subscribers to report.
   */
  async subscribe(
    subscriberId: string,
    channelId: string,
    sourceVideoId: string | null = null
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
            .values({ id: uuidv7(), subscriberId, channelId, sourceVideoId, createdAt: new Date() })
            .onConflictDoNothing()
            .returning({ id: cs.id });

          if (!inserted) {
            return { subscriberCount: channel.subscriberCount, changed: false };
          }
          await tx.insert(se).values({ id: uuidv7(), channelId, delta: 1, occurredAt: new Date() });

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
          await tx
            .insert(se)
            .values({ id: uuidv7(), channelId, delta: -1, occurredAt: new Date() });

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

  async setNotificationLevel(
    subscriberId: string,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(cs)
          .set({ notificationLevel: level })
          .where(and(eq(cs.subscriberId, subscriberId), eq(cs.channelId, channelId)))
          .returning({ id: cs.id }),
      databaseUnavailable.during('setNotificationLevel')
    );

    return map(rows, (updated) => updated.length > 0);
  }

  async listSubscribers(
    channelId: string,
    options: ListSubscribersOptions
  ): Promise<Result<ChannelSubscriber[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select({ subscriberId: cs.subscriberId, notificationLevel: cs.notificationLevel })
          .from(cs)
          .where(
            drizzleWhere(
              eq(cs.channelId, channelId),
              options.after ? gt(cs.subscriberId, options.after) : undefined
            )
          )
          .orderBy(asc(cs.subscriberId))
          .limit(options.limit),
      databaseUnavailable.during('listSubscribers')
    );
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

  async countFromVideo(videoId: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(cs)
          .where(eq(cs.sourceVideoId, videoId)),
      databaseUnavailable.during('countSubscriptionsFromVideo')
    );

    return map(rows, ([row]) => row?.count ?? 0);
  }

  async netSubscribers(
    ownerId: string,
    range: ViewDateRange
  ): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ net: sql<number>`coalesce(sum(${se.delta}), 0)::int` })
          .from(se)
          .innerJoin(ch, eq(ch.id, se.channelId))
          .where(
            and(
              eq(ch.userId, ownerId),
              gte(se.occurredAt, new Date(range.from)),
              lt(se.occurredAt, new Date(Date.parse(range.to) + MS_PER_DAY))
            )
          ),
      databaseUnavailable.during('netSubscribers')
    );

    return map(rows, ([row]) => row?.net ?? 0);
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
            notificationLevel: cs.notificationLevel,
          })
          .from(cs)
          .innerJoin(ch, eq(cs.channelId, ch.id))
          .where(
            drizzleWhere(
              eq(cs.subscriberId, subscriberId),
              keysetBefore(
                msTimestamp(cs.createdAt),
                cs.channelId,
                options.cursor && {
                  sort: options.cursor.createdAt,
                  tie: options.cursor.channelId,
                }
              )
            )
          )
          .orderBy(desc(msTimestamp(cs.createdAt)), desc(cs.channelId))
          .limit(options.limit + 1),
      databaseUnavailable.during('listUserSubscriptions')
    );
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>> {
    return await subscriptionFeed(this.db, subscriberId, options);
  }
}
