import {
  DatabaseError,
  type EventRepository,
  type NewVideoInput,
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
  type VideoWithDetails,
} from '@vp/core/ports';
import type { InternalStep } from './types.js';

export interface InMemoryVideoRepositoryOptions {
  videosMap?: Map<string, VideoRecord>;
  eventsRepo?: EventRepository;
  renditionsRepo?: RenditionRepository;
  stepsRepo?: StepRepository;
  uploadsRepo?: UploadRepository;
}

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

  constructor(
    optionsOrVideosMap?: InMemoryVideoRepositoryOptions | Map<string, VideoRecord>,
    eventsList?: VideoEventRecord[],
    renditionsMap?: Map<string, RenditionRecord>,
    stepsMap?: Map<string, InternalStep>,
    uploadsMap?: Map<string, UploadRecord>
  ) {
    super();
    if (optionsOrVideosMap instanceof Map) {
      this.videosMap = optionsOrVideosMap;
      this.eventsList = eventsList;
      this.renditionsMap = renditionsMap;
      this.stepsMap = stepsMap;
      this.uploadsMap = uploadsMap;
    } else {
      this.videosMap = optionsOrVideosMap?.videosMap ?? new Map();
      this.eventsRepo = optionsOrVideosMap?.eventsRepo;
      this.renditionsRepo = optionsOrVideosMap?.renditionsRepo;
      this.stepsRepo = optionsOrVideosMap?.stepsRepo;
      this.uploadsRepo = optionsOrVideosMap?.uploadsRepo;
    }
  }

  setUploadsRepo(repo: UploadRepository): void {
    this.uploadsRepo = repo;
  }

  setEventsRepo(repo: EventRepository): void {
    this.eventsRepo = repo;
  }

  setRenditionsRepo(repo: RenditionRepository): void {
    this.renditionsRepo = repo;
  }

  setStepsRepo(repo: StepRepository): void {
    this.stepsRepo = repo;
  }

  async findById(id: string): Promise<VideoRecord | null> {
    return this.videosMap.get(id) ?? null;
  }

  async findWithDetails(id: string): Promise<VideoWithDetails | null> {
    const video = this.videosMap.get(id);
    if (!video) return null;

    let renditions: RenditionRecord[] = [];
    if (this.renditionsRepo) {
      renditions = await this.renditionsRepo.findByVideoId(id);
    } else if (this.renditionsMap) {
      for (const r of this.renditionsMap.values()) {
        if (r.videoId === id) renditions.push(r);
      }
    }

    let steps: ProcessingStepRecord[] = [];
    if (this.stepsRepo) {
      steps = await this.stepsRepo.findByVideoId(id);
    } else if (this.stepsMap) {
      for (const s of this.stepsMap.values()) {
        if (s.videoId === id) steps.push({ ...s });
      }
    }

    let events: VideoEventRecord[] = [];
    if (this.eventsRepo) {
      events = await this.eventsRepo.findByVideoId(id);
    } else if (this.eventsList) {
      events = this.eventsList.filter((e) => e.videoId === id);
    }

    let upload: UploadRecord | null = null;
    if (this.uploadsRepo) {
      upload = await this.uploadsRepo.findByVideoId(id);
    } else if (this.uploadsMap) {
      for (const u of this.uploadsMap.values()) {
        if (u.videoId === id) {
          upload = u;
          break;
        }
      }
    }

    return {
      video,
      renditions,
      steps,
      events,
      upload,
    };
  }

  async create(data: NewVideoInput): Promise<VideoRecord> {
    const now = new Date();
    const record: VideoRecord = {
      id: data.id,
      ownerId: data.ownerId,
      title: data.title ?? null,
      description: data.description ?? null,
      visibility: data.visibility ?? 'private',
      status: data.status ?? 'UPLOADING',
      sourceKey: data.sourceKey,
      sourceSizeBytes: data.sourceSizeBytes ?? null,
      durationMs: data.durationMs ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      fps: data.fps ?? null,
      ladder: data.ladder ?? null,
      masterPlaylistKey: data.masterPlaylistKey ?? null,
      posterKey: data.posterKey ?? null,
      spriteKey: data.spriteKey ?? null,
      playbackUrl: data.playbackUrl ?? null,
      posterUrl: data.posterUrl ?? null,
      spriteUrl: data.spriteUrl ?? null,
      spriteVttUrl: data.spriteVttUrl ?? null,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      generation: data.generation ?? 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
      readyAt: data.readyAt ?? (data.status === 'READY' ? now : null),
    };
    this.videosMap.set(record.id, record);
    return record;
  }

  async updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord> {
    const { videoId, expectedVersion, patch } = options;
    const video = this.videosMap.get(videoId);
    if (!video) {
      throw new DatabaseError(`Video ${videoId} not found`);
    }

    if (video.version !== expectedVersion) {
      throw new DatabaseError(
        `Version conflict on video ${videoId}: expected version ${expectedVersion}`,
        { code: 'VERSION_CONFLICT' }
      );
    }

    video.version += 1;
    video.updatedAt = new Date();
    if (patch.title !== undefined) video.title = patch.title;
    if (patch.description !== undefined) video.description = patch.description;
    if (patch.visibility !== undefined) video.visibility = patch.visibility;

    return video;
  }

  async transition(options: TransitionVideoOptions): Promise<boolean> {
    const { videoId, from, to, patch = {}, eventType, eventPayload = {} } = options;
    const video = this.videosMap.get(videoId);
    if (!video) return false;

    const allowedSources = Array.isArray(from) ? from : [from];
    if (!allowedSources.includes(video.status)) {
      return false;
    }

    const now = new Date();
    Object.assign(video, {
      ...patch,
      status: to,
      updatedAt: now,
      readyAt: to === 'READY' ? now : video.readyAt,
    });

    const effectiveEventType = eventType || `video.${to.toLowerCase()}`;
    if (this.eventsRepo) {
      await this.eventsRepo.create({
        videoId,
        type: effectiveEventType,
        payload: eventPayload,
      });
    } else if (this.eventsList) {
      this.eventsList.push({
        id: this.eventsList.length + 1,
        videoId,
        type: effectiveEventType,
        payload: eventPayload,
        createdAt: now,
      });
    }

    return true;
  }

  async findStaleUploading(thresholdMs: number, limit = 100): Promise<VideoRecord[]> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const results: VideoRecord[] = [];
    for (const video of this.videosMap.values()) {
      if (video.status === 'UPLOADING' && video.updatedAt < cutoff) {
        results.push({ ...video });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async findStaleUploadedWithoutProbe(thresholdMs: number, limit = 100): Promise<VideoRecord[]> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const results: VideoRecord[] = [];
    for (const video of this.videosMap.values()) {
      if (video.status === 'UPLOADED' && video.updatedAt < cutoff) {
        let hasProbe = false;
        if (this.stepsRepo) {
          const steps = await this.stepsRepo.findByVideoId(video.id);
          hasProbe = steps.some((s) => s.step === 'probe');
        } else if (this.stepsMap) {
          for (const s of this.stepsMap.values()) {
            if (s.videoId === video.id && s.step === 'probe') {
              hasProbe = true;
              break;
            }
          }
        }
        if (!hasProbe) {
          results.push({ ...video });
          if (results.length >= limit) break;
        }
      }
    }
    return results;
  }

  async findStaleProcessing(thresholdMs: number, limit = 100): Promise<VideoRecord[]> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const results: VideoRecord[] = [];
    for (const video of this.videosMap.values()) {
      if (video.status === 'PROCESSING' && video.updatedAt < cutoff) {
        results.push({ ...video });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async findSoftDeleted(thresholdMs: number, limit = 50): Promise<VideoRecord[]> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const results: VideoRecord[] = [];
    for (const video of this.videosMap.values()) {
      if (video.status === 'DELETED') {
        const deletedTime = (video as unknown as { deletedAt?: Date }).deletedAt ?? video.updatedAt;
        if (deletedTime < cutoff) {
          results.push({ ...video });
          if (results.length >= limit) break;
        }
      }
    }
    return results;
  }

  async findExpiredRaw(retentionDays: number, limit = 50): Promise<VideoRecord[]> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const results: VideoRecord[] = [];
    for (const video of this.videosMap.values()) {
      if (video.status === 'READY') {
        const readyTime = video.readyAt ?? video.updatedAt;
        if (readyTime < cutoff) {
          let alreadyExpired = false;
          if (this.eventsRepo) {
            const events = await this.eventsRepo.findByVideoId(video.id);
            alreadyExpired = events.some((e) => e.type === 'video.raw_expired');
          } else if (this.eventsList) {
            alreadyExpired = this.eventsList.some(
              (e) => e.videoId === video.id && e.type === 'video.raw_expired'
            );
          }
          if (!alreadyExpired) {
            results.push({ ...video });
            if (results.length >= limit) break;
          }
        }
      }
    }
    return results;
  }

  async findReadyWithOldGenerations(limit = 50): Promise<VideoRecord[]> {
    const results: VideoRecord[] = [];
    for (const video of this.videosMap.values()) {
      const currentGen = video.generation || 1;
      if (video.status === 'READY' && currentGen > 1) {
        let alreadyPurged = false;
        if (this.eventsRepo) {
          const events = await this.eventsRepo.findByVideoId(video.id);
          alreadyPurged = events.some(
            (e) =>
              e.type === 'video.generation_purged' &&
              Number((e.payload as { generation?: number })?.generation ?? 0) >= currentGen
          );
        } else if (this.eventsList) {
          alreadyPurged = this.eventsList.some(
            (e) =>
              e.videoId === video.id &&
              e.type === 'video.generation_purged' &&
              Number((e.payload as { generation?: number })?.generation ?? 0) >= currentGen
          );
        }
        if (!alreadyPurged) {
          results.push({ ...video });
          if (results.length >= limit) break;
        }
      }
    }
    return results;
  }

  async hardDelete(id: string): Promise<boolean> {
    const video = this.videosMap.get(id);
    if (!video || video.status !== 'DELETED') {
      return false;
    }
    this.videosMap.delete(id);
    return true;
  }

  async countInFlightByOwner(ownerId: string): Promise<number> {
    let count = 0;
    for (const video of this.videosMap.values()) {
      if (
        video.ownerId === ownerId &&
        (video.status === 'PROBING' || video.status === 'PROCESSING') &&
        !video.deletedAt
      ) {
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.videosMap.clear();
  }
}
