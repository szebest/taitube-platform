import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { fromPromise, map, type Result } from '@kit/result';
import type { ApiTokenCandidate, ApiTokenRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ApiToken, ApiTokenSummary } from '@vp/domain';
import { and, desc, eq, getTableColumns, gt, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { apiTokens: t, apiTokenUsage: u, users } = schema;

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

export class PostgresApiTokenRepository implements ApiTokenRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(token: ApiToken): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () => this.db.insert(t).values(token),
      databaseUnavailable.during('createApiToken')
    );
    return map(written, () => undefined);
  }

  async countActive(userId: string, now: Date): Promise<Result<number, DatabaseUnavailable>> {
    const counted = await fromPromise(
      () =>
        this.db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(t)
          .where(and(eq(t.userId, userId), isNull(t.revokedAt), gt(t.expiresAt, now))),
      databaseUnavailable.during('countActiveApiTokens')
    );
    return map(counted, ([row]) => row?.count ?? 0);
  }

  async listByUser(
    userId: string,
    now: Date
  ): Promise<Result<ApiTokenSummary[], DatabaseUnavailable>> {
    const { secretHash: _hash, ...shown } = getTableColumns(t);
    return fromPromise(
      () =>
        this.db
          .select({
            ...shown,
            requestsToday: sql<number>`coalesce(${u.requests}, 0)`.mapWith(Number),
          })
          .from(t)
          .leftJoin(u, and(eq(u.tokenId, t.id), eq(u.day, dayOf(now))))
          .where(and(eq(t.userId, userId), isNull(t.revokedAt)))
          .orderBy(desc(t.createdAt), desc(t.id)),
      databaseUnavailable.during('listApiTokens')
    );
  }

  async findOwned(
    userId: string,
    id: string
  ): Promise<Result<ApiToken | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(t)
          .where(and(eq(t.userId, userId), eq(t.id, id))),
      databaseUnavailable.during('findApiToken')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async revoke(
    userId: string,
    id: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(t)
          .set({ revokedAt: at })
          .where(and(eq(t.userId, userId), eq(t.id, id), isNull(t.revokedAt)))
          .returning({ id: t.id }),
      databaseUnavailable.during('revokeApiToken')
    );
    return map(rows, (revoked) => revoked.length > 0);
  }

  async findByPrefix(prefix: string): Promise<Result<ApiTokenCandidate[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select({ token: getTableColumns(t), userRole: users.role })
          .from(t)
          .innerJoin(users, eq(users.id, t.userId))
          .where(eq(t.prefix, prefix)),
      databaseUnavailable.during('findApiTokenByPrefix')
    );
  }

  async recordUse(id: string, at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx.update(t).set({ lastUsedAt: at }).where(eq(t.id, id));
          await tx
            .insert(u)
            .values({ tokenId: id, day: dayOf(at), requests: 1 })
            .onConflictDoUpdate({
              target: [u.tokenId, u.day],
              set: { requests: sql`${u.requests} + 1` },
            });
        }),
      databaseUnavailable.during('recordApiTokenUse')
    );
    return map(written, () => undefined);
  }
}
