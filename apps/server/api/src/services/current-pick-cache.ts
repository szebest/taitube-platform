import { type CurrentPickView, CurrentPickSchema } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import { CacheKeys } from '@vp/events';
import { ignore, isOk, parseJson, unwrapOr } from '@vp/result';

/**
 * Holds the scheduled pick until it ends, or `capSeconds` if that is sooner: the cap is what lets
 * a pick whose video turned private give way without anyone touching the schedule. Every failure
 * of the cache costs latency and never correctness, so none reaches the caller.
 */
export class CurrentPickCache {
  constructor(
    private readonly cache: CacheClient,
    private readonly capSeconds: number
  ) {}

  async read(at: number): Promise<CurrentPickView | undefined> {
    const raw = unwrapOr(await this.cache.get(CacheKeys.currentPick), null);
    if (!raw) return undefined;

    const parsed = parseJson(raw);
    if (!isOk(parsed)) return undefined;

    const view = CurrentPickSchema.safeParse(parsed.value);
    if (!view.success) return undefined;
    const { startsAt, endsAt } = view.data;
    if (!(startsAt && endsAt)) return undefined;
    return Date.parse(startsAt) <= at && at < Date.parse(endsAt) ? view.data : undefined;
  }

  async write(view: CurrentPickView, at: number): Promise<void> {
    if (!view.endsAt) return;
    const untilEnd = Math.floor((Date.parse(view.endsAt) - at) / 1000);
    const ttlSeconds = Math.min(untilEnd, this.capSeconds);
    if (ttlSeconds < 1) return;

    ignore(
      await this.cache.set(CacheKeys.currentPick, JSON.stringify(view), ttlSeconds),
      'a cold cache costs a database read, never correctness'
    );
  }

  async drop(): Promise<void> {
    ignore(
      await this.cache.del(CacheKeys.currentPick),
      'the write committed; the entry expires within the cap'
    );
  }
}
