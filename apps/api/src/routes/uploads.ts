import type { JobQueue, MultipartStorage, Repositories, StorageClient } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { MULTIPART_THRESHOLD_BYTES } from '@vp/storage';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
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
      const result = await uploadService.getResumeInfo(user, uploadId);
      return reply.status(200).send(result);
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
      const parts = await uploadService.issuePartUrls(user, uploadId, from, count);
      return reply.status(200).send({ parts });
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
            admission: z.enum(['admitted', 'held']).optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const { uploadId } = request.params;
      const result = await uploadService.complete(user, uploadId, request.body?.parts);
      return reply.status(202).send(result);
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
      await uploadService.abort(user, uploadId);
      return reply.status(204).send();
    }
  );
}
