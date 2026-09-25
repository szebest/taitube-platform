import type { CircuitBreaker } from '@vp/concurrency';
import type { ViewBufferPort, ViewEvent, ViewRecordOutcome } from '@vp/core/ports';
import type { ViewBatch, ViewCount } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, isOk, ok } from '@vp/result';
import { HeldViews } from './held-views';

export interface FallbackViewBufferConfig {
  primary: ViewBufferPort;
  breaker: CircuitBreaker;
  capacity: number;
  metrics: PipelineMetrics;
}

/**
 * Keeps accepting beacons while the primary buffer is unreachable. Views are held in process,
 * deduplicated per viewer as the primary would, and handed to the primary on the first call that
 * reaches it again. A process that stops while Redis is down loses what it held; `capacity` bounds
 * the memory that costs, and a view past it is dropped rather than failing the request.
 *
 * Draining is the flush's job and has a retry of its own, so `snapshot` and `release` go straight
 * to the primary.
 */
export class FallbackViewBuffer implements ViewBufferPort {
  private readonly primary: ViewBufferPort;
  private readonly breaker: CircuitBreaker;
  private readonly metrics: PipelineMetrics;
  private readonly held: HeldViews;

  constructor(config: FallbackViewBufferConfig) {
    this.primary = config.primary;
    this.breaker = config.breaker;
    this.metrics = config.metrics;
    this.held = new HeldViews(config.capacity);
  }

  async record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    if (this.breaker.allows()) {
      const recorded = await this.primary.record(view);
      if (isOk(recorded)) {
        this.succeeded();
        await this.handBack();
        return recorded;
      }
      this.failed();
    }
    return ok(this.held.record(view));
  }

  async add(counts: readonly ViewCount[]): Promise<Result<void, CacheUnavailable>> {
    return this.primary.add(counts);
  }

  async snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>> {
    return this.primary.snapshot(batchId);
  }

  async release(batchId: string): Promise<Result<void, CacheUnavailable>> {
    return this.primary.release(batchId);
  }

  private async handBack(): Promise<void> {
    const counts = this.held.drain();
    if (counts.length === 0) return;

    const added = await this.primary.add(counts);
    if (isOk(added)) return;
    this.held.restore(counts);
    this.failed();
  }

  private succeeded(): void {
    this.breaker.recordSuccess();
    this.metrics.viewBufferCircuitOpen.set(0);
  }

  private failed(): void {
    this.breaker.recordFailure();
    this.metrics.viewBufferCircuitOpen.set(this.breaker.allows() ? 0 : 1);
  }
}
