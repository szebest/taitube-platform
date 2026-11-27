import type { CacheUnavailable } from '@kit/errors';
import { type Result, ok } from '@kit/result';
import type {
  ExperimentEvent,
  PlaybackWatch,
  PlaybackWatchOutcome,
  RetentionMilestone,
  ShareLinkOpen,
  ViewBufferPort,
  ViewEvent,
  ViewRecordOutcome,
} from '@vp/core/ports';
import {
  type DeviceViewCount,
  type ExperimentCount,
  type HourlyViewCount,
  RETENTION_STEP_PERCENT,
  type RetentionCount,
  type ShareLinkCount,
  type ViewBatch,
  type ViewCount,
  type ViewDevice,
  mergeDeviceCounts,
  mergeExperimentCounts,
  mergeHourlyCounts,
  mergeShareLinkCounts,
} from '@vp/domain';

type MutableCount = { -readonly [K in keyof ViewCount]: ViewCount[K] };

interface WatchedSession {
  watched: number;
  credited: number;
  counted: boolean;
}

function countKey(videoId: string, viewDate: string): string {
  return `${videoId}|${viewDate}`;
}

/** Remembers `viewer` under `key`, and answers whether this is the first time. */
function firstSighting(seenBy: Map<string, Set<string>>, key: string, viewer: string): boolean {
  const seen = seenBy.get(key);
  if (seen?.has(viewer)) return false;
  if (seen) seen.add(viewer);
  else seenBy.set(key, new Set([viewer]));
  return true;
}

export class InMemoryViewBuffer implements ViewBufferPort {
  private readonly viewers = new Map<string, Set<string>>();
  private buffer = new Map<string, MutableCount>();
  private readonly batches = new Map<string, ViewBatch>();
  private readonly sessions = new Map<string, WatchedSession>();
  private pendingBatchId: string | undefined;
  private readonly reached = new Map<string, number>();
  private retention = new Map<string, RetentionCount>();
  private hourly: HourlyViewCount[] = [];
  private devices: DeviceViewCount[] = [];
  private readonly openers = new Map<string, Set<string>>();
  private shareLinks: ShareLinkCount[] = [];
  private experiments: ExperimentCount[] = [];

  async record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    return ok(this.recordOne(view));
  }

  async recordAll(
    views: readonly ViewEvent[]
  ): Promise<Result<ViewRecordOutcome[], CacheUnavailable>> {
    return ok(views.map((view) => this.recordOne(view)));
  }

  private recordOne(view: ViewEvent, device?: ViewDevice): ViewRecordOutcome {
    const key = countKey(view.videoId, view.viewDate);
    if (!firstSighting(this.viewers, key, view.viewerId)) return 'duplicate';

    this.addOne({ videoId: view.videoId, viewDate: view.viewDate, views: 1, watchSeconds: 0 });
    this.hourly.push({ videoId: view.videoId, viewHour: view.viewHour, views: 1 });
    if (device) {
      this.devices.push({ videoId: view.videoId, viewDate: view.viewDate, device, views: 1 });
    }
    return 'counted';
  }

  async recordPlayback({
    videoId,
    sessionId,
    viewDate,
    viewHour,
    device,
    watchedSeconds,
    requiredSeconds,
    shareLinkId,
    experiment,
  }: PlaybackWatch): Promise<Result<PlaybackWatchOutcome, CacheUnavailable>> {
    const key = `${videoId}|${sessionId}`;
    const session = this.sessions.get(key) ?? { watched: 0, credited: 0, counted: false };
    this.sessions.set(key, session);

    session.watched += watchedSeconds;
    const whole = Math.floor(session.watched);
    if (whole > session.credited) {
      const seconds = whole - session.credited;
      this.addOne({ videoId, viewDate, views: 0, watchSeconds: seconds });
      if (shareLinkId) {
        this.shareLinks.push({
          linkId: shareLinkId,
          viewDate,
          opens: 0,
          views: 0,
          watchSeconds: seconds,
        });
      }
      if (experiment) {
        this.experiments.push({
          ...experiment,
          viewDate,
          impressions: 0,
          starts: 0,
          watchSeconds: seconds,
        });
      }
      session.credited = whole;
    }

    if (session.watched < requiredSeconds) return ok('pending');
    if (session.counted) return ok('pending');
    session.counted = true;

    const outcome = this.recordOne({ videoId, viewerId: sessionId, viewDate, viewHour }, device);
    if (outcome === 'counted' && shareLinkId) {
      this.shareLinks.push({ linkId: shareLinkId, viewDate, opens: 0, views: 1, watchSeconds: 0 });
    }
    return ok(outcome === 'counted' ? 'counted' : 'duplicate');
  }

  async recordShareLinkOpen({
    linkId,
    viewerKey,
    viewDate,
  }: ShareLinkOpen): Promise<Result<ViewRecordOutcome, CacheUnavailable>> {
    if (!firstSighting(this.openers, countKey(linkId, viewDate), viewerKey)) return ok('duplicate');
    this.shareLinks.push({ linkId, viewDate, opens: 1, views: 0, watchSeconds: 0 });
    return ok('counted');
  }

  async recordExperimentEvents(
    events: readonly ExperimentEvent[]
  ): Promise<Result<void, CacheUnavailable>> {
    for (const { experimentId, variantId, viewDate, measure } of events) {
      this.experiments.push({
        experimentId,
        variantId,
        viewDate,
        impressions: measure === 'impressions' ? 1 : 0,
        starts: measure === 'starts' ? 1 : 0,
        watchSeconds: 0,
      });
    }
    return ok();
  }

  async snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>> {
    if (this.pendingBatchId === undefined) {
      if (
        this.buffer.size === 0 &&
        this.retention.size === 0 &&
        this.hourly.length === 0 &&
        this.shareLinks.length === 0 &&
        this.experiments.length === 0
      ) {
        return ok(null);
      }
      this.batches.set(batchId, {
        batchId,
        counts: [...this.buffer.values()],
        retention: [...this.retention.values()],
        hourly: mergeHourlyCounts(this.hourly),
        devices: mergeDeviceCounts(this.devices),
        shareLinks: mergeShareLinkCounts(this.shareLinks),
        experiments: mergeExperimentCounts(this.experiments),
      });
      this.buffer = new Map();
      this.retention = new Map();
      this.hourly = [];
      this.devices = [];
      this.shareLinks = [];
      this.experiments = [];
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
    this.hourly = [];
    this.devices = [];
    this.openers.clear();
    this.shareLinks = [];
    this.experiments = [];
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
