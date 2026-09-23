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
import { type Result, assertNever, err, ok, unwrapOr } from '@vp/result';

import { byKeysetDesc, isKeysetBefore } from './keyset';
import { selectPublicFeed } from './public-feed-query';
import {
  DEFAULT_VIDEO_RECORD,
  type InMemoryVideoRepositoryOptions,
  type InternalStep,
  type UploadLookup,
} from './types';

export type { InMemoryVideoRepositoryOptions };

export class InMemoryVideoRepository extends VideoRepository {
  private readonly videosMap: Map<string, VideoRecord>;
  private readonly eventsList?: VideoEventRecord[];
  private readonly renditionsMap?: Map<string, RenditionRecord>;
  private readonly stepsMap?: Map<string, InternalStep>;
  private readonly uploadsMap?: Map<string, UploadRecord>;
  private readonly eventsRepo?: EventRepository;
  private readonly renditionsRepo?: RenditionRepository;
  private readonly stepsRepo?: StepRepository;
  private readonly uploadsRepo?: UploadLookup;
  private readonly outboxRepo?: OutboxRepository;

  constructor(
    optsOrMap?: InMemoryVideoRepositoryOptions | Map<string, VideoRecord>,
    eventsList?: VideoEventRecord[],
    renditionsMap?: Map<string, RenditionRecord>,
    stepsMap?: Map<string, InternalStep>,
    uploadsMap?: Map<string, UploadRecord>
  ) {
    super();
    if (optsOrMap instanceof Map) {
      this.videosMap = optsOrMap;
      this.eventsList = eventsList;
      this.renditionsMap = renditionsMap;
      this.stepsMap = stepsMap;
      this.uploadsMap = uploadsMap;
    } else {
      this.videosMap = optsOrMap?.videosMap ?? new Map();
      this.eventsRepo = optsOrMap?.eventsRepo;
      this.renditionsRepo = optsOrMap?.renditionsRepo;
      this.stepsRepo = optsOrMap?.stepsRepo;
      this.uploadsRepo = optsOrMap?.uploadsRepo;
      this.outboxRepo = optsOrMap?.outboxRepo;
    }
  }

  async findById(id: string): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    return ok(this.videosMap.get(id) ?? null);
  }

  getAllVideos(): VideoRecord[] {
    return Array.from(this.videosMap.values());
  }

  private async getEvents(id: string): Promise<VideoEventRecord[]> {
    if (this.eventsRepo) return unwrapOr(await this.eventsRepo.findByVideoId(id), []);
    return this.eventsList ? this.eventsList.filter((e) => e.videoId === id) : [];
  }

  private async getSteps(id: string): Promise<ProcessingStepRecord[]> {
    if (this.stepsRepo) return unwrapOr(await this.stepsRepo.findByVideoId(id), []);
    return this.stepsMap ? Array.from(this.stepsMap.values()).filter((s) => s.videoId === id) : [];
  }

  private async getRenditions(id: string): Promise<RenditionRecord[]> {
    if (this.renditionsRepo) return unwrapOr(await this.renditionsRepo.findByVideoId(id), []);
    return this.renditionsMap
      ? Array.from(this.renditionsMap.values()).filter((r) => r.videoId === id)
      : [];
  }

  private async getUpload(id: string): Promise<UploadRecord | null> {
    if (this.uploadsRepo) return unwrapOr(await this.uploadsRepo.findByVideoId(id), null);
    return this.uploadsMap
      ? (Array.from(this.uploadsMap.values()).find((u) => u.videoId === id) ?? null)
      : null;
  }

  private async emitEvent(
    videoId: string,
    type: string,
    payload: Record<string, unknown>,
    traceId?: string | null
  ): Promise<void> {
    if (this.eventsRepo) {
      await this.eventsRepo.create({ videoId, type, payload, traceId });
    } else if (this.eventsList) {
      this.eventsList.push({
        id: this.eventsList.length + 1,
        videoId,
        type,
        payload,
        traceId: traceId ?? null,
        createdAt: new Date(),
      });
    }
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
    await this.emitEvent(videoId, 'video.metadata_updated', {
      patch,
      expectedVersion,
      newVersion: video.version,
      ...(userId ? { requestedBy: userId } : {}),
    });
    return ok(video);
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
    await this.emitEvent(
      videoId,
      eventType || `video.${to.toLowerCase()}`,
      eventPayload,
      effectiveTraceId
    );
    if (options.outbox && this.outboxRepo) {
      await this.outboxRepo.enqueue(options.outbox);
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
