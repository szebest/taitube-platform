import type { Redis } from 'ioredis';
import { WATCH_PARTY_PRESENCE_SCRIPTS } from '../redis-watch-party-presence.adapter';
import { FakeLiveRedis } from './fake-live-redis';
import { ranked } from './fake-sorted-set';

/** @internal The commands the watch party adapters send, over `FakeLiveRedis`'s maps. */
export class FakeWatchPartyRedis extends FakeLiveRedis {
  static override create(): Redis {
    return new FakeWatchPartyRedis().asRedis();
  }

  async getex(key: string, _mode: 'EX', ttlSeconds: number): Promise<string | null> {
    const value = this.strings.get(key) ?? null;
    if (value !== null) this.ttls.set(key, ttlSeconds);
    return value;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    return fields.filter((field) => hash?.delete(field)).length;
  }

  override async eval(
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown> {
    const keys = args.slice(0, numKeys).map(String);
    const argv = args.slice(numKeys).map(String);

    switch (script) {
      case WATCH_PARTY_PRESENCE_SCRIPTS.admit:
        return this.admitPresence(keys, argv);
      case WATCH_PARTY_PRESENCE_SCRIPTS.members:
        return this.listPresence(keys, argv);
      default:
        return super.eval(script, numKeys, ...args);
    }
  }

  private prune(keys: string[], staleBefore: string): Map<string, number> {
    const [presenceKey = '', sinceKey = ''] = keys;
    const present = this.sortedSets.get(presenceKey) ?? new Map<string, number>();
    const since = this.hashes.get(sinceKey);
    for (const [member, score] of present) {
      if (score < Number(staleBefore)) {
        present.delete(member);
        since?.delete(member);
      }
    }
    this.sortedSets.set(presenceKey, present);
    return present;
  }

  private admitPresence(keys: string[], argv: string[]): [number, number] {
    const [presenceKey = '', sinceKey = ''] = keys;
    const [staleBefore = '0', member = '', limit = '', nowMs = '0', ttl = '0'] = argv;
    const present = this.prune(keys, staleBefore);
    const known = present.has(member);
    if (!(known || limit === '' || present.size < Number(limit))) return [0, present.size];

    present.set(member, Number(nowMs));
    const since = this.hashes.get(sinceKey) ?? new Map<string, string>();
    if (!since.has(member)) since.set(member, nowMs);
    this.hashes.set(sinceKey, since);
    this.ttls.set(presenceKey, Number(ttl));
    this.ttls.set(sinceKey, Number(ttl));
    return [1, present.size];
  }

  private listPresence(keys: string[], argv: string[]): string[] {
    const [, sinceKey = ''] = keys;
    const present = this.prune(keys, argv[0] ?? '0');
    return ranked(present).flatMap((member) => [
      member,
      this.hashes.get(sinceKey)?.get(member) ?? String(present.get(member)),
    ]);
  }
}
