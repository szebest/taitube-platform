import { trace } from '@opentelemetry/api';
import { DatabaseError } from '@vp/core/ports';
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
  type UploadRepository,
  type VideoEventRecord,
  type VideoRecord,
  VideoRepository,
  type VideoScan,
  type VideoScanAbsence,
  type VideoWithDetails,
} from '@vp/core/repositories';
import { canReadVideo } from '@vp/permissions';

import { byKeysetDesc, isKeysetBefore } from './keyset';
import { selectPublicFeed } from './public-feed-query';
import {
  DEFAULT_VIDEO_RECORD,
  type InMemoryVideoRepositoryOptions,
  type InternalStep,
} from './types';

export type { InMemoryVideoRepositoryOptions };

export class InMemoryVideoRepository extends VideoRepository {
  private readonly videosMap: Map<string, VideoRecord>;
  private readonly eventsList?: VideoEventRecord[];
  private readonly renditionsMap?: Map<string, RenditionRecord>;
  private readonly stepsMap?: Map<string, InternalStep>;
  private readonly uploadsMap?: Map<string, UploadRecord>;
  private eventsRepo?: EventRepository;
  private renditionsRepo?: RenditionRepository;
  private stepsRepo?: StepRepository;
  private uploadsRepo?: UploadRepository;
  private outboxRepo?: OutboxRepository;

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

  setUploadsRepo(repo: UploadRepository) {
    this.uploadsRepo = repo;
  }
  setEventsRepo(repo: EventRepository) {
    this.eventsRepo = repo;
  }
  setRenditionsRepo(repo: RenditionRepository) {
    this.renditionsRepo = repo;
  }
  setStepsRepo(repo: StepRepository) {
    this.stepsRepo = repo;
  }

  async findById(id: string): Promise<VideoRecord | null> {
    return this.videosMap.get(id) ?? null;
  }

  getAllVideos(): VideoRecord[] {
    return Array.from(this.videosMap.values());
  }

  private async getEvents(id: string): Promise<VideoEventRecord[]> {
    if (this.eventsRepo) return this.eventsRepo.findByVideoId(id);
    return this.eventsList ? this.eventsList.filter((e) => e.videoId === id) : [];
  }

  private async getSteps(id: string): Promise<ProcessingStepRecord[]> {
    if (this.stepsRepo) return this.stepsRepo.findByVideoId(id);
    return this.stepsMap ? Array.from(this.stepsMap.values()).filter((s) => s.videoId === id) : [];
  }

  private async getRenditions(id: string): Promise<RenditionRecord[]> {
    if (this.renditionsRepo) return this.renditionsRepo.findByVideoId(id);
    return this.renditionsMap
      ? Array.from(this.renditionsMap.values()).filter((r) => r.videoId === id)
      : [];
  }

  private async getUpload(id: string): Promise<UploadRecord | null> {
    if (this.uploadsRepo) return this.uploadsRepo.findByVideoId(id);
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

  async findWithDetails(id: string): Promise<VideoWithDetails | null> {
    const video = this.videosMap.get(id);
    if (!video) return null;
    const [renditions, steps, events, upload] = await Promise.all([
      this.getRenditions(id),
      this.getSteps(id),
      this.getEvents(id),
      this.getUpload(id),
    ]);
    return { video, renditions, steps, events, upload };
  }

  async create(data: NewVideoInput): Promise<VideoRecord> {
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
    return record;
  }

  async listByOwner(options: ListVideosOptions): Promise<VideoRecord[]> {
    const { ownerId, viewer, cursor, limit, status } = options;
    const keyset = cursor && { sort: cursor.createdAt, tie: cursor.id };

    return Array.from(this.videosMap.values())
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
  }

  async listPublic(options: ListPublicVideosOptions): Promise<ListPublicVideosResult> {
    return selectPublicFeed(this.videosMap.values(), options);
  }

  async updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord> {
    const { videoId, expectedVersion, patch, userId } = options;
    const video = this.videosMap.get(videoId);
    if (!video) throw new DatabaseError(`Video ${videoId} not found`);
    if (video.version !== expectedVersion) {
      throw new DatabaseError(
        `Version conflict on video ${videoId}: expected version ${expectedVersion}`,
        {
          code: 'VERSION_CONFLICT',
        }
      );
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
    return video;
  }

  async transition(options: TransitionVideoOptions): Promise<boolean> {
    const { videoId, from, to, patch = {}, eventType, eventPayload = {}, traceId } = options;
    const video = this.videosMap.get(videoId);
    if (!video) return false;
    const allowed = Array.isArray(from) ? from : [from];
    if (!allowed.includes(video.status)) return false;

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
    return true;
  }

  private async isAbsent(video: VideoRecord, absence: VideoScanAbsence): Promise<boolean> {
    if ('step' in absence) {
      const steps = await this.getSteps(video.id);
      return !steps.some((s) => s.step === absence.step);
    }
    const events = await this.getEvents(video.id);
    return !events.some(
      (e) =>
        e.type === absence.event &&
        (!absence.forCurrentGeneration ||
          Number((e.payload as { generation?: number })?.generation ?? 0) >= video.generation)
    );
  }

  async scan(filter: VideoScan): Promise<VideoRecord[]> {
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

    return results;
  }

  async hardDelete(id: string): Promise<boolean> {
    const video = this.videosMap.get(id);
    if (!video || video.status !== 'DELETED') return false;
    this.videosMap.delete(id);
    return true;
  }

  async countInFlightByOwner(ownerId: string): Promise<number> {
    return Array.from(this.videosMap.values()).filter(
      (v) =>
        v.ownerId === ownerId &&
        (v.status === 'PROBING' || v.status === 'PROCESSING') &&
        !v.deletedAt
    ).length;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const video of this.videosMap.values()) {
      counts[video.status] = (counts[video.status] ?? 0) + 1;
    }
    return counts;
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
  ): Promise<void> {
    const video = this.videosMap.get(videoId);
    if (video) {
      video.likesCount = likesCount;
      video.dislikesCount = dislikesCount;
      video.updatedAt = new Date();
    }
  }

  clear(): void {
    this.videosMap.clear();
  }
}
