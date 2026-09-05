import type { JobQueue, MultipartStorage, Repositories, StorageClient } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { MULTIPART_THRESHOLD_BYTES } from '@vp/storage';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { problemResponse } from '../schemas/problem.js';
import { UploadService } from '../services/upload-service.js';

export interface UploadsRouteOptions {
  repositories?: Repositories;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  rawBucket?: string;
  probeQueue?: JobQueue;
  maxUploadBytes?: number;
  rateLimitMax?: number;
  multipartThresholdBytes?: number;
  uploadService?: UploadService;
  maxInflightPerUser?: number;
}

const ALLOWED_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

/**
 * Fastify routes plugin for video uploads (SDD §3.1, §6.1).
 * Thin transport adapter delegating domain orchestration to UploadService.
 */
export function registerUploadsRoutes(app: FastifyInstance, options: UploadsRouteOptions): void {
  const {
    repositories,
    storage,
    multipart,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] || 'raw',
    probeQueue,
    maxUploadBytes = 5 * 1024 * 1024 * 1024, // 5 GB default cap
    rateLimitMax = 30,
    multipartThresholdBytes = MULTIPART_THRESHOLD_BYTES,
    maxInflightPerUser = options.maxInflightPerUser,
    uploadService = options.uploadService ??
      (repositories && storage && multipart
        ? new UploadService({
            uploads: repositories.uploads,
            videos: repositories.videos,
            events: repositories.events,
            users: repositories.users,
            storage,
            multipart,
            rawBucket,
            probeQueue,
            multipartThresholdBytes,
            maxInflightPerUser,
          })
        : undefined),
  } = options;

  if (!uploadService) {
    throw new Error(
      'registerUploadsRoutes requires either uploadService or repositories + storage + multipart'
    );
  }

  const server = app.withTypeProvider<ZodTypeProvider>();

  // 1. POST /v1/uploads (and /uploads) (SDD §3.1, §6.1)
  for (const path of ['/v1/uploads', '/uploads'] as const) {
    const isAlias = path === '/uploads';
    server.post(
      path,
      {
        config: {
          rateLimit: {
            max: rateLimitMax,
            timeWindow: '1 minute',
            keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
          },
        },
        schema: {
          tags: ['Uploads'],
          summary: 'Start upload',
          description:
            'Initiates a direct-to-storage upload (single PUT for <= 100 MB, multipart for larger files).',
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
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation failed'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            422: problemResponse(
              [
                ErrorCodes.UPLOAD_TOO_LARGE,
                ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
                ErrorCodes.QUOTA_EXCEEDED,
              ],
              'Upload cannot be processed'
            ),
            429: problemResponse([ErrorCodes.RATE_LIMITED], 'Upload rate limit exceeded'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { filename, sizeBytes, contentType, sha256, title, visibility } = request.body;

        if (sizeBytes > maxUploadBytes) {
          throw new PermanentError(
            ErrorCodes.UPLOAD_TOO_LARGE,
            `File exceeds maximum upload size of ${maxUploadBytes} bytes`
          );
        }

        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
          throw new PermanentError(
            ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
            `Content type ${contentType} is not supported. Allowed: ${Array.from(ALLOWED_CONTENT_TYPES).join(', ')}`
          );
        }

        const result = await uploadService.initiate(user, {
          filename,
          sizeBytes,
          contentType,
          sha256,
          title,
          visibility,
        });

        return reply.status(201).send(result);
      }
    );
  }

  // 2. GET /v1/uploads/:uploadId (and /uploads/:uploadId) (SDD §3.1, §6.1)
  for (const path of ['/v1/uploads/:uploadId', '/uploads/:uploadId'] as const) {
    const isAlias = path === '/uploads/:uploadId';
    server.get(
      path,
      {
        schema: {
          tags: ['Uploads'],
          summary: 'Get upload resume info',
          description: 'Returns uploaded parts and resume information for multipart uploads.',
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
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Invalid UUID'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Not allowed to view this upload'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Upload not found'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { uploadId } = request.params;
        const result = await uploadService.getResumeInfo(user, uploadId);
        return reply.status(200).send(result);
      }
    );
  }

  // 3. POST /v1/uploads/:uploadId/parts (and /uploads/:uploadId/parts) (SDD §3.1, §6.1)
  for (const path of ['/v1/uploads/:uploadId/parts', '/uploads/:uploadId/parts'] as const) {
    const isAlias = path === '/uploads/:uploadId/parts';
    server.post(
      path,
      {
        schema: {
          tags: ['Uploads'],
          summary: 'Issue additional part presigned URLs',
          description:
            'Issues additional presigned URLs for multipart upload parts beyond the first 100.',
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
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation failed'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Forbidden'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Upload not found'),
            410: problemResponse(
              [ErrorCodes.UPLOAD_NOT_OPEN, ErrorCodes.UPLOAD_EXPIRED],
              'Upload expired or not open'
            ),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { uploadId } = request.params;
        const { from, count } = request.query;
        const parts = await uploadService.issuePartUrls(user, uploadId, from, count);
        return reply.status(200).send({ parts });
      }
    );
  }

  // 4. POST /v1/uploads/:uploadId/complete (and /uploads/:uploadId/complete) (SDD §3.1, §6.1)
  for (const path of ['/v1/uploads/:uploadId/complete', '/uploads/:uploadId/complete'] as const) {
    const isAlias = path === '/uploads/:uploadId/complete';
    server.post(
      path,
      {
        schema: {
          tags: ['Uploads'],
          summary: 'Finish upload',
          description:
            'Completes upload, triggers HEAD validation, transitions video to UPLOADED, and enqueues probe stage.',
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
              admission: z.enum(['admitted', 'held']).optional(),
            }),
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation failed'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Forbidden'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Upload not found'),
            410: problemResponse(
              [ErrorCodes.UPLOAD_NOT_OPEN],
              'Upload is already completed or aborted'
            ),
            422: problemResponse(
              [
                ErrorCodes.UPLOAD_SIZE_MISMATCH,
                ErrorCodes.UPLOAD_TOO_LARGE,
                ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
                ErrorCodes.VALIDATION_FAILED,
              ],
              'Server validation failed on object HEAD or missing parts'
            ),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { uploadId } = request.params;
        const result = await uploadService.complete(user, uploadId, request.body?.parts);
        return reply.status(202).send(result);
      }
    );
  }

  // 5. DELETE /v1/uploads/:uploadId (and /uploads/:uploadId) (SDD §3.1, §6.1)
  for (const path of ['/v1/uploads/:uploadId', '/uploads/:uploadId'] as const) {
    const isAlias = path === '/uploads/:uploadId';
    server.delete(
      path,
      {
        schema: {
          tags: ['Uploads'],
          summary: 'Abort upload',
          description: 'Aborts a multipart upload and transitions video status to ABANDONED.',
          params: z.object({
            uploadId: z.string().uuid(),
          }),
          response: {
            204: z.null().describe('Upload successfully aborted'),
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Invalid UUID'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Forbidden'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Upload not found'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { uploadId } = request.params;
        await uploadService.abort(user, uploadId);
        return reply.status(204).send(null);
      }
    );
  }
}
