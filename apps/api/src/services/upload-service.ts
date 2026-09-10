import * as path from 'node:path';
import type {
  EventRepository,
  JobQueue,
  MultipartStorage,
  StorageClient,
  StoragePresignedPartInfo,
  StorageUploadedPartInfo,
  UploadRepository,
  UserRepository,
  VideoRepository,
} from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import { createTraceparent, getActiveSpanContext, getActiveTraceparent } from '@vp/observability';
import {
  MULTIPART_THRESHOLD_BYTES,
  calculatePartSize,
  calculateTotalParts,
  rawSourceKey,
} from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import type { AuthUser } from '../plugins/auth.js';

export interface InitiateUploadParams {
  filename: string;
  sizeBytes: number;
  contentType: string;
  strategy?: 'single' | 'multipart';
  sha256?: string;
  title?: string;
  visibility?: 'private' | 'unlisted' | 'public';
}

export interface InitiateUploadResult {
  videoId: string;
  uploadId: string;
  strategy: 'single' | 'multipart';
  singleUrl?: string;
  headers?: Record<string, string>;
  partSizeBytes?: number;
  partsExpected?: number;
  parts?: StoragePresignedPartInfo[];
  expiresAt: string;
}

export interface UploadResumeInfo {
  status: string;
  strategy: string;
  partSizeBytes?: number | null;
  partsExpected?: number | null;
  uploadedParts?: StorageUploadedPartInfo[];
}

export interface CompleteUploadResult {
  videoId: string;
  status: string;
  admission?: 'admitted' | 'held';
}

export interface UploadServiceDeps {
  uploads: UploadRepository;
  videos: VideoRepository;
  events: EventRepository;
  users?: UserRepository;
  storage: StorageClient;
  multipart: MultipartStorage;
  rawBucket?: string;
  probeQueue?: JobQueue;
  multipartThresholdBytes?: number;
  presignedUrlTtlSeconds?: number;
  maxInflightPerUser?: number;
}

/**
 * UploadService — Deep domain module managing video upload lifecycles (SDD §3.1, §6.1).
 *
 * Encapsulates:
 * 1. Single vs. multipart storage strategy selection
 * 2. Presigned S3 URL issuance and batching
 * 3. In-flight upload state querying (backed by S3 ListParts)
 * 4. Completion validation, HeadObject verification, and probe enqueueing
 * 5. Multipart abort and storage cleanup
 */
export class UploadService {
  private readonly uploads: UploadRepository;
  private readonly videos: VideoRepository;
  private readonly events: EventRepository;
  private readonly users?: UserRepository;
  private readonly storage: StorageClient;
  private readonly multipart: MultipartStorage;
  private readonly rawBucket: string;
  private readonly probeQueue?: JobQueue;
  private readonly multipartThresholdBytes: number;
  private readonly presignedUrlTtlSeconds: number;
  private readonly maxInflightPerUser: number;

  constructor(deps: UploadServiceDeps) {
    this.uploads = deps.uploads;
    this.videos = deps.videos;
    this.events = deps.events;
    this.users = deps.users;
    this.storage = deps.storage;
    this.multipart = deps.multipart;
    this.rawBucket = deps.rawBucket || process.env['STORAGE_RAW_BUCKET'] || 'raw';
    this.probeQueue = deps.probeQueue;
    this.multipartThresholdBytes = deps.multipartThresholdBytes ?? MULTIPART_THRESHOLD_BYTES;
    this.presignedUrlTtlSeconds = deps.presignedUrlTtlSeconds ?? 15 * 60; // 15 minutes
    this.maxInflightPerUser =
      deps.maxInflightPerUser ??
      (process.env['MAX_INFLIGHT_PER_USER']
        ? Number.parseInt(process.env['MAX_INFLIGHT_PER_USER'], 10)
        : 3);
  }

  /**
   * Initiates a new video upload (single PUT or multipart).
   */
  async initiate(user: AuthUser, params: InitiateUploadParams): Promise<InitiateUploadResult> {
    const { filename, sizeBytes, contentType, sha256, title, visibility } = params;

    const videoId = uuidv7();
    const uploadId = uuidv7();
    const ext = path.extname(filename).slice(1) || 'mp4';
    const sourceKey = rawSourceKey(videoId, ext);
    const expiresAt = new Date(Date.now() + this.presignedUrlTtlSeconds * 1000);

    const isMultipart = params.strategy
      ? params.strategy === 'multipart'
      : sizeBytes > this.multipartThresholdBytes;

    if (!isMultipart) {
      // 1. Single PUT Strategy
      const presigned = await this.storage.createPresignedPutUrl({
        bucket: this.rawBucket,
        key: sourceKey,
        contentType,
        contentLength: sizeBytes,
        expiresInSeconds: this.presignedUrlTtlSeconds,
      });

      await this.videos.create({
        id: videoId,
        ownerId: user.id,
        title: title || filename,
        visibility: visibility || 'private',
        status: 'UPLOADING',
        sourceKey,
        sourceSizeBytes: sizeBytes,
      });

      await this.uploads.create({
        id: uploadId,
        videoId,
        strategy: 'single',
        status: 'OPEN',
        partSizeBytes: sizeBytes,
        partsExpected: 1,
        declaredSizeBytes: sizeBytes,
        declaredContentType: contentType,
        sha256,
        expiresAt,
      });

      await this.events.create({
        videoId,
        type: 'upload.initiated',
        payload: {
          uploadId,
          strategy: 'single',
          sizeBytes,
          filename,
        },
      });

      return {
        videoId,
        uploadId,
        strategy: 'single',
        singleUrl: presigned.url,
        headers: presigned.headers,
        expiresAt: expiresAt.toISOString(),
      };
    }

    // 2. Multipart Upload Strategy
    const partSizeBytes = calculatePartSize(sizeBytes);
    const partsExpected = calculateTotalParts(sizeBytes, partSizeBytes);

    const s3MultipartUploadId = await this.multipart.createMultipartUpload(
      this.rawBucket,
      sourceKey,
      contentType
    );

    await this.videos.create({
      id: videoId,
      ownerId: user.id,
      title: title || filename,
      visibility: visibility || 'private',
      status: 'UPLOADING',
      sourceKey,
      sourceSizeBytes: sizeBytes,
    });

    await this.uploads.create({
      id: uploadId,
      videoId,
      strategy: 'multipart',
      status: 'OPEN',
      multipartUploadId: s3MultipartUploadId,
      partSizeBytes,
      partsExpected,
      declaredSizeBytes: sizeBytes,
      declaredContentType: contentType,
      sha256,
      expiresAt,
    });

    await this.events.create({
      videoId,
      type: 'upload.initiated',
      payload: {
        uploadId,
        strategy: 'multipart',
        sizeBytes,
        filename,
        partSizeBytes,
        partsExpected,
        multipartUploadId: s3MultipartUploadId,
      },
    });

    const initialBatchCount = Math.min(partsExpected, 100);
    const parts: StoragePresignedPartInfo[] = [];

    for (let p = 1; p <= initialBatchCount; p++) {
      const partInfo = await this.multipart.createPresignedPartUrl({
        bucket: this.rawBucket,
        key: sourceKey,
        uploadId: s3MultipartUploadId,
        partNumber: p,
        expiresInSeconds: this.presignedUrlTtlSeconds,
      });
      parts.push(partInfo);
    }

    return {
      videoId,
      uploadId,
      strategy: 'multipart',
      partSizeBytes,
      partsExpected,
      parts,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Retrieves resume information for an in-flight upload, querying S3 ListParts.
   */
  async getResumeInfo(user: AuthUser, uploadId: string): Promise<UploadResumeInfo> {
    const record = await this.uploads.findWithVideo(uploadId);
    if (!record) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
    }

    const { upload, video } = record;
    this.assertOwnership(user, video.ownerId, 'view this upload');

    if (upload.status !== 'OPEN') {
      throw new PermanentError(
        ErrorCodes.UPLOAD_NOT_OPEN,
        `Upload is not open (current status: ${upload.status})`
      );
    }

    if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
      return {
        status: upload.status,
        strategy: upload.strategy,
      };
    }

    const uploadedParts = await this.multipart.listMultipartParts(
      this.rawBucket,
      video.sourceKey,
      upload.multipartUploadId
    );

    return {
      status: upload.status,
      strategy: 'multipart',
      partSizeBytes: upload.partSizeBytes,
      partsExpected: upload.partsExpected,
      uploadedParts,
    };
  }

  /**
   * Issues subsequent batches of presigned part URLs.
   */
  async issuePartUrls(
    user: AuthUser,
    uploadId: string,
    from: number,
    count: number
  ): Promise<StoragePresignedPartInfo[]> {
    const record = await this.uploads.findWithVideo(uploadId);
    if (!record) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
    }

    const { upload, video } = record;
    this.assertOwnership(user, video.ownerId, 'request parts for this upload');

    if (upload.status !== 'OPEN') {
      throw new PermanentError(
        ErrorCodes.UPLOAD_NOT_OPEN,
        `Upload is not open (current status: ${upload.status})`
      );
    }

    if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
      throw new PermanentError(
        ErrorCodes.VALIDATION_FAILED,
        'Cannot request part URLs for a single PUT upload'
      );
    }

    const totalExpected = upload.partsExpected || 1;
    const endPart = Math.min(from + count - 1, totalExpected);
    const parts: StoragePresignedPartInfo[] = [];

    for (let p = from; p <= endPart; p++) {
      const partInfo = await this.multipart.createPresignedPartUrl({
        bucket: this.rawBucket,
        key: video.sourceKey,
        uploadId: upload.multipartUploadId,
        partNumber: p,
        expiresInSeconds: this.presignedUrlTtlSeconds,
      });
      parts.push(partInfo);
    }

    return parts;
  }

  /**
   * Completes single or multipart upload, verifies object directly via HeadObject,
   * CAS-transitions video to UPLOADED, and enqueues the probe job.
   */
  async complete(
    user: AuthUser,
    uploadId: string,
    parts?: { partNumber: number; etag: string }[]
  ): Promise<CompleteUploadResult> {
    const record = await this.uploads.findWithVideo(uploadId);
    if (!record) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
    }

    const { upload, video } = record;
    this.assertOwnership(user, video.ownerId, 'complete this upload');

    // Idempotency check: already completed -> return video state
    if (video.status !== 'UPLOADING') {
      return {
        videoId: video.id,
        status: video.status,
      };
    }

    if (upload.status === 'ABORTED') {
      throw new PermanentError(ErrorCodes.UPLOAD_NOT_OPEN, 'Upload was aborted');
    }

    // Complete S3 multipart upload if multipart
    if (upload.strategy === 'multipart') {
      if (!parts || parts.length === 0) {
        throw new PermanentError(
          ErrorCodes.VALIDATION_FAILED,
          'Missing parts list required to complete multipart upload'
        );
      }

      if (parts.length !== upload.partsExpected) {
        throw new PermanentError(
          ErrorCodes.VALIDATION_FAILED,
          `Expected ${upload.partsExpected} parts but received ${parts.length}`
        );
      }

      if (!upload.multipartUploadId) {
        throw new PermanentError(
          ErrorCodes.VALIDATION_FAILED,
          'Upload record is missing multipart upload ID'
        );
      }

      try {
        await this.multipart.completeMultipartUpload(
          this.rawBucket,
          video.sourceKey,
          upload.multipartUploadId,
          parts
        );
      } catch (err) {
        throw new PermanentError(
          ErrorCodes.VALIDATION_FAILED,
          `Failed to complete multipart upload: ${(err as Error).message}`
        );
      }
    }

    // HeadObject size verification
    const head = await this.storage.headObject(this.rawBucket, video.sourceKey);
    if (!head) {
      throw new PermanentError(
        ErrorCodes.SOURCE_MISSING,
        `Source file not found at ${video.sourceKey}`
      );
    }

    if (video.sourceSizeBytes && head.contentLength !== video.sourceSizeBytes) {
      // Clean up corrupted / mismatched file from storage
      await this.storage.deleteObject(this.rawBucket, video.sourceKey);

      await this.uploads.updateStatus(uploadId, 'ABORTED');

      await this.videos.transition({
        videoId: video.id,
        from: 'UPLOADING',
        to: 'REJECTED',
        eventType: 'upload.rejected',
        eventPayload: {
          declaredSizeBytes: video.sourceSizeBytes,
          actualSizeBytes: head.contentLength,
          reason: 'Uploaded size does not match declared size',
        },
        patch: {
          errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
          errorMessage: `Declared size ${video.sourceSizeBytes} bytes but received ${head.contentLength} bytes`,
        },
      });

      throw new PermanentError(
        ErrorCodes.UPLOAD_SIZE_MISMATCH,
        `Uploaded object size (${head.contentLength}) does not match declared size (${video.sourceSizeBytes})`
      );
    }

    // Mark upload COMPLETED
    await this.uploads.updateStatus(uploadId, 'COMPLETED');

    // Determine trace context: from active span if available, or generate a fresh traceparent
    const activeCtx = getActiveSpanContext();
    const traceparent = activeCtx.traceparent || getActiveTraceparent() || createTraceparent();
    const traceId = activeCtx.traceId || traceparent.split('-')[1];

    // CAS transition: UPLOADING -> UPLOADED
    const transitioned = await this.videos.transition({
      videoId: video.id,
      from: 'UPLOADING',
      to: 'UPLOADED',
      eventType: 'upload.completed',
      eventPayload: {
        uploadId,
        sizeBytes: head.contentLength,
      },
      traceId,
    });

    if (!transitioned) {
      return {
        videoId: video.id,
        status: 'UPLOADED',
      };
    }

    // Admission control (SDD §9.4, PRD FR-13, Ticket 18):
    // Count active in-flight videos for owner (status IN ('PROBING', 'PROCESSING'))
    const inFlightCount = await this.videos.countInFlightByOwner(video.ownerId);

    if (inFlightCount >= this.maxInflightPerUser) {
      return {
        videoId: video.id,
        status: 'UPLOADED',
        admission: 'held',
      };
    }

    // Determine priority according to user tier (pro/enterprise = 1, free = 5)
    let priority = 5;
    if (this.users) {
      const userRecord = await this.users.findById(video.ownerId);
      if (userRecord?.tier === 'pro' || userRecord?.tier === 'enterprise') {
        priority = 1;
      }
    } else if ((user as { tier?: string })?.tier === 'pro') {
      priority = 1;
    }

    // Enqueue probe job
    if (this.probeQueue) {
      const probeJobId = ids.probe(video.id, 1);
      await this.probeQueue.add(
        'probe',
        ProbeJob.parse({
          videoId: video.id,
          sourceKey: video.sourceKey,
          generation: 1,
          traceparent,
        }),
        {
          jobId: probeJobId,
          ...stagePolicies.probe,
          ...defaultJobOptions,
          priority,
        }
      );
    }

    return {
      videoId: video.id,
      status: 'UPLOADED',
      admission: 'admitted',
    };
  }

  /**
   * Aborts an in-flight upload, cancels S3 multipart, cleans storage, and marks video ABANDONED.
   */
  async abort(user: AuthUser, uploadId: string): Promise<void> {
    const record = await this.uploads.findWithVideo(uploadId);
    if (!record) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
    }

    const { upload, video } = record;
    this.assertOwnership(user, video.ownerId, 'abort this upload');

    if (upload.status === 'COMPLETED') {
      throw new PermanentError(
        ErrorCodes.UPLOAD_NOT_OPEN,
        'Cannot abort an already completed upload'
      );
    }

    if (upload.strategy === 'multipart' && upload.multipartUploadId) {
      await this.multipart.abortMultipartUpload(
        this.rawBucket,
        video.sourceKey,
        upload.multipartUploadId
      );
    } else {
      await this.storage.deleteObject(this.rawBucket, video.sourceKey);
    }

    await this.uploads.updateStatus(uploadId, 'ABORTED');

    if (video.status === 'UPLOADING') {
      await this.videos.transition({
        videoId: video.id,
        from: 'UPLOADING',
        to: 'ABANDONED',
        eventType: 'upload.aborted',
        eventPayload: {
          uploadId,
          strategy: upload.strategy,
        },
      });
    }
  }

  private assertOwnership(user: AuthUser, ownerId: string, actionDesc: string): void {
    if (user.id !== ownerId && user.role !== 'admin') {
      throw new PermanentError(ErrorCodes.FORBIDDEN, `Not authorized to ${actionDesc}`);
    }
  }
}
