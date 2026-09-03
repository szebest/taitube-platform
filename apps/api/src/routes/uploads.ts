import * as path from 'node:path';
import {
  type Database,
  createUpload,
  getUploadWithVideo,
  transitionVideo,
  updateUploadStatus,
  videos,
} from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import {
  type S3Client,
  createPresignedPutUrl,
  deleteObject,
  headObject,
  rawSourceKey,
} from '@vp/storage';
import type { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';

export interface UploadsRouteOptions {
  db: Database;
  s3Client: S3Client;
  rawBucket?: string;
  probeQueue?: Queue;
  maxUploadBytes?: number;
  rateLimitMax?: number;
}

const ALLOWED_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

export function registerUploadsRoutes(app: FastifyInstance, options: UploadsRouteOptions): void {
  const {
    db,
    s3Client,
    rawBucket = process.env.STORAGE_RAW_BUCKET || 'raw',
    probeQueue,
    maxUploadBytes = 5 * 1024 * 1024 * 1024, // 5 GB
    rateLimitMax = 30,
  } = options;

  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /v1/uploads (SDD §3.1, §6.1, AC 17, AC 20, AC 21)
  server.post(
    '/v1/uploads',
    {
      config: {
        rateLimit: {
          max: rateLimitMax,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
        },
      },
      schema: {
        body: z.object({
          filename: z.string().min(1).max(255),
          sizeBytes: z.number().int().positive(),
          contentType: z.string(),
          sha256: z.string().optional(),
          title: z.string().optional(),
          visibility: z.enum(['private', 'unlisted', 'public']).optional(),
        }),
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const { filename, sizeBytes, contentType, title, visibility = 'private' } = request.body;

      // 1. Content type check (AC 20)
      if (!(ALLOWED_CONTENT_TYPES.has(contentType) || contentType.startsWith('video/'))) {
        throw new PermanentError(
          ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
          `Unsupported content type "${contentType}": must be a supported video format`
        );
      }

      // 2. Max upload bytes check (AC 20)
      if (sizeBytes > maxUploadBytes) {
        throw new PermanentError(
          ErrorCodes.UPLOAD_TOO_LARGE,
          `File size ${sizeBytes} exceeds maximum allowed size of ${maxUploadBytes} bytes`
        );
      }

      // 3. Strategy selection (SDD §3.1, §6.1, AC 17): <= 100 MB -> single
      const strategy = 'single';

      const videoId = uuidv7();
      const uploadId = uuidv7();

      // Compute extension from filename (default to mp4)
      const parsedExt = path.extname(filename).toLowerCase();
      const ext = parsedExt.length > 1 ? parsedExt.slice(1) : 'mp4';
      const sourceKey = rawSourceKey(videoId, ext);

      // 4. Create video row in UPLOADING status
      await db.insert(videos).values({
        id: videoId,
        ownerId: user.id,
        title: title || filename,
        visibility,
        status: 'UPLOADING',
        sourceKey,
        sourceSizeBytes: sizeBytes,
        sourceContentType: contentType,
        version: 1,
      });

      // 5. Create upload row in OPEN status
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      await createUpload(db, {
        id: uploadId,
        videoId,
        strategy,
        declaredSizeBytes: sizeBytes,
        declaredContentType: contentType,
        status: 'OPEN',
        expiresAt,
      });

      // 6. Generate presigned PUT URL directly to storage (AC 17)
      const presigned = await createPresignedPutUrl(s3Client, {
        bucket: rawBucket,
        key: sourceKey,
        contentType,
        contentLength: sizeBytes,
        expiresInSeconds: 15 * 60,
      });

      return reply.status(201).send({
        videoId,
        uploadId,
        strategy,
        singleUrl: presigned.url,
        headers: presigned.headers,
        expiresAt: presigned.expiresAt.toISOString(),
      });
    }
  );

  // POST /v1/uploads/:uploadId/complete (SDD §3.1, §6.1, AC 19, AC 20)
  server.post(
    '/v1/uploads/:uploadId/complete',
    {
      schema: {
        params: z.object({
          uploadId: z.string().uuid(),
        }),
        body: z
          .object({
            parts: z
              .array(
                z.object({
                  partNumber: z.number().int(),
                  etag: z.string(),
                })
              )
              .optional(),
          })
          .optional(),
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const { uploadId } = request.params;

      const record = await getUploadWithVideo(db, uploadId);
      if (!record) {
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
      }

      const { upload, video } = record;

      // Access control
      if (video.ownerId !== user.id && user.role !== 'admin') {
        throw new PermanentError(ErrorCodes.FORBIDDEN, 'Not authorized to complete this upload');
      }

      // Idempotency (AC 19): If already UPLOADED or downstream, return 202 without re-enqueueing
      if (video.status !== 'UPLOADING') {
        return reply.status(202).send({
          videoId: video.id,
          status: video.status,
        });
      }

      if (upload.status === 'ABORTED') {
        throw new PermanentError(ErrorCodes.UPLOAD_NOT_OPEN, 'Upload was aborted');
      }

      // 1. Verify object directly in S3 storage (SDD §3.1, AC 19)
      const head = await headObject(s3Client, rawBucket, video.sourceKey);
      if (!head) {
        throw new PermanentError(
          ErrorCodes.SOURCE_MISSING,
          `Source file not found at ${video.sourceKey}`
        );
      }

      // 2. Verify size matches declared size (AC 20)
      if (head.contentLength !== upload.declaredSizeBytes) {
        // Delete rejected object from storage
        await deleteObject(s3Client, rawBucket, video.sourceKey);

        // Update video status to REJECTED with error code
        await db
          .update(videos)
          .set({
            status: 'REJECTED',
            errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
            errorMessage: `Size mismatch: declared ${upload.declaredSizeBytes} bytes, but uploaded ${head.contentLength} bytes`,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, video.id));

        throw new PermanentError(
          ErrorCodes.UPLOAD_SIZE_MISMATCH,
          `Uploaded size ${head.contentLength} bytes does not match declared size ${upload.declaredSizeBytes} bytes`
        );
      }

      // 3. Verify content type
      if (head.contentType && !head.contentType.startsWith('video/')) {
        await deleteObject(s3Client, rawBucket, video.sourceKey);

        await db
          .update(videos)
          .set({
            status: 'REJECTED',
            errorCode: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
            errorMessage: `Unsupported content type "${head.contentType}" in storage`,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, video.id));

        throw new PermanentError(
          ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
          `Uploaded content type "${head.contentType}" is unsupported`
        );
      }

      // 4. CAS state transition UPLOADING -> UPLOADED (AC 19)
      const transitioned = await transitionVideo(db, {
        videoId: video.id,
        from: 'UPLOADING',
        to: 'UPLOADED',
        eventType: 'upload.completed',
        eventPayload: {
          uploadId,
          sizeBytes: head.contentLength,
          sourceKey: video.sourceKey,
        },
      });

      if (!transitioned) {
        // Another concurrent request or worker transitioned this video
        const currentVideo = await db.select().from(videos).where(eq(videos.id, video.id)).limit(1);
        return reply.status(202).send({
          videoId: video.id,
          status: currentVideo[0]?.status ?? 'UPLOADED',
        });
      }

      // Mark upload COMPLETED
      await updateUploadStatus(db, uploadId, 'COMPLETED');

      // 5. Enqueue probe job into BullMQ with deterministic jobId = {videoId}--probe--g1 (AC 19, SDD §9.2)
      const generation = 1;
      const jobId = ids.probe(video.id, generation);
      const traceparent =
        (request.headers.traceparent as string) ||
        `00-${uuidv7().replace(/-/g, '')}-0000000000000001-01`;

      const probePayload: ProbeJob = {
        videoId: video.id,
        sourceKey: video.sourceKey,
        generation,
        traceparent,
      };

      if (probeQueue) {
        await probeQueue.add('probe', probePayload, {
          jobId,
          ...stagePolicies.probe,
          ...defaultJobOptions,
        });
      }

      return reply.status(202).send({
        videoId: video.id,
        status: 'UPLOADED',
      });
    }
  );
}
