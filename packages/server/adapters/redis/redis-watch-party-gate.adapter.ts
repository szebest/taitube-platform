import type {
  BudgetRule,
  GateAdmission,
  WatchPartyBudget,
  WatchPartyGatePort,
  WatchPartyTicketGrant,
} from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { ROLES } from '@vp/permissions';
import { andThenAsync, fromPromise, isErr, map, ok, parseJson, type Result } from '@vp/result';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { PartyPrincipalSchema } from './party-principal-schema';

const TicketGrantSchema = z.object({
  roomId: z.string(),
  principal: PartyPrincipalSchema,
  role: z.enum(ROLES).nullable(),
});

const ADMITTED: GateAdmission = { type: 'admitted' };

const refusedFor = (ttlSeconds: number): GateAdmission => ({
  type: 'refused',
  retryAfterSeconds: Math.max(1, ttlSeconds),
});

export class RedisWatchPartyGateAdapter implements WatchPartyGatePort {
  constructor(
    private readonly redis: Redis,
    private readonly stateTtlSeconds: number
  ) {}

  async issueTicket(
    ticket: string,
    grant: WatchPartyTicketGrant,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>> {
    const set = await fromPromise(
      () =>
        this.redis.set(CacheKeys.watchPartyTicket(ticket), JSON.stringify(grant), 'EX', ttlSeconds),
      cacheUnavailable.during('issueWatchPartyTicket')
    );
    return map(set, () => undefined);
  }

  async redeemTicket(
    ticket: string
  ): Promise<Result<WatchPartyTicketGrant | null, CacheUnavailable>> {
    const raw = await fromPromise(
      () => this.redis.getdel(CacheKeys.watchPartyTicket(ticket)),
      cacheUnavailable.during('redeemWatchPartyTicket')
    );
    return map(raw, (value) => {
      if (value === null) return null;
      const decoded = parseJson(value);
      if (isErr(decoded)) return null;
      const grant = TicketGrantSchema.safeParse(decoded.value);
      return grant.success ? grant.data : null;
    });
  }

  /**
   * The window is created with its expiry before the count rises: an INCR then EXPIRE can die
   * between the two and leave a counter that never expires, which locks the scope out for good.
   */
  async consume(
    budget: WatchPartyBudget,
    scope: string,
    rule: BudgetRule
  ): Promise<Result<GateAdmission, CacheUnavailable>> {
    const key = CacheKeys.watchPartyBudget(budget, scope);
    const counted = await fromPromise(async () => {
      await this.redis.set(key, '0', 'EX', rule.windowSeconds, 'NX');
      return this.redis.incr(key);
    }, cacheUnavailable.during('consumeWatchPartyBudget'));

    return andThenAsync(counted, async (count) =>
      count > rule.limit ? this.refusedUntilExpiry(key) : ok(ADMITTED)
    );
  }

  async check(
    budget: WatchPartyBudget,
    scope: string,
    rule: BudgetRule
  ): Promise<Result<GateAdmission, CacheUnavailable>> {
    const key = CacheKeys.watchPartyBudget(budget, scope);
    const raw = await fromPromise(
      () => this.redis.get(key),
      cacheUnavailable.during('checkWatchPartyBudget')
    );
    return andThenAsync(raw, async (value) =>
      Number(value ?? 0) >= rule.limit ? this.refusedUntilExpiry(key) : ok(ADMITTED)
    );
  }

  async reset(budget: WatchPartyBudget, scope: string): Promise<Result<void, CacheUnavailable>> {
    const deleted = await fromPromise(
      () => this.redis.del(CacheKeys.watchPartyBudget(budget, scope)),
      cacheUnavailable.during('resetWatchPartyBudget')
    );
    return map(deleted, () => undefined);
  }

  async slowMode(
    roomId: string,
    memberKey: string,
    seconds: number
  ): Promise<Result<GateAdmission, CacheUnavailable>> {
    if (seconds <= 0) return ok(ADMITTED);

    const key = CacheKeys.watchPartySlowMode(roomId, memberKey);
    const claimed = await fromPromise(
      () => this.redis.set(key, '1', 'EX', seconds, 'NX'),
      cacheUnavailable.during('claimWatchPartySlowMode')
    );
    return andThenAsync(claimed, async (reply) =>
      reply === null ? this.refusedUntilExpiry(key) : ok(ADMITTED)
    );
  }

  async setRolesVersion(
    roomId: string,
    rolesVersion: number
  ): Promise<Result<void, CacheUnavailable>> {
    const set = await fromPromise(
      () =>
        this.redis.set(
          CacheKeys.watchPartyRolesVersion(roomId),
          String(rolesVersion),
          'EX',
          this.stateTtlSeconds
        ),
      cacheUnavailable.during('setWatchPartyRolesVersion')
    );
    return map(set, () => undefined);
  }

  async rolesVersion(roomId: string): Promise<Result<number | null, CacheUnavailable>> {
    const raw = await fromPromise(
      () => this.redis.get(CacheKeys.watchPartyRolesVersion(roomId)),
      cacheUnavailable.during('readWatchPartyRolesVersion')
    );
    return map(raw, (value) => {
      const version = value === null ? Number.NaN : Number(value);
      return Number.isInteger(version) ? version : null;
    });
  }

  async voteSkip(
    roomId: string,
    itemId: string,
    memberKey: string
  ): Promise<Result<number, CacheUnavailable>> {
    const key = CacheKeys.watchPartySkipVotes(roomId, itemId);
    return fromPromise(async () => {
      await this.redis.sadd(key, memberKey);
      await this.redis.expire(key, this.stateTtlSeconds);
      return this.redis.scard(key);
    }, cacheUnavailable.during('voteWatchPartySkip'));
  }

  async clearSkipVotes(roomId: string, itemId: string): Promise<Result<void, CacheUnavailable>> {
    const deleted = await fromPromise(
      () => this.redis.del(CacheKeys.watchPartySkipVotes(roomId, itemId)),
      cacheUnavailable.during('clearWatchPartySkipVotes')
    );
    return map(deleted, () => undefined);
  }

  private async refusedUntilExpiry(key: string): Promise<Result<GateAdmission, CacheUnavailable>> {
    const ttl = await fromPromise(
      () => this.redis.ttl(key),
      cacheUnavailable.during('readWatchPartyBudgetWindow')
    );
    return map(ttl, refusedFor);
  }
}
