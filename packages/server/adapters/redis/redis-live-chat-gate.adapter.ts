import type {
  LiveChatAdmission,
  LiveChatAdmissionRules,
  LiveChatGatePort,
  LiveChatTicketGrant,
} from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { ROLES } from '@vp/permissions';
import { andThenAsync, fromPromise, isErr, map, ok, parseJson, type Result } from '@vp/result';
import type { Redis } from 'ioredis';
import { z } from 'zod';

const TicketGrantSchema = z.object({
  userId: z.string(),
  role: z.enum(ROLES),
  liveStreamId: z.string(),
});

const refusedFor = (ttlSeconds: number): LiveChatAdmission => ({
  type: 'refused',
  retryAfterSeconds: Math.max(1, ttlSeconds),
});

export class RedisLiveChatGateAdapter implements LiveChatGatePort {
  constructor(private readonly redis: Redis) {}

  async issueTicket(
    ticket: string,
    grant: LiveChatTicketGrant,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>> {
    const set = await fromPromise(
      () =>
        this.redis.set(CacheKeys.liveChatTicket(ticket), JSON.stringify(grant), 'EX', ttlSeconds),
      cacheUnavailable.during('issueLiveChatTicket')
    );
    return map(set, () => undefined);
  }

  async redeemTicket(
    ticket: string
  ): Promise<Result<LiveChatTicketGrant | null, CacheUnavailable>> {
    const raw = await fromPromise(
      () => this.redis.getdel(CacheKeys.liveChatTicket(ticket)),
      cacheUnavailable.during('redeemLiveChatTicket')
    );
    return map(raw, (value) => {
      if (value === null) return null;
      const decoded = parseJson(value);
      if (isErr(decoded)) return null;
      const grant = TicketGrantSchema.safeParse(decoded.value);
      return grant.success ? grant.data : null;
    });
  }

  /** The burst counts every attempt, refused ones too, so hammering the socket buys nothing. */
  async admit(
    liveStreamId: string,
    userId: string,
    rules: LiveChatAdmissionRules
  ): Promise<Result<LiveChatAdmission, CacheUnavailable>> {
    const burstKey = CacheKeys.liveChatBurst(liveStreamId, userId);
    const counted = await fromPromise(async () => {
      const count = await this.redis.incr(burstKey);
      if (count === 1) await this.redis.expire(burstKey, rules.burst.windowSeconds);
      return count;
    }, cacheUnavailable.during('admitLiveChat'));

    return andThenAsync(counted, async (count) => {
      if (count > rules.burst.messages) return this.refusedUntilExpiry(burstKey);
      if (rules.slowModeSeconds === 0) return ok<LiveChatAdmission>({ type: 'admitted' });

      const slowKey = CacheKeys.liveChatSlowMode(liveStreamId, userId);
      const claimed = await fromPromise(
        () => this.redis.set(slowKey, '1', 'EX', rules.slowModeSeconds, 'NX'),
        cacheUnavailable.during('admitLiveChat')
      );
      return andThenAsync(claimed, async (reply) =>
        reply === null
          ? this.refusedUntilExpiry(slowKey)
          : ok<LiveChatAdmission>({ type: 'admitted' })
      );
    });
  }

  private async refusedUntilExpiry(
    key: string
  ): Promise<Result<LiveChatAdmission, CacheUnavailable>> {
    const ttl = await fromPromise(
      () => this.redis.ttl(key),
      cacheUnavailable.during('admitLiveChat')
    );
    return map(ttl, refusedFor);
  }
}
