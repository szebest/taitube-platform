import type { ViewEvent } from '@vp/core/ports';

/**
 * Views taken in process, one per viewer, video and day, up to `capacity`. They are kept as events
 * rather than counts so the hand-back records each viewer in the buffer's dedup set as well.
 */
export class HeldViews {
  private readonly viewers = new Set<string>();
  private readonly views: ViewEvent[] = [];

  constructor(private readonly capacity: number) {}

  record(view: ViewEvent): 'deferred' | 'duplicate' | 'dropped' {
    const viewer = [view.videoId, view.viewDate, view.viewerId].join('|');
    if (this.viewers.has(viewer)) return 'duplicate';
    if (this.viewers.size >= this.capacity) return 'dropped';

    this.viewers.add(viewer);
    this.views.push(view);
    return 'deferred';
  }

  drain(): ViewEvent[] {
    this.viewers.clear();
    return this.views.splice(0);
  }

  restore(views: readonly ViewEvent[]): void {
    for (const view of views) this.record(view);
  }
}
