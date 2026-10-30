import type {
  PlaybackWatch,
  PlaybackWatchOutcome,
  RetentionMilestone,
  ViewBufferPort,
  ViewEvent,
  ViewRecordOutcome,
} from '@vp/core/ports';
import {
  RETENTION_STEP_PERCENT,
  type RetentionCount,
  type ViewBatch,
  type ViewCount,
} from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

type MutableCount = { -readonly [K in keyof ViewCount]: ViewCount[K] };

interface WatchedSession {
  watched: number;
  credited: number;
  counted: boolean;
}

function countKey(videoId: string, viewDate: string): string {
  return `${videoId}|${viewDate}`;
}

export class InMemoryViewBuffer implements ViewBufferPort {
  private readonly viewers = new Map<string, Set<string>>();
  private buffer = new Map<string, MutableCount>();
  private readonly batches = new Map<string, ViewBatch>();
  private readonly sessions = new Map<string, WatchedSession>();
  private pendingBatchId: string | undefined;
  private readonly reached = new Map<string, number>();
  private retention = new Map<string, RetentionCount>();

  async record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    return ok(this.recordOne(view));
  }

  async recordAll(
    views: readonly ViewEvent[]
  ): Promise<Result<ViewRecordOutcome[], CacheUnavailable>> {
    return ok(views.map((view) => this.recordOne(view)));
  }

  private recordOne(view: ViewEvent): ViewRecordOutcome {
    const key = countKey(view.videoId, view.viewDate);
    const seen = this.viewers.get(key);
    if (seen?.has(view.viewerId)) return 'duplicate';

    if (seen) seen.add(view.viewerId);
    else this.viewers.set(key, new Set([view.viewerId]));
    this.addOne({ videoId: view.videoId, viewDate: view.viewDate, views: 1, watchSeconds: 0 });
    return 'counted';
  }

  async recordPlayback({
    videoId,
    sessionId,
    viewDate,
    watchedSeconds,
    requiredSeconds,
  }: PlaybackWatch): Promise<Result<PlaybackWatchOutcome, CacheUnavailable>> {
    const key = `${videoId}|${sessionId}`;
    const session = this.sessions.get(key) ?? { watched: 0, credited: 0, counted: false };
    this.sessions.set(key, session);

    session.watched += watchedSeconds;
    const whole = Math.floor(session.watched);
    if (whole > session.credited) {
      this.addOne({ videoId, viewDate, views: 0, watchSeconds: whole - session.credited });
      session.credited = whole;
    }

    if (session.watched < requiredSeconds) return ok('pending');
    if (session.counted) return ok('pending');
    session.counted = true;

    const outcome = this.recordOne({ videoId, viewerId: sessionId, viewDate });
    return ok(outcome === 'counted' ? 'counted' : 'duplicate');
  }

  async snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>> {
    if (this.pendingBatchId === undefined) {
      if (this.buffer.size === 0 && this.retention.size === 0) return ok(null);
      this.batches.set(batchId, {
        batchId,
        counts: [...this.buffer.values()],
        retention: [...this.retention.values()],
      });
      this.buffer = new Map();
      this.retention = new Map();
      this.pendingBatchId = batchId;
    }
    const pending = this.batches.get(this.pendingBatchId);
    return ok(pending ? { ...pending } : null);
  }

  async release(batchId: string): Promise<Result<void, CacheUnavailable>> {
    if (this.pendingBatchId === batchId) {
      this.batches.delete(batchId);
      this.pendingBatchId = undefined;
    }
    return ok();
  }

  async recordRetention({
    videoId,
    sessionId,
    percent,
  }: RetentionMilestone): Promise<Result<void, CacheUnavailable>> {
    const session = `${videoId}|${sessionId}`;
    const last = this.reached.get(session);
    const first = last === undefined ? 0 : last + RETENTION_STEP_PERCENT;
    for (let step = first; step <= percent; step += RETENTION_STEP_PERCENT) {
      const key = `${videoId}|${step}`;
      const held = this.retention.get(key);
      this.retention.set(key, { videoId, percent: step, viewers: (held?.viewers ?? 0) + 1 });
    }
    this.reached.set(session, Math.max(last ?? 0, percent));
    return ok();
  }

  clear(): void {
    this.reached.clear();
    this.retention.clear();
    this.viewers.clear();
    this.sessions.clear();
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
