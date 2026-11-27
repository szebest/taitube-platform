import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, fromPromise, map } from '@kit/result';
import type {
  ListSubscribersOptions,
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  SubscriptionRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type ChannelSubscriber,
  type NewChannelAuditEntry,
  NOTIFICATION_LEVELS,
  type NotificationLevel,
  type SubscribedChannelItem,
  type SubscriptionChangeResult,
  type ViewDateRange,
} from '@vp/domain';
import { type SQL, and, asc, eq, gt, gte, lt, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { drizzleWhere } from '../scopes/index';
import { appendChannelAudit } from './channel-audit-writes';
import { subscribedChannels, subscriptionFeed } from './subscription-feed-query';
import type { PostgresDatabase } from './types';

const { channelSubscriptions: cs, channels: ch, subscriptionEvents: se } = schema;

const subscriptionOf = (subscriberChannelId: string, channelId: string) =>
  and(eq(cs.subscriberChannelId, subscriberChannelId), eq(cs.channelId, channelId));

/** `NOTIFICATION_LEVELS` runs loudest first, so an account subscribed twice hears the louder one. */
const loudestLevel = sql<NotificationLevel>`(array_agg(${cs.notificationLevel} order by array_position(
  array[${sql.join(
    NOTIFICATION_LEVELS.map((level) => sql`${level}`),
    sql`, `
  )}]::text[], ${cs.notificationLevel}
)))[1]`;

export class PostgresSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  /**
   * Pure I/O. Whether an absent channel or a self-subscribe is an error is `decideSubscribe`'s
   * call, made before this runs; a channel that vanished in between changed nothing and has no
   * subscribers to report.
   */
  async subscribe(
    subscriberId: string,
    subscriberChannelId: string,
    channelId: string,
    sourceVideoId: string | null = null,
    audit?: NewChannelAuditEntry
  ): Promise<Result<SubscriptionChangeResult, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [channel] = await tx
            .select({ subscriberCount: ch.subscriberCount })
            .from(ch)
            .where(eq(ch.id, channelId));

          if (!channel) return { subscriberCount: 0, changed: false };

          const [inserted] = await tx
            .insert(cs)
            .values({
              id: uuidv7(),
              subscriberId,
              subscriberChannelId,
              channelId,
              sourceVideoId,
              createdAt: new Date(),
            })
            .onConflictDoNothing()
            .returning({ id: cs.id });

          if (!inserted) {
            return { subscriberCount: channel.subscriberCount, changed: false };
          }
          await tx.insert(se).values({ id: uuidv7(), channelId, delta: 1, occurredAt: new Date() });
          if (audit) await appendChannelAudit(tx, audit);

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
    subscriberChannelId: string,
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
            .where(subscriptionOf(subscriberChannelId, channelId))
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
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: cs.id })
          .from(cs)
          .where(subscriptionOf(subscriberChannelId, channelId))
          .limit(1),
      databaseUnavailable.during('isSubscribed')
    );

    return map(rows, ([row]) => Boolean(row));
  }

  async getChannelSubscriptionChannelIds(
    subscriberChannelId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    return await this.followedChannelIds(
      eq(cs.subscriberChannelId, subscriberChannelId),
      'getChannelSubscriptionChannelIds'
    );
  }

  async getUserSubscriptionChannelIds(
    subscriberId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    return await this.followedChannelIds(
      eq(cs.subscriberId, subscriberId),
      'getUserSubscriptionChannelIds'
    );
  }

  private async followedChannelIds(
    subscribers: SQL,
    operation: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.selectDistinct({ channelId: cs.channelId }).from(cs).where(subscribers),
      databaseUnavailable.during(operation)
    );

    return map(rows, (found) => found.map((r) => r.channelId));
  }

  async setNotificationLevel(
    subscriberChannelId: string,
    channelId: string,
    level: NotificationLevel
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(cs)
          .set({ notificationLevel: level })
          .where(subscriptionOf(subscriberChannelId, channelId))
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
          .select({ subscriberId: cs.subscriberId, notificationLevel: loudestLevel })
          .from(cs)
          .where(
            drizzleWhere(
              eq(cs.channelId, channelId),
              options.after ? gt(cs.subscriberId, options.after) : undefined
            )
          )
          .groupBy(cs.subscriberId)
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
    channelId: string,
    range: ViewDateRange
  ): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ net: sql<number>`coalesce(sum(${se.delta}), 0)::int` })
          .from(se)
          .where(
            and(
              eq(se.channelId, channelId),
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
    return await subscribedChannels(this.db, subscriberId, options);
  }

  async getSubscriptionFeed(
    subscriberId: string,
    options: SubscriptionFeedOptions
  ): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>> {
    return await subscriptionFeed(this.db, subscriberId, options);
  }
}
