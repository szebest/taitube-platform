import type { ViewBufferPort, ViewEvent, ViewRecordOutcome } from '@vp/core/ports';
import type { ViewBatch, ViewCount } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

type MutableCount = { -readonly [K in keyof ViewCount]: ViewCount[K] };

function countKey(videoId: string, viewDate: string): string {
  return `${videoId}|${viewDate}`;
}

export class InMemoryViewBuffer implements ViewBufferPort {
  private readonly viewers = new Map<string, Set<string>>();
  private buffer = new Map<string, MutableCount>();
  private readonly batches = new Map<string, readonly ViewCount[]>();
  private pendingBatchId: string | undefined;

  async record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    const key = countKey(view.videoId, view.viewDate);
    const seen = this.viewers.get(key) ?? new Set<string>();
    if (seen.has(view.viewerId)) return ok('duplicate');

    seen.add(view.viewerId);
    this.viewers.set(key, seen);
    this.addOne({
      videoId: view.videoId,
      viewDate: view.viewDate,
      views: 1,
      watchSeconds: view.watchSeconds,
    });
    return ok('counted');
  }

  async add(counts: readonly ViewCount[]): Promise<Result<void, CacheUnavailable>> {
    for (const count of counts) this.addOne(count);
    return ok();
  }

  async snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>> {
    if (this.pendingBatchId === undefined) {
      if (this.buffer.size === 0) return ok(null);
      this.batches.set(batchId, [...this.buffer.values()]);
      this.buffer = new Map();
      this.pendingBatchId = batchId;
    }
    const pending = this.pendingBatchId;
    return ok({ batchId: pending, counts: [...(this.batches.get(pending) ?? [])] });
  }

  async release(batchId: string): Promise<Result<void, CacheUnavailable>> {
    if (this.pendingBatchId === batchId) {
      this.batches.delete(batchId);
      this.pendingBatchId = undefined;
    }
    return ok();
  }

  clear(): void {
    this.viewers.clear();
    this.buffer.clear();
    this.batches.clear();
    this.pendingBatchId = undefined;
  }

  private addOne(count: ViewCount): void {
    const key = countKey(count.videoId, count.viewDate);
    const current = this.buffer.get(key) ?? {
      videoId: count.videoId,
      viewDate: count.viewDate,
      views: 0,
      watchSeconds: 0,
    };
    current.views += count.views;
    current.watchSeconds += count.watchSeconds;
    this.buffer.set(key, current);
  }
}
