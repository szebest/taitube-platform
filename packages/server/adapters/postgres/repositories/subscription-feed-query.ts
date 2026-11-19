import { type Result, fromPromise, isErr, map } from '@kit/result';
import type {
  ListSubscriptionsOptions,
  SubscriptionFeedOptions,
  VideoRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { SubscribedChannelItem } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  drizzleWhere,
  keysetBefore,
  msTimestamp,
  notDeletedScope,
  publicVisibilityScope,
} from '../scopes/index';
import type { PostgresDatabase } from './types';

const { channelSubscriptions: cs, channels: ch, videos: v } = schema;

/** The public `READY` videos of the channels `subscriberId` follows, newest first, with the unpaged total. */
export async function subscriptionFeed(
  db: PostgresDatabase,
  subscriberId: string,
  options: SubscriptionFeedOptions
): Promise<Result<{ items: VideoRecord[]; total: number }, DatabaseUnavailable>> {
  const followed = db
    .select({ channelId: cs.channelId })
    .from(cs)
    .where(eq(cs.subscriberId, subscriberId));
  const baseWhere = drizzleWhere(
    inArray(v.channelId, followed),
    publicVisibilityScope(v),
    eq(v.status, 'READY'),
    notDeletedScope(v)
  );

  const counted = await fromPromise(
    () =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(v)
        .where(baseWhere),
    databaseUnavailable.during('getSubscriptionFeed')
  );
  if (isErr(counted)) return counted;

  const rows = await fromPromise(
    () =>
      db
        .select({ video: v })
        .from(v)
        .where(
          drizzleWhere(
            baseWhere,
            keysetBefore(
              msTimestamp(v.createdAt),
              v.id,
              options.cursor && { sort: options.cursor.createdAt, tie: options.cursor.id }
            )
          )
        )
        .orderBy(desc(msTimestamp(v.createdAt)), desc(v.id))
        .limit(options.limit + 1),
    databaseUnavailable.during('getSubscriptionFeed')
  );

  return map(rows, (found) => ({
    items: found.map((r) => r.video),
    total: counted.value[0]?.count ?? 0,
  }));
}

/** The channels `subscriberId` follows, each once at its first subscription, newest first. */
export async function subscribedChannels(
  db: PostgresDatabase,
  subscriberId: string,
  options: ListSubscriptionsOptions
): Promise<Result<SubscribedChannelItem[], DatabaseUnavailable>> {
  const first = db
    .selectDistinctOn([cs.channelId], {
      channelId: cs.channelId,
      createdAt: cs.createdAt,
      notificationLevel: cs.notificationLevel,
    })
    .from(cs)
    .where(eq(cs.subscriberId, subscriberId))
    .orderBy(cs.channelId, asc(msTimestamp(cs.createdAt)))
    .as('first_subscription');
  return await fromPromise(
    () =>
      db
        .select({
          id: ch.id,
          userId: ch.userId,
          handle: ch.handle,
          displayName: ch.displayName,
          avatarUrl: ch.avatarUrl,
          bannerUrl: ch.bannerUrl,
          bio: ch.bio,
          subscriberCount: ch.subscriberCount,
          subscribedAt: first.createdAt,
          notificationLevel: first.notificationLevel,
        })
        .from(first)
        .innerJoin(ch, eq(first.channelId, ch.id))
        .where(
          keysetBefore(
            msTimestamp(first.createdAt),
            ch.id,
            options.cursor && {
              sort: options.cursor.createdAt,
              tie: options.cursor.channelId,
            }
          )
        )
        .orderBy(desc(msTimestamp(first.createdAt)), desc(ch.id))
        .limit(options.limit + 1),
    databaseUnavailable.during('listUserSubscriptions')
  );
}
