import type { ViewEvent } from '@vp/core/ports';
import type { ViewCount } from '@vp/domain';

type HeldCount = { -readonly [K in keyof ViewCount]: ViewCount[K] };

/** Views counted in process, with the viewers already seen, up to `capacity` distinct viewers. */
export class HeldViews {
  private readonly viewers = new Set<string>();
  private readonly counts = new Map<string, HeldCount>();

  constructor(private readonly capacity: number) {}

  record(view: ViewEvent): 'deferred' | 'duplicate' | 'dropped' {
    const viewer = [view.videoId, view.viewDate, view.viewerId].join('|');
    if (this.viewers.has(viewer)) return 'duplicate';
    if (this.viewers.size >= this.capacity) return 'dropped';

    this.viewers.add(viewer);
    this.merge({
      videoId: view.videoId,
      viewDate: view.viewDate,
      views: 1,
      watchSeconds: view.watchSeconds,
    });
    return 'deferred';
  }

  drain(): ViewCount[] {
    const counts = [...this.counts.values()];
    this.counts.clear();
    this.viewers.clear();
    return counts;
  }

  restore(counts: readonly ViewCount[]): void {
    for (const count of counts) this.merge(count);
  }

  private merge(count: ViewCount): void {
    const key = [count.videoId, count.viewDate].join('|');
    const held = this.counts.get(key) ?? {
      videoId: count.videoId,
      viewDate: count.viewDate,
      views: 0,
      watchSeconds: 0,
    };
    held.views += count.views;
    held.watchSeconds += count.watchSeconds;
    this.counts.set(key, held);
  }
}
