import type { ApiTokenCandidate, ApiTokenRepositoryPort } from '@vp/core/repositories';
import type { ApiToken, ApiTokenSummary } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';
import type { InMemoryUserRepository } from './in-memory-user-repository';

const copyOf = (token: ApiToken): ApiToken => ({ ...token, scopes: [...token.scopes] });

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

const newestFirst = (a: ApiToken, b: ApiToken) => b.createdAt.getTime() - a.createdAt.getTime();

export class InMemoryApiTokenRepository implements ApiTokenRepositoryPort {
  private readonly rows = new Map<string, ApiToken>();
  /** `${tokenId} ${day}` to the requests made that day. */
  private readonly usage = new Map<string, number>();

  constructor(private readonly users: InMemoryUserRepository) {}

  async create(token: ApiToken): Promise<Result<void, DatabaseUnavailable>> {
    this.rows.set(token.id, copyOf(token));
    return ok();
  }

  async countActive(userId: string, now: Date): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.unrevoked(userId).filter((row) => row.expiresAt > now).length);
  }

  async listByUser(
    userId: string,
    now: Date
  ): Promise<Result<ApiTokenSummary[], DatabaseUnavailable>> {
    return ok(
      this.unrevoked(userId)
        .sort(newestFirst)
        .map(({ secretHash: _hash, ...row }) => ({
          ...row,
          scopes: [...row.scopes],
          requestsToday: this.usage.get(`${row.id} ${dayOf(now)}`) ?? 0,
        }))
    );
  }

  async findOwned(
    userId: string,
    id: string
  ): Promise<Result<ApiToken | null, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    return ok(found?.userId === userId ? copyOf(found) : null);
  }

  async revoke(
    userId: string,
    id: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    if (found?.userId !== userId || found.revokedAt) return ok(false);
    found.revokedAt = at;
    return ok(true);
  }

  async findByPrefix(prefix: string): Promise<Result<ApiTokenCandidate[], DatabaseUnavailable>> {
    const candidates: ApiTokenCandidate[] = [];
    for (const token of this.rows.values()) {
      if (token.prefix !== prefix) continue;
      const user = await this.users.findById(token.userId);
      if (isErr(user)) return user;
      if (user.value)
        candidates.push({ token: copyOf(token), userRole: user.value.role ?? 'USER' });
    }
    return ok(candidates);
  }

  async recordUse(id: string, at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    if (!found) return ok();
    found.lastUsedAt = at;
    const key = `${id} ${dayOf(at)}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + 1);
    return ok();
  }

  clear(): void {
    this.rows.clear();
    this.usage.clear();
  }

  private unrevoked(userId: string): ApiToken[] {
    return [...this.rows.values()].filter((row) => row.userId === userId && !row.revokedAt);
  }
}
