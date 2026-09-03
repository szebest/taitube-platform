import * as path from 'node:path';
import {
  type Database,
  createUpload,
  getUploadWithVideo,
  transitionVideo,
  updateUploadStatus,
  videoEvents,
  videos,
} from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import {
  MULTIPART_THRESHOLD_BYTES,
  type PresignedPartInfo,
  type S3Client,
  type UploadedPartInfo,
  abortMultipartUpload,
  calculatePartSize,
  calculateTotalParts,
  completeMultipartUpload,
  createMultipartUpload,
  createPresignedPartUrl,
  createPresignedPutUrl,
  deleteObject,
  headObject,
  listMultipartParts,
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
  multipartThresholdBytes?: number;
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
    maxUploadBytes = 5 * 1024 * 1024 * 1024, // 5 GB default cap
    rateLimitMax = 30,
    multipartThresholdBytes = MULTIPART_THRESHOLD_BYTES,
  } = options;

  const server = app.withTypeProvider<ZodTypeProvider>();

  // 1. POST /v1/uploads (SDD §3.1, §6.1, AC 17, AC 20, AC 21)
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
        response: {
          201: z.object({
            videoId: z.string().uuid(),
            uploadId: z.string().uuid(),
            strategy: z.enum(['single', 'multipart']),
            singleUrl: z.string().optional(),
            headers: z.record(z.string()).optional(),
            partSizeBytes: z.number().optional(),
            partsExpected: z.number().optional(),
            parts: z
              .array(
                z.object({
                  partNumber: z.number(),
                  url: z.string(),
                  expiresAt: z.string(),
                })
              )
              .optional(),
            expiresAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const {
        filename,
        sizeBytes,
        contentType,
        sha256,
        title,
        visibility = 'private',
      } = request.body;

      // 1. Content type check
      if (!(ALLOWED_CONTENT_TYPES.has(contentType) || contentType.startsWith('video/'))) {
        throw new PermanentError(
          ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
          `Unsupported content type "${contentType}": must be a supported video format`
        );
      }

      // 2. Max upload bytes check
      if (sizeBytes > maxUploadBytes) {
        throw new PermanentError(
          ErrorCodes.UPLOAD_TOO_LARGE,
          `File size ${sizeBytes} exceeds maximum allowed size of ${maxUploadBytes} bytes`
        );
      }

      const videoId = uuidv7();
      const uploadId = uuidv7();

      // Compute extension from filename (default to mp4)
      const parsedExt = path.extname(filename).toLowerCase();
      const ext = parsedExt.length > 1 ? parsedExt.slice(1) : 'mp4';
      const sourceKey = rawSourceKey(videoId, ext);

      // 3. Strategy selection (SDD §3.1, §6.1, AC 17)
      const isMultipart = sizeBytes > multipartThresholdBytes;
      const _strategy = isMultipart ? 'multipart' : 'single';

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

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min TTL (AC 17)

      if (!isMultipart) {
        // Single PUT upload flow
        await createUpload(db, {
          id: uploadId,
          videoId,
          strategy: 'single',
          declaredSizeBytes: sizeBytes,
          declaredContentType: contentType,
          sha256,
          status: 'OPEN',
          expiresAt,
        });

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
          strategy: 'single',
          singleUrl: presigned.url,
          headers: presigned.headers,
          expiresAt: presigned.expiresAt.toISOString(),
        });
      }

      // Multipart upload flow (AC 17, SDD §3.1)
      const partSizeBytes = calculatePartSize(sizeBytes);
      const partsExpected = calculateTotalParts(sizeBytes, partSizeBytes);

      if (partsExpected > 10000) {
        throw new PermanentError(
          ErrorCodes.UPLOAD_TOO_LARGE,
          `File size requires ${partsExpected} parts, exceeding S3 limit of 10000 parts`
        );
      }

      // Initiate multipart upload in S3 storage
      const multipartUploadId = await createMultipartUpload(
        s3Client,
        rawBucket,
        sourceKey,
        contentType
      );

      await createUpload(db, {
        id: uploadId,
        videoId,
        strategy: 'multipart',
        multipartUploadId,
        partSizeBytes,
        partsExpected,
        declaredSizeBytes: sizeBytes,
        declaredContentType: contentType,
        sha256,
        status: 'OPEN',
        expiresAt,
      });

      // Generate the first batch of <= 100 part URLs (AC 17)
      const initialBatchCount = Math.min(100, partsExpected);
      const parts: PresignedPartInfo[] = [];

      for (let p = 1; p <= initialBatchCount; p++) {
        const partInfo = await createPresignedPartUrl(s3Client, {
          bucket: rawBucket,
          key: sourceKey,
          uploadId: multipartUploadId,
          partNumber: p,
          expiresInSeconds: 15 * 60,
        });
        parts.push(partInfo);
      }

      return reply.status(201).send({
        videoId,
        uploadId,
        strategy: 'multipart',
        partSizeBytes,
        partsExpected,
        parts,
        expiresAt: expiresAt.toISOString(),
      });
    }
  );

  // 2. GET /v1/uploads/:uploadId (SDD §3.1, §6.1, AC 18, AC 20)
  server.get(
    '/v1/uploads/:uploadId',
    {
      schema: {
        params: z.object({
          uploadId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            status: z.string(),
            strategy: z.string(),
            partSizeBytes: z.number().nullable().optional(),
            partsExpected: z.number().nullable().optional(),
            uploadedParts: z
              .array(
                z.object({
                  partNumber: z.number(),
                  etag: z.string(),
                  size: z.number(),
                })
              )
              .optional(),
          }),
        },
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

      if (video.ownerId !== user.id && user.role !== 'admin') {
        throw new PermanentError(ErrorCodes.FORBIDDEN, 'Not authorized to view this upload');
      }

      if (upload.status !== 'OPEN') {
        throw new PermanentError(
          ErrorCodes.UPLOAD_NOT_OPEN,
          `Upload is not open (current status: ${upload.status})`
        );
      }

      if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
        return reply.status(200).send({
          status: upload.status,
          strategy: upload.strategy,
        });
      }

      // Query S3 ListParts to retrieve already stored parts and ETags (AC 18)
      const uploadedParts: UploadedPartInfo[] = await listMultipartParts(
        s3Client,
        rawBucket,
        video.sourceKey,
        upload.multipartUploadId
      );

      return reply.status(200).send({
        status: upload.status,
        strategy: 'multipart',
        partSizeBytes: upload.partSizeBytes,
        partsExpected: upload.partsExpected,
        uploadedParts,
      });
    }
  );

  // 3. POST /v1/uploads/:uploadId/parts (SDD §3.1, §6.1, AC 17, AC 18)
  server.post(
    '/v1/uploads/:uploadId/parts',
    {
      schema: {
        params: z.object({
          uploadId: z.string().uuid(),
        }),
        querystring: z.object({
          from: z.coerce.number().int().min(1).default(1),
          count: z.coerce.number().int().min(1).max(100).default(100),
        }),
        response: {
          200: z.object({
            parts: z.array(
              z.object({
                partNumber: z.number(),
                url: z.string(),
                expiresAt: z.string(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const { uploadId } = request.params;
      const { from, count } = request.query;

      const record = await getUploadWithVideo(db, uploadId);
      if (!record) {
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
      }

      const { upload, video } = record;

      if (video.ownerId !== user.id && user.role !== 'admin') {
        throw new PermanentError(
          ErrorCodes.FORBIDDEN,
          'Not authorized to request parts for this upload'
        );
      }

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
      const parts: PresignedPartInfo[] = [];

      for (let p = from; p <= endPart; p++) {
        const partInfo = await createPresignedPartUrl(s3Client, {
          bucket: rawBucket,
          key: video.sourceKey,
          uploadId: upload.multipartUploadId,
          partNumber: p,
          expiresInSeconds: 15 * 60,
        });
        parts.push(partInfo);
      }

      return reply.status(200).send({
        parts,
      });
    }
  );

  // 4. POST /v1/uploads/:uploadId/complete (SDD §3.1, §6.1, AC 18, AC 19)
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
                  partNumber: z.number().int().positive(),
                  etag: z.string().min(1),
                })
              )
              .optional(),
          })
          .optional(),
        response: {
          202: z.object({
            videoId: z.string().uuid(),
            status: z.string(),
          }),
        },
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

      if (video.ownerId !== user.id && user.role !== 'admin') {
        throw new PermanentError(ErrorCodes.FORBIDDEN, 'Not authorized to complete this upload');
      }

      // Idempotency check: already completed -> return 202
      if (video.status !== 'UPLOADING') {
        return reply.status(202).send({
          videoId: video.id,
          status: video.status,
        });
      }

      if (upload.status === 'ABORTED') {
        throw new PermanentError(ErrorCodes.UPLOAD_NOT_OPEN, 'Upload was aborted');
      }

      // If multipart, complete the multipart upload via S3 CompleteMultipartUpload
      if (upload.strategy === 'multipart') {
        const parts = request.body?.parts;
        if (!parts || parts.length === 0) {
          throw new PermanentError(
            ErrorCodes.VALIDATION_FAILED,
            'Missing parts list required to complete multipart upload'
          );
        }

        // Validate parts count against expected parts
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
          await completeMultipartUpload(
            s3Client,
            rawBucket,
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

      // 1. Verify object directly in storage via HeadObject (SDD §3.1, AC 19)
      const head = await headObject(s3Client, rawBucket, video.sourceKey);
      if (!head) {
        throw new PermanentError(
          ErrorCodes.SOURCE_MISSING,
          `Source file not found at ${video.sourceKey}`
        );
      }

      // 2. Verify size matches declared size (AC 19)
      if (head.contentLength !== upload.declaredSizeBytes) {
        // Delete rejected object from storage
        await deleteObject(s3Client, rawBucket, video.sourceKey);

        // Mark upload ABORTED
        await updateUploadStatus(db, uploadId, 'ABORTED');

        // Mark video REJECTED with error code
        await db
          .update(videos)
          .set({
            status: 'REJECTED',
            errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
            errorMessage: `Size mismatch: declared ${upload.declaredSizeBytes} bytes but received ${head.contentLength} bytes`,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, video.id));

        throw new PermanentError(
          ErrorCodes.UPLOAD_SIZE_MISMATCH,
          `Uploaded size ${head.contentLength} bytes does not match declared size ${upload.declaredSizeBytes} bytes`
        );
      }

      // 3. Mark upload COMPLETED
      await updateUploadStatus(db, uploadId, 'COMPLETED');

      // 4. Atomic CAS transition UPLOADING -> UPLOADED (writes video_events upload.completed)
      const transitioned = await transitionVideo(db, {
        videoId: video.id,
        from: 'UPLOADING',
        to: 'UPLOADED',
        eventType: 'upload.completed',
        eventPayload: {
          sourceKey: video.sourceKey,
          sizeBytes: head.contentLength,
          contentType: head.contentType || upload.declaredContentType,
          strategy: upload.strategy,
        },
        patch: {
          sourceSizeBytes: head.contentLength,
          sourceContentType: head.contentType || upload.declaredContentType,
        },
      });

      // 5. Enqueue probe job to BullMQ queue
      if (transitioned && probeQueue) {
        const jobId = ids.probe(video.id, 1);
        await probeQueue.add(
          'probe',
          {
            videoId: video.id,
            sourceKey: video.sourceKey,
            generation: 1,
            traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
          } satisfies ProbeJob,
          {
            jobId,
            ...stagePolicies.probe,
            ...defaultJobOptions,
          }
        );
      }

      return reply.status(202).send({
        videoId: video.id,
        status: 'UPLOADED',
      });
    }
  );

  // 5. DELETE /v1/uploads/:uploadId (SDD §3.1, §6.1, AC 20)
  server.delete(
    '/v1/uploads/:uploadId',
    {
      schema: {
        params: z.object({
          uploadId: z.string().uuid(),
        }),
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

      if (video.ownerId !== user.id && user.role !== 'admin') {
        throw new PermanentError(ErrorCodes.FORBIDDEN, 'Not authorized to abort this upload');
      }

      // 1. Abort multipart upload in storage if multipart (AC 20)
      if (upload.strategy === 'multipart' && upload.multipartUploadId) {
        try {
          await abortMultipartUpload(
            s3Client,
            rawBucket,
            video.sourceKey,
            upload.multipartUploadId
          );
        } catch {
          // Best effort abort in storage
        }
      }

      // Delete partial source file if any exists
      await deleteObject(s3Client, rawBucket, video.sourceKey).catch(() => {});

      // 2. Mark upload status ABORTED
      await updateUploadStatus(db, uploadId, 'ABORTED');

      // 3. Mark video status ABANDONED (AC 20)
      await db
        .update(videos)
        .set({
          status: 'ABANDONED',
          updatedAt: new Date(),
        })
        .where(eq(videos.id, video.id));

      // 4. Record event in video_events
      await db.insert(videoEvents).values({
        videoId: video.id,
        type: 'upload.aborted',
        payload: { uploadId, reason: 'client_aborted' },
      });

      return reply.status(204).send();
    }
  );
}
