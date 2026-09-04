import {
  DatabaseError,
  type NewVideoInput,
  type ProcessingStepRecord,
  type RenditionRecord,
  type TransitionVideoOptions,
  type UpdateVideoMetadataOptions,
  type UploadRecord,
  type VideoEventRecord,
  type VideoRecord,
  VideoRepository,
  type VideoWithDetails,
} from '@vp/core/ports';
import type { InternalStep } from './types.js';

export class InMemoryVideoRepository extends VideoRepository {
  constructor(
    private readonly videosMap: Map<string, VideoRecord>,
    private readonly eventsList: VideoEventRecord[],
    private readonly renditionsMap: Map<string, RenditionRecord>,
    private readonly stepsMap: Map<string, InternalStep>,
    private readonly uploadsMap: Map<string, UploadRecord>
  ) {
    super();
  }

  async findById(id: string): Promise<VideoRecord | null> {
    return this.videosMap.get(id) ?? null;
  }

  async findWithDetails(id: string): Promise<VideoWithDetails | null> {
    const video = this.videosMap.get(id);
    if (!video) return null;

    const renditions: RenditionRecord[] = [];
    for (const r of this.renditionsMap.values()) {
      if (r.videoId === id) {
        renditions.push(r);
      }
    }

    const steps: ProcessingStepRecord[] = [];
    for (const s of this.stepsMap.values()) {
      if (s.videoId === id) {
        steps.push({ ...s });
      }
    }

    const events = this.eventsList.filter((e) => e.videoId === id);

    let upload: UploadRecord | null = null;
    for (const u of this.uploadsMap.values()) {
      if (u.videoId === id) {
        upload = u;
        break;
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
    this.eventsList.push({
      id: this.eventsList.length + 1,
      videoId,
      type: effectiveEventType,
      payload: eventPayload,
      createdAt: now,
    });

    return true;
  }
}
