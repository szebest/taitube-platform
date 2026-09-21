import {
  abortUpload,
  completeUpload,
  getUpload,
  issueUploadParts,
  startUpload,
} from '@vp/api-contracts';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { UploadService } from '../services/upload-service';
import { contractSchema } from './contract-schema';

export interface UploadsRouteOptions {
  uploadService: UploadService;
  maxUploadBytes?: number;
  rateLimitMax?: number;
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
    uploadService,
    maxUploadBytes = 5 * 1024 * 1024 * 1024, // 5 GB default cap
    rateLimitMax = 30,
  } = options;

  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const path of ['/v1/uploads', '/uploads'] as const) {
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
          ...contractSchema(startUpload, { hide: path === '/uploads' }),
          body: startUpload.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { filename, sizeBytes, contentType, strategy, sha256, title, visibility } =
          request.body;

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
          strategy,
          sha256,
          title,
          visibility,
        });

        return reply.status(201).send(result);
      }
    );
  }

  for (const path of ['/v1/uploads/:uploadId', '/uploads/:uploadId'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getUpload, { hide: path === '/uploads/:uploadId' }),
          params: getUpload.params,
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

  for (const path of ['/v1/uploads/:uploadId/parts', '/uploads/:uploadId/parts'] as const) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(issueUploadParts, { hide: path === '/uploads/:uploadId/parts' }),
          params: issueUploadParts.params,
          querystring: issueUploadParts.query,
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

  for (const path of ['/v1/uploads/:uploadId/complete', '/uploads/:uploadId/complete'] as const) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(completeUpload, { hide: path === '/uploads/:uploadId/complete' }),
          params: completeUpload.params,
          body: completeUpload.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { uploadId } = request.params;
        const testCrashAfterCommit = request.headers['x-test-crash-after-commit'] === 'true';
        const result = await uploadService.complete(user, uploadId, request.body?.parts, {
          testCrashAfterCommit,
        });
        return reply.status(202).send(result);
      }
    );
  }

  for (const path of ['/v1/uploads/:uploadId', '/uploads/:uploadId'] as const) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(abortUpload, { hide: path === '/uploads/:uploadId' }),
          params: abortUpload.params,
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
