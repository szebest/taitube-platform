import { deleteVideo, getVideo, listVideos, reprocessVideo, updateVideo } from '@vp/api-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { VideoService } from '../services/video-service';
import { contractPaths, contractSchema } from './contract-schema';

export interface VideosRouteOptions {
  videoService: VideoService;
}

/**
 * Fastify routes plugin for video queries and management (SDD §6.1, §6.3).
 * Thin transport adapter delegating domain operations to VideoService.
 */
export function registerVideosRoutes(app: FastifyInstance, options: VideosRouteOptions): void {
  const { videoService } = options;
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
        const result = await videoService.list(user, request.query);
        return reply.status(200).send(result);
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
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        const videoResponse = await videoService.get(request.user ?? null, id);
        return reply.status(200).send(videoResponse);
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
        const updated = await videoService.updateMetadata(user, id, request.body);
        return reply.status(200).send(updated);
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
        const result = await videoService.softDelete(user, id);
        return reply.status(202).send(result);
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
            skip: (req: FastifyRequest) =>
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
        const result = await videoService.reprocess(user, id, {
          traceparent: request.headers['traceparent'] as string | undefined,
        });
        return reply.status(202).send(result);
      }
    );
  }
}
