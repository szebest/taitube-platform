import { fromPromise, map, ok, type Result } from '@kit/result';
import { ShareLinkRepository } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  NO_SHARE_LINK_TOTALS,
  type ShareLink,
  type ShareLinkTargetType,
  type ShareLinkTotals,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, count, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { shareLinks: sl, shareLinkStats: stats } = schema;

export class PostgresShareLinkRepository extends ShareLinkRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async listFor(
    targetType: ShareLinkTargetType,
    targetId: string
  ): Promise<Result<ShareLink[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(sl)
          .where(and(eq(sl.targetType, targetType), eq(sl.targetId, targetId)))
          .orderBy(desc(sl.createdAt), desc(sl.id)),
      databaseUnavailable.during('listShareLinks')
    );
  }

  async create(link: ShareLink, limit: number): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`share_links:${link.targetType}:${link.targetId}`}))`
          );
          const [active] = await tx
            .select({ total: count() })
            .from(sl)
            .where(
              and(
                eq(sl.targetType, link.targetType),
                eq(sl.targetId, link.targetId),
                isNull(sl.revokedAt),
                or(isNull(sl.expiresAt), gt(sl.expiresAt, link.createdAt))
              )
            );
          if ((active?.total ?? 0) >= limit) return false;
          await tx.insert(sl).values(link);
          return true;
        }),
      databaseUnavailable.during('createShareLink')
    );
  }

  async findByToken(token: string): Promise<Result<ShareLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(sl).where(eq(sl.token, token)).limit(1),
      databaseUnavailable.during('findShareLinkByToken')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async findById(id: string): Promise<Result<ShareLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(sl).where(eq(sl.id, id)).limit(1),
      databaseUnavailable.during('findShareLinkById')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async revoke(
    targetType: ShareLinkTargetType,
    targetId: string,
    linkId: string,
    at: Date
  ): Promise<Result<ShareLink | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(sl)
          .set({ revokedAt: sql`coalesce(${sl.revokedAt}, ${at.toISOString()}::timestamptz)` })
          .where(and(eq(sl.id, linkId), eq(sl.targetType, targetType), eq(sl.targetId, targetId)))
          .returning(),
      databaseUnavailable.during('revokeShareLink')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async totalsFor(
    linkIds: readonly string[]
  ): Promise<Result<Map<string, ShareLinkTotals>, DatabaseUnavailable>> {
    const totals = new Map<string, ShareLinkTotals>(
      linkIds.map((id) => [id, NO_SHARE_LINK_TOTALS])
    );
    if (linkIds.length === 0) return ok(totals);

    const rows = await fromPromise(
      () =>
        this.db
          .select({
            linkId: stats.linkId,
            opens: sql<number>`coalesce(sum(${stats.opens}), 0)`.mapWith(Number),
            views: sql<number>`coalesce(sum(${stats.views}), 0)`.mapWith(Number),
            watchSeconds: sql<number>`coalesce(sum(${stats.watchSeconds}), 0)`.mapWith(Number),
          })
          .from(stats)
          .where(inArray(stats.linkId, [...linkIds]))
          .groupBy(stats.linkId),
      databaseUnavailable.during('shareLinkTotals')
    );
    return map(rows, (found) => {
      for (const { linkId, ...sums } of found) totals.set(linkId, sums);
      return totals;
    });
  }
}
