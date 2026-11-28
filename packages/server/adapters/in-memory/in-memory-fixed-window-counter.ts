import { ok, type Result } from '@kit/result';
import type { FixedWindowCounterPort, FixedWindowHit } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';

interface Window {
  count: number;
  endsAtMs: number;
}

export class InMemoryFixedWindowCounter implements FixedWindowCounterPort {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, windowMs: number): Promise<Result<FixedWindowHit, CacheUnavailable>> {
    const nowMs = this.now();
    const open = this.windows.get(key);
    const window = open && open.endsAtMs > nowMs ? open : { count: 0, endsAtMs: nowMs + windowMs };
    window.count += 1;
    this.windows.set(key, window);
    return ok({ count: window.count, resetInMs: window.endsAtMs - nowMs });
  }

  clear(): void {
    this.windows.clear();
  }
}
