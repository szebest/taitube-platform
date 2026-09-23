import {
  abortUpload,
  completeUpload,
  getUpload,
  issueUploadParts,
  startUpload,
} from '@vp/api-contracts';
import { isErr } from '@vp/result';
import { ALLOWED_CONTENT_TYPES, type UploadLimits, validateStartUpload } from '@vp/validation';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { UploadService } from '../services/upload-service';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export interface UploadsRouteOptions {
  uploadService: UploadService;
  maxUploadBytes?: number;
  rateLimitMax?: number;
}

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

  const limits: UploadLimits = {
    maxBytes: maxUploadBytes,
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
  };

  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(startUpload)) {
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
          ...contractSchema(startUpload, { hide }),
          body: startUpload.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { filename, sizeBytes, contentType, strategy, sha256, title, visibility } =
          request.body;

        const validated = validateStartUpload({ filename, sizeBytes, contentType, title }, limits);
        if (isErr(validated)) return sendResult(reply, request, validated);

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

  for (const { path, hide } of contractPaths(getUpload)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getUpload, { hide }),
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

  for (const { path, hide } of contractPaths(issueUploadParts)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(issueUploadParts, { hide }),
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

  for (const { path, hide } of contractPaths(completeUpload)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(completeUpload, { hide }),
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

  for (const { path, hide } of contractPaths(abortUpload)) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(abortUpload, { hide }),
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
