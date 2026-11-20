import {
  SHARE_TOKEN_PARAM,
  deleteVideo,
  getVideo,
  listVideos,
  reprocessVideo,
  updateVideo,
} from '@vp/api-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { GATED_READ_HEADERS, watchRequestOf } from './video-access-request';
import { presentPublicVideoFailure } from './videos.presenter';

export async function videosRoutes(app: FastifyInstance): Promise<void> {
  const { videoService, videoWatchService, creatorStudioService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(listVideos)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listVideos, { hide }),
          querystring: listVideos.query,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(reply, request, await videoService.list(user, request.query));
      }
    );
  }

  for (const { path, hide } of contractPaths(getVideo)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getVideo, { hide }),
          params: getVideo.params,
          querystring: getVideo.query,
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        const watched = await videoWatchService.watch(
          request.user ?? null,
          id,
          watchRequestOf(request, id, request.query[SHARE_TOKEN_PARAM])
        );
        reply.headers(GATED_READ_HEADERS);
        return sendResult(reply, request, watched, {
          present: (failure) => presentPublicVideoFailure(failure, request.url),
        });
      }
    );
  }

  for (const { path, hide } of contractPaths(updateVideo)) {
    server.patch(
      path,
      {
        schema: {
          ...contractSchema(updateVideo, { hide }),
          params: updateVideo.params,
          body: updateVideo.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        return sendResult(
          reply,
          request,
          await creatorStudioService.update(user, id, request.body),
          {
            present: (failure) => presentPublicVideoFailure(failure, request.url),
          }
        );
      }
    );
  }

  for (const { path, hide } of contractPaths(deleteVideo)) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(deleteVideo, { hide }),
          params: deleteVideo.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        return sendResult(reply, request, await videoService.softDelete(user, id), { status: 202 });
      }
    );
  }

  for (const { path, hide } of contractPaths(reprocessVideo)) {
    server.post(
      path,
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '1 minute',
            keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
            allowList: (req: FastifyRequest) =>
              req.user ? videoService.isRateLimitExempt(req.user) : false,
          },
        },
        schema: {
          ...contractSchema(reprocessVideo, { hide }),
          params: reprocessVideo.params,
          body: reprocessVideo.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        const reprocessed = await videoService.reprocess(user, id, { requestId: request.id });
        return sendResult(reply, request, reprocessed, { status: 202 });
      }
    );
  }
}
