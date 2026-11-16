import type { SubscriptionFeedOptions, VideoRecord } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, isErr, map } from '@vp/result';
import { desc, eq, sql } from 'drizzle-orm';
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
  const baseWhere = drizzleWhere(
    eq(cs.subscriberId, subscriberId),
    publicVisibilityScope(v),
    eq(v.status, 'READY'),
    notDeletedScope(v)
  );

  const counted = await fromPromise(
    () =>
      db
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
      db
        .select({ video: v })
        .from(v)
        .innerJoin(ch, eq(v.ownerId, ch.userId))
        .innerJoin(cs, eq(cs.channelId, ch.id))
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
