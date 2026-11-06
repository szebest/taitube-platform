import type { Redis } from 'ioredis';
import { FakeRedis } from './fake-redis';

/** @internal The commands the live chat gate and presence send, over `FakeRedis`'s maps. */
export class FakeLiveRedis extends FakeRedis {
  static create(): Redis {
    return new FakeLiveRedis().asRedis();
  }

  async getdel(key: string): Promise<string | null> {
    const value = this.strings.get(key) ?? null;
    this.strings.delete(key);
    this.ttls.delete(key);
    return value;
  }

  async incr(key: string): Promise<number> {
    const next = Number.parseInt(this.strings.get(key) ?? '0', 10) + 1;
    this.strings.set(key, String(next));
    return next;
  }

  /** The ttl as set: the double never counts it down. */
  async ttl(key: string): Promise<number> {
    if (!(this.strings.has(key) || this.sortedSets.has(key))) return -2;
    return this.ttls.get(key) ?? -1;
  }

  async zadd(key: string, ...scoreMembers: Array<string | number>): Promise<number> {
    const set = new Map(this.sortedSets.get(key));
    for (let i = 0; i < scoreMembers.length; i += 2) {
      set.set(String(scoreMembers[i + 1]), Number(scoreMembers[i]));
    }
    this.sortedSets.set(key, set);
    return set.size;
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.sortedSets.get(key)?.delete(member) ? 1 : 0;
  }

  /** Only the `-inf` to exclusive `(max` form the presence adapter sends. */
  async zremrangebyscore(key: string, _min: '-inf', max: string): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;
    const below = Number(max.replace('(', ''));
    const stale = [...set].filter(([, score]) => score < below);
    for (const [member] of stale) set.delete(member);
    return stale.length;
  }

  async zcard(key: string): Promise<number> {
    return this.sortedSets.get(key)?.size ?? 0;
  }
}
