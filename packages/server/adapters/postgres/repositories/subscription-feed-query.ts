import { type Result, fromPromise, isErr, map } from '@kit/result';
import type { SubscriptionFeedOptions, VideoRecord } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import {
  drizzleWhere,
  keysetBefore,
  msTimestamp,
  notDeletedScope,
  publicVisibilityScope,
} from '../scopes/index';
import type { PostgresDatabase } from './types';

const { channelSubscriptions: cs, videos: v } = schema;

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
