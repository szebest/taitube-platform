import { createHash } from 'node:crypto';
import type { PartyGuestSession, PartyGuestSessionsPort } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { fromPromise, isErr, map, parseJson, type Result } from '@vp/result';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { PartyCredentialPrincipalSchema } from './party-principal-schema';

const SessionSchema = z.object({
  principal: PartyCredentialPrincipalSchema,
  ipHash: z.string().nullable(),
});

/** The key holds the credential's hash, so a dump of Redis opens no session. */
const keyOf = (credential: string) =>
  CacheKeys.partyGuestSession(createHash('sha256').update(credential).digest('hex'));

export class RedisPartyGuestSessionsAdapter implements PartyGuestSessionsPort {
  constructor(private readonly redis: Redis) {}

  async issue(
    credential: string,
    session: PartyGuestSession,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>> {
    const set = await fromPromise(
      () => this.redis.set(keyOf(credential), JSON.stringify(session), 'EX', ttlSeconds),
      cacheUnavailable.during('issuePartyGuestSession')
    );
    return map(set, () => undefined);
  }

  async resolve(
    credential: string,
    ttlSeconds: number
  ): Promise<Result<PartyGuestSession | null, CacheUnavailable>> {
    const raw = await fromPromise(
      () => this.redis.getex(keyOf(credential), 'EX', ttlSeconds),
      cacheUnavailable.during('resolvePartyGuestSession')
    );
    return map(raw, (value) => {
      if (value === null) return null;
      const decoded = parseJson(value);
      if (isErr(decoded)) return null;
      const session = SessionSchema.safeParse(decoded.value);
      return session.success ? session.data : null;
    });
  }

  async revoke(credential: string): Promise<Result<void, CacheUnavailable>> {
    const deleted = await fromPromise(
      () => this.redis.del(keyOf(credential)),
      cacheUnavailable.during('revokePartyGuestSession')
    );
    return map(deleted, () => undefined);
  }
}
