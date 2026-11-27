import * as path from 'node:path';
import { MS_PER_SECOND } from '@kit/primitives';
import { type Result, err, isErr, ok } from '@kit/result';
import type { StorageClient } from '@vp/core/ports';
import type { VideoGenerationRepository, VideoRepository } from '@vp/core/repositories';
import { nextGeneration } from '@vp/domain';
import {
  type GenerationInProgress,
  type GenerationStartFailure,
  type ReplacementNotUploaded,
  decideGenerationStart,
  generationInProgress,
  replacementNotUploaded,
} from '@vp/domain-rules';
import type { StorageUnavailable } from '@vp/errors';
import { applyEditsOutbox } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { replacementSourceKey } from '@vp/storage';
import {
  ALLOWED_CONTENT_TYPES,
  type StartUploadFailure,
  validateStartUpload,
} from '@vp/validation';
import { type EditAccessFailure, editableVideo } from './video-edit-access';

export interface VideoReplacementServiceDeps {
  videos: VideoRepository;
  generations: VideoGenerationRepository;
  storage: StorageClient;
  rawBucket: string;
  maxUploadBytes: number;
  presignedUrlTtlSeconds: number;
  traceparent: () => string;
  now: () => number;
}

export interface ReplacementUpload {
  generation: number;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export type StartReplacementFailure =
  | EditAccessFailure
  | StartUploadFailure
  | GenerationStartFailure
  | GenerationInProgress
  | StorageUnavailable;

export type CompleteReplacementFailure =
  | EditAccessFailure
  | ReplacementNotUploaded
  | StorageUnavailable;

/**
 * A new file for a video that keeps its id, URL and numbers: a presigned PUT into a new generation,
 * then a render that swaps it in once its ladder is complete, while the current file keeps playing.
 */
export class VideoReplacementService {
  constructor(private readonly deps: VideoReplacementServiceDeps) {}

  async start(
    user: UserContext,
    videoId: string,
    file: { filename: string; sizeBytes: number; contentType: string }
  ): Promise<Result<ReplacementUpload, StartReplacementFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    const validated = validateStartUpload(file, {
      maxBytes: this.deps.maxUploadBytes,
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
    });
    if (isErr(validated)) return validated;
    const known = await this.deps.generations.list(videoId);
    if (isErr(known)) return known;
    const startable = decideGenerationStart(video.value, known.value);
    if (isErr(startable)) return startable;

    const generation = nextGeneration(video.value.generation, known.value);
    const sourceKey = replacementSourceKey(
      videoId,
      generation,
      path.extname(file.filename) || '.mp4'
    );
    const presigned = await this.deps.storage.createPresignedPutUrl({
      bucket: this.deps.rawBucket,
      key: sourceKey,
      contentType: file.contentType,
      contentLength: file.sizeBytes,
      expiresInSeconds: this.deps.presignedUrlTtlSeconds,
    });
    if (isErr(presigned)) return presigned;

    const expiresAt = new Date(this.deps.now() + this.deps.presignedUrlTtlSeconds * MS_PER_SECOND);
    const opened = await this.deps.generations.openReplacement({
      videoId,
      generation,
      replacesGeneration: video.value.generation,
      sourceKey,
      uploadExpiresAt: expiresAt,
    });
    if (isErr(opened)) return opened;
    if (!opened.value) return err(generationInProgress(videoId));
    return ok({
      generation,
      uploadUrl: presigned.value.url,
      headers: presigned.value.headers,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /** The upload landed: queue its render. A generation that is not waiting for its file refuses. */
  async complete(
    user: UserContext,
    videoId: string,
    generation: number
  ): Promise<Result<{ generation: number; status: 'rendering' }, CompleteReplacementFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    const known = await this.deps.generations.list(videoId);
    if (isErr(known)) return known;
    const sourceKey = known.value.find((row) => row.generation === generation)?.sourceKey;
    if (!sourceKey) return err(replacementNotUploaded(videoId, generation));
    const uploaded = await this.deps.storage.headObject(this.deps.rawBucket, sourceKey);
    if (isErr(uploaded)) return uploaded;
    if (!uploaded.value) return err(replacementNotUploaded(videoId, generation));

    const started = await this.deps.generations.startRender(
      videoId,
      generation,
      applyEditsOutbox({ videoId, generation, traceparent: this.deps.traceparent() })
    );
    if (isErr(started)) return started;
    return started.value
      ? ok({ generation, status: 'rendering' })
      : err(replacementNotUploaded(videoId, generation));
  }
}
