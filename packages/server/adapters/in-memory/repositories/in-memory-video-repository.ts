import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, isErr, map, ok, unwrapOr } from '@kit/result';
import { trace } from '@opentelemetry/api';
import {
  type ListPublicVideosOptions,
  type ListPublicVideosResult,
  type ListVideosOptions,
  type NewVideoInput,
  type ProcessingStepRecord,
  type RenditionRecord,
  type TransitionVideoOptions,
  type UploadRecord,
  type VideoEventRecord,
  type VideoRecord,
  VideoRepository,
  type VideoScan,
  type VideoWithDetails,
} from '@vp/core/repositories';
import { type NewChannelAuditEntry, resolveVideoTransition, videoStatusChanged } from '@vp/domain';
import { VIDEO_LIFECYCLE } from '@vp/domain-rules';
import { transitionNotificationJobs } from '@vp/job-contracts';
import { canReadVideo } from '@vp/permissions';
import { type Clock, realClock } from './clock';
import { byKeysetDesc, isKeysetBefore } from './keyset';
import { newVideoRecord } from './new-video-record';
import { selectPublicFeed } from './public-feed-query';
import type { InMemoryVideoRepositoryOptions } from './types';
import { selectVideoScan } from './video-scan-query';

export type { InMemoryVideoRepositoryOptions };

export class InMemoryVideoRepository extends VideoRepository {
  private readonly videosMap = new Map<string, VideoRecord>();
  private readonly now: Clock;

  constructor(private readonly deps: InMemoryVideoRepositoryOptions = {}) {
    super();
    this.now = deps.now ?? realClock;
  }

  async findById(id: string): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    return ok(this.videosMap.get(id) ?? null);
  }

  async listReadyAfter(
    videoIds: readonly string[],
    readyAfter: Date
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const wanted = new Set(videoIds);
    return ok(
      this.getAllVideos().filter(
        ({ id, readyAt }) => wanted.has(id) && readyAt !== null && readyAt > readyAfter
      )
    );
  }

  getAllVideos(): VideoRecord[] {
    return Array.from(this.videosMap.values());
  }

  addViews(videoId: string, views: number): void {
    const video = this.videosMap.get(videoId);
    if (video) video.viewsCount = (video.viewsCount ?? 0) + views;
  }

  setPasswordProtected(videoId: string, passwordProtected: boolean): boolean {
    const video = this.videosMap.get(videoId);
    if (video) video.passwordProtected = passwordProtected;
    return video !== undefined;
  }

  private async getEvents(id: string): Promise<VideoEventRecord[]> {
    return this.deps.eventsRepo ? unwrapOr(await this.deps.eventsRepo.findByVideoId(id), []) : [];
  }

  private async getSteps(id: string): Promise<ProcessingStepRecord[]> {
    return this.deps.stepsRepo ? unwrapOr(await this.deps.stepsRepo.findByVideoId(id), []) : [];
  }

  private async getRenditions(id: string): Promise<RenditionRecord[]> {
    return this.deps.renditionsRepo
      ? unwrapOr(await this.deps.renditionsRepo.findByVideoId(id), [])
      : [];
  }

  private async getUpload(id: string): Promise<UploadRecord | null> {
    return this.deps.uploadsRepo
      ? unwrapOr(await this.deps.uploadsRepo.findByVideoId(id), null)
      : null;
  }

  private async emitEvent(
    videoId: string,
    type: string,
    payload: Record<string, unknown>,
    traceId?: string | null
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (!this.deps.eventsRepo) return ok();
    return map(
      await this.deps.eventsRepo.create({ videoId, type, payload, traceId }),
      () => undefined
    );
  }

  async findWithDetails(id: string): Promise<Result<VideoWithDetails | null, DatabaseUnavailable>> {
    const video = this.videosMap.get(id);
    if (!video) return ok(null);
    const [renditions, steps, events, upload] = await Promise.all([
      this.getRenditions(id),
      this.getSteps(id),
      this.getEvents(id),
      this.getUpload(id),
    ]);
    return ok({ video, renditions, steps, events, upload });
  }

  async create(
    data: NewVideoInput,
    audit?: NewChannelAuditEntry
  ): Promise<Result<VideoRecord, DatabaseUnavailable>> {
    const record = newVideoRecord(data, new Date());
    this.videosMap.set(record.id, record);
    if (audit && this.deps.auditRepo) {
      const appended = await this.deps.auditRepo.append(audit);
      if (isErr(appended)) return appended;
    }
    return ok(record);
  }

  async listByOwner(
    options: ListVideosOptions
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { ownerId, viewer, cursor, limit, status } = options;
    const keyset = cursor && { sort: cursor.createdAt, tie: cursor.id };

    const rows = Array.from(this.videosMap.values())
      .filter(
        (v) =>
          v.ownerId === ownerId &&
          canReadVideo({ user: viewer ?? null, video: v }) &&
          (status ? v.status === status : v.status !== 'DELETED') &&
          isKeysetBefore({ sort: v.createdAt, tie: v.id }, keyset)
      )
      .sort((a, b) =>
        byKeysetDesc({ sort: a.createdAt, tie: a.id }, { sort: b.createdAt, tie: b.id })
      )
      .slice(0, limit + 1);

    return ok(rows);
  }

  async listPublic(
    options: ListPublicVideosOptions
  ): Promise<Result<ListPublicVideosResult, DatabaseUnavailable>> {
    return ok(selectPublicFeed(this.videosMap.values(), options));
  }

  async transition(options: TransitionVideoOptions): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, generation, patch = {}, eventPayload = {}, traceId } = options;
    const { edge, from, to, event } = resolveVideoTransition(options);
    const video = this.videosMap.get(videoId);
    if (!video || !from.includes(video.status)) return ok(false);
    if (generation !== undefined && video.generation !== generation) return ok(false);
    if (!VIDEO_LIFECYCLE.hasEdge(video.status, to)) {
      throw new Error(`${video.status} -> ${to} is not an edge of VIDEO_LIFECYCLE`);
    }

    const activeSpan = trace.getActiveSpan();
    const effectiveTraceId = traceId || (activeSpan ? activeSpan.spanContext().traceId : null);

    const now = new Date();
    Object.assign(video, {
      ...patch,
      status: to,
      updatedAt: now,
      readyAt: to === 'READY' ? now : video.readyAt,
    });
    const recorded = await this.emitEvent(
      videoId,
      event || `video.${to.toLowerCase()}`,
      eventPayload,
      effectiveTraceId
    );
    if (isErr(recorded)) return recorded;
    if (options.outbox && this.deps.outboxRepo) {
      const enqueued = await this.deps.outboxRepo.enqueue(options.outbox);
      if (isErr(enqueued)) return enqueued;
    }
    for (const job of edge ? transitionNotificationJobs(videoId, edge, video.visibility) : []) {
      const enqueued = await this.deps.outboxRepo?.enqueue(job);
      if (enqueued && isErr(enqueued)) return enqueued;
    }
    if (this.deps.userEventsRepo) {
      const appended = await this.deps.userEventsRepo.append({
        userId: video.ownerId,
        ...videoStatusChanged(videoId, to),
      });
      if (isErr(appended)) return appended;
    }
    return ok(true);
  }

  async scan(filter: VideoScan): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    return ok(
      await selectVideoScan(this.videosMap.values(), filter, this.now(), {
        steps: (id) => this.getSteps(id),
        events: (id) => this.getEvents(id),
      })
    );
  }

  async hardDelete(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const video = this.videosMap.get(id);
    if (video?.status !== 'DELETED') return ok(false);
    this.videosMap.delete(id);
    return ok(true);
  }

  async countInFlightByOwner(ownerId: string): Promise<Result<number, DatabaseUnavailable>> {
    const inFlight = Array.from(this.videosMap.values()).filter(
      (v) =>
        v.ownerId === ownerId &&
        (v.status === 'PROBING' || v.status === 'PROCESSING') &&
        !v.deletedAt
    );

    return ok(inFlight.length);
  }

  async countByStatus(): Promise<Result<Record<string, number>, DatabaseUnavailable>> {
    const counts: Record<string, number> = {};
    for (const video of this.videosMap.values()) {
      counts[video.status] = (counts[video.status] ?? 0) + 1;
    }
    return ok(counts);
  }

  countByCategoryId(categoryId: string): number {
    let count = 0;
    for (const v of this.videosMap.values()) {
      if (v.categoryId === categoryId && !v.deletedAt) {
        count++;
      }
    }
    return count;
  }

  async updateReactionCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<Result<void, DatabaseUnavailable>> {
    const video = this.videosMap.get(videoId);
    if (video) {
      video.likesCount = likesCount;
      video.dislikesCount = dislikesCount;
      video.updatedAt = new Date();
    }
    return ok();
  }

  clear(): void {
    this.videosMap.clear();
  }
}
