import {
  abortUpload,
  completeUpload,
  getUpload,
  issueUploadParts,
  startUpload,
} from '@vp/api-contracts';
import { isErr, map } from '@vp/result';
import { ALLOWED_CONTENT_TYPES, type UploadLimits, validateStartUpload } from '@vp/validation';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  const { uploadService } = app.services;
  const { maxUploadBytes, uploadRateLimitMax } = app.config.limits;

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
            max: uploadRateLimitMax,
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

        return sendResult(reply, request, result, { status: 201 });
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
        return sendResult(reply, request, await uploadService.getResumeInfo(user, uploadId));
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
        const issued = await uploadService.issuePartUrls(user, uploadId, from, count);

        return sendResult(
          reply,
          request,
          map(issued, (parts) => ({ parts }))
        );
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
        const result = await uploadService.complete(user, uploadId, request.body?.parts, {
          requestId: request.id,
        });

        return sendResult(reply, request, result, { status: 202 });
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
        return sendResult(reply, request, await uploadService.abort(user, uploadId), {
          status: 204,
        });
      }
    );
  }
}
