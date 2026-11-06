import type {
  PresenceAdmission,
  PresenceAdmissionRequest,
  PresentMember,
  WatchPartyPresencePort,
} from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { fromPromise, map, ok, type Result } from '@vp/result';
import type { Redis } from 'ioredis';

const PRUNE_STALE = `
local stale = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', '(' .. ARGV[1])
for _, member in ipairs(stale) do
  redis.call('ZREM', KEYS[1], member)
  redis.call('HDEL', KEYS[2], member)
end`;

/**
 * Both scripts run atomically on the server. `admit` prunes, counts and adds in one step: split
 * across round trips, two pods admitting the last spot at once would both see room and overfill it.
 * KEYS: the presence sorted set, then the since-time hash.
 */
export const WATCH_PARTY_PRESENCE_SCRIPTS = {
  admit: `${PRUNE_STALE}
local limit = tonumber(ARGV[3])
local present = redis.call('ZCARD', KEYS[1])
local known = redis.call('ZSCORE', KEYS[1], ARGV[2])
if known or not limit or present < limit then
  redis.call('ZADD', KEYS[1], ARGV[4], ARGV[2])
  redis.call('HSETNX', KEYS[2], ARGV[2], ARGV[4])
  redis.call('EXPIRE', KEYS[1], ARGV[5])
  redis.call('EXPIRE', KEYS[2], ARGV[5])
  if not known then present = present + 1 end
  return {1, present}
end
return {0, present}`,
  members: `${PRUNE_STALE}
local entries = redis.call('ZRANGE', KEYS[1], 0, -1, 'WITHSCORES')
local out = {}
for i = 1, #entries, 2 do
  out[#out + 1] = entries[i]
  out[#out + 1] = redis.call('HGET', KEYS[2], entries[i]) or entries[i + 1]
end
return out`,
} as const;

export interface RedisWatchPartyPresenceConfig {
  redis: Redis;
  /** How long a room's keys outlive their last write, so an abandoned room cleans itself up. */
  ttlSeconds: number;
}

function parseAdmission(reply: unknown): PresenceAdmission {
  const [admitted, present] = reply as [number, number];
  return { type: admitted === 1 ? 'admitted' : 'full', present };
}

function parseMembers(reply: unknown): PresentMember[] {
  const flat = reply as string[];
  const members: PresentMember[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    members.push({ memberKey: flat[i] as string, sinceMs: Number(flat[i + 1]) });
  }
  return members.sort((a, b) => a.sinceMs - b.sinceMs || a.memberKey.localeCompare(b.memberKey));
}

/** A sorted set per room scored by last touch, and a hash of when each member's presence began. */
export class RedisWatchPartyPresenceAdapter implements WatchPartyPresencePort {
  constructor(private readonly config: RedisWatchPartyPresenceConfig) {}

  async admit(
    roomId: string,
    memberKey: string,
    request: PresenceAdmissionRequest
  ): Promise<Result<PresenceAdmission, CacheUnavailable>> {
    const { redis, ttlSeconds } = this.config;
    const reply = await fromPromise(
      () =>
        redis.eval(
          WATCH_PARTY_PRESENCE_SCRIPTS.admit,
          2,
          CacheKeys.watchPartyPresence(roomId),
          CacheKeys.watchPartyPresenceSince(roomId),
          request.staleBeforeMs,
          memberKey,
          request.limit ?? '',
          request.nowMs,
          ttlSeconds
        ),
      cacheUnavailable.during('admitWatchPartyPresence')
    );
    return map(reply, parseAdmission);
  }

  async touch(
    roomId: string,
    memberKeys: readonly string[],
    nowMs: number
  ): Promise<Result<void, CacheUnavailable>> {
    if (memberKeys.length === 0) return ok();
    const { redis, ttlSeconds } = this.config;
    const presenceKey = CacheKeys.watchPartyPresence(roomId);
    const done = await fromPromise(async () => {
      await redis.zadd(presenceKey, ...memberKeys.flatMap((memberKey) => [nowMs, memberKey]));
      await redis.expire(presenceKey, ttlSeconds);
      await redis.expire(CacheKeys.watchPartyPresenceSince(roomId), ttlSeconds);
    }, cacheUnavailable.during('touchWatchPartyPresence'));
    return map(done, () => undefined);
  }

  async leave(roomId: string, memberKey: string): Promise<Result<void, CacheUnavailable>> {
    const { redis } = this.config;
    const done = await fromPromise(async () => {
      await redis.zrem(CacheKeys.watchPartyPresence(roomId), memberKey);
      await redis.hdel(CacheKeys.watchPartyPresenceSince(roomId), memberKey);
    }, cacheUnavailable.during('leaveWatchPartyPresence'));
    return map(done, () => undefined);
  }

  async members(
    roomId: string,
    staleBeforeMs: number
  ): Promise<Result<PresentMember[], CacheUnavailable>> {
    const reply = await fromPromise(
      () =>
        this.config.redis.eval(
          WATCH_PARTY_PRESENCE_SCRIPTS.members,
          2,
          CacheKeys.watchPartyPresence(roomId),
          CacheKeys.watchPartyPresenceSince(roomId),
          staleBeforeMs
        ),
      cacheUnavailable.during('listWatchPartyPresence')
    );
    return map(reply, parseMembers);
  }
}
