import { trace } from '@opentelemetry/api';
import {
  DEFAULT_VIDEO_SCAN_LIMIT,
  type EventRepository,
  type ListPublicVideosOptions,
  type ListPublicVideosResult,
  type ListVideosOptions,
  type NewVideoInput,
  type OutboxRepository,
  type ProcessingStepRecord,
  type RenditionRecord,
  type RenditionRepository,
  type StepRepository,
  type TransitionVideoOptions,
  type UpdateVideoMetadataOptions,
  type UploadRecord,
  type VideoEventRecord,
  type VideoRecord,
  VideoRepository,
  type VideoScan,
  type VideoScanAbsence,
  type VideoWithDetails,
} from '@vp/core/repositories';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import { canReadVideo } from '@vp/permissions';
import { type Result, assertNever, err, isErr, map, ok, unwrapOr } from '@vp/result';

import { byKeysetDesc, isKeysetBefore } from './keyset';
import { selectPublicFeed } from './public-feed-query';
import {
  DEFAULT_VIDEO_RECORD,
  type InMemoryVideoRepositoryOptions,
  type UploadLookup,
} from './types';

export type { InMemoryVideoRepositoryOptions };

export class InMemoryVideoRepository extends VideoRepository {
  private readonly videosMap = new Map<string, VideoRecord>();
  private readonly eventsRepo?: EventRepository;
  private readonly renditionsRepo?: RenditionRepository;
  private readonly stepsRepo?: StepRepository;
  private readonly uploadsRepo?: UploadLookup;
  private readonly outboxRepo?: OutboxRepository;

  constructor(options: InMemoryVideoRepositoryOptions = {}) {
    super();
    this.eventsRepo = options.eventsRepo;
    this.renditionsRepo = options.renditionsRepo;
    this.stepsRepo = options.stepsRepo;
    this.uploadsRepo = options.uploadsRepo;
    this.outboxRepo = options.outboxRepo;
  }

  async findById(id: string): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    return ok(this.videosMap.get(id) ?? null);
  }

  getAllVideos(): VideoRecord[] {
    return Array.from(this.videosMap.values());
  }

  private async getEvents(id: string): Promise<VideoEventRecord[]> {
    return this.eventsRepo ? unwrapOr(await this.eventsRepo.findByVideoId(id), []) : [];
  }

  private async getSteps(id: string): Promise<ProcessingStepRecord[]> {
    return this.stepsRepo ? unwrapOr(await this.stepsRepo.findByVideoId(id), []) : [];
  }

  private async getRenditions(id: string): Promise<RenditionRecord[]> {
    return this.renditionsRepo ? unwrapOr(await this.renditionsRepo.findByVideoId(id), []) : [];
  }

  private async getUpload(id: string): Promise<UploadRecord | null> {
    return this.uploadsRepo ? unwrapOr(await this.uploadsRepo.findByVideoId(id), null) : null;
  }

  private async emitEvent(
    videoId: string,
    type: string,
    payload: Record<string, unknown>,
    traceId?: string | null
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (!this.eventsRepo) return ok();
    return map(await this.eventsRepo.create({ videoId, type, payload, traceId }), () => undefined);
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

  async create(data: NewVideoInput): Promise<Result<VideoRecord, DatabaseUnavailable>> {
    const now = new Date();
    const record: VideoRecord = {
      ...DEFAULT_VIDEO_RECORD,
      ...data,
      visibility: data.visibility ?? 'private',
      status: data.status ?? 'UPLOADING',
      generation: data.generation ?? 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
      readyAt: data.readyAt ?? (data.status === 'READY' ? now : null),
    } as VideoRecord;
    this.videosMap.set(record.id, record);
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

  async updateMetadata(
    options: UpdateVideoMetadataOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable | VersionConflict>> {
    const { videoId, expectedVersion, patch, userId } = options;
    const video = this.videosMap.get(videoId);
    if (!video) return ok(null);
    if (video.version !== expectedVersion) {
      return err(versionConflict(videoId, expectedVersion));
    }
    video.version += 1;
    video.updatedAt = new Date();
    if (patch.title !== undefined) video.title = patch.title;
    if (patch.description !== undefined) video.description = patch.description;
    if (patch.visibility !== undefined) video.visibility = patch.visibility;
    const recorded = await this.emitEvent(videoId, 'video.metadata_updated', {
      patch,
      expectedVersion,
      newVersion: video.version,
      ...(userId ? { requestedBy: userId } : {}),
    });
    return map(recorded, () => video);
  }

  async transition(options: TransitionVideoOptions): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, from, to, patch = {}, eventType, eventPayload = {}, traceId } = options;
    const video = this.videosMap.get(videoId);
    if (!video) return ok(false);
    const allowed = Array.isArray(from) ? from : [from];
    if (!allowed.includes(video.status)) return ok(false);

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
      eventType || `video.${to.toLowerCase()}`,
      eventPayload,
      effectiveTraceId
    );
    if (isErr(recorded)) return recorded;
    if (options.outbox && this.outboxRepo) {
      const enqueued = await this.outboxRepo.enqueue(options.outbox);
      if (isErr(enqueued)) return enqueued;
    }
    return ok(true);
  }

  private async isAbsent(video: VideoRecord, absence: VideoScanAbsence): Promise<boolean> {
    switch (absence.type) {
      case 'step': {
        const steps = await this.getSteps(video.id);
        return !steps.some((s) => s.step === absence.step);
      }
      case 'event': {
        const events = await this.getEvents(video.id);
        return !events.some(
          (e) =>
            e.type === absence.event &&
            (!absence.forCurrentGeneration ||
              Number((e.payload as { generation?: number })?.generation ?? 0) >= video.generation)
        );
      }
      default:
        return assertNever(absence, 'VideoScanAbsence');
    }
  }

  async scan(filter: VideoScan): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { status, minGeneration, without, limit = DEFAULT_VIDEO_SCAN_LIMIT } = filter;
    const idle = filter.idleFor && {
      since: filter.idleFor.since,
      before: new Date(Date.now() - filter.idleFor.ms),
    };
    const results: VideoRecord[] = [];

    for (const video of this.videosMap.values()) {
      if (results.length >= limit) break;
      if (video.status !== status) continue;
      if (idle && (video[idle.since] ?? video.updatedAt) >= idle.before) continue;
      if (minGeneration !== undefined && video.generation < minGeneration) continue;
      if (without && !(await this.isAbsent(video, without))) continue;
      results.push({ ...video });
    }

    return ok(results);
  }

  async hardDelete(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const video = this.videosMap.get(id);
    if (!video || video.status !== 'DELETED') return ok(false);
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
